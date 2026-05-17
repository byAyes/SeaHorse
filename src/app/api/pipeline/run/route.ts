export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ScraperRunner } from "@/scrapers/index";
import { scoreAndSortJobs } from "@/matching/scorer";
import { saveNewJobs, cleanupEmailedJobs, cleanupOldJobs } from "@/lib/automation/job-history";
import type { UserProfile } from "@/types/user-profile";
import type { Job } from "@/types/job";
import type { MatchedJob } from "@/types/job-match";

// ── In-memory cache for active runs (avoids DB polling for fast status updates) ──

interface CachedRun {
  id: string;
  status: "running" | "completed" | "error";
  logs: string[];
  error?: string;
  completedAt?: string;
}

const activeRuns = new Map<string, CachedRun>();

// ── Zombie Pipeline Cleanup ──

/**
 * Marks any PipelineRun stuck in "running" for > 1 hour as "error".
 * Handles crashes mid-execution (server restart, timeout, etc.).
 */
async function cleanupZombieRuns() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  try {
    const result = await prisma.pipelineRun.updateMany({
      where: {
        status: "running",
        startedAt: { lt: oneHourAgo },
      },
      data: {
        status: "error",
        error: "Pipeline abandonado — la ejecución excedió el tiempo límite de 1 hora",
        completedAt: new Date(),
      },
    });
    if (result.count > 0) {
      console.log(`[Pipeline] Limpieza de zombies: ${result.count} ejecuciones abandonadas marcadas como error`);
    }
  } catch (err) {
    // DB might not be available at startup — that's fine
    console.warn("[Pipeline] No se pudo limpiar zombies (DB no disponible)");
  }
}

// Run zombie cleanup on module load (fires once at server start)
cleanupZombieRuns();

// ── Helpers ──

function addLog(runId: string, message: string) {
  const run = activeRuns.get(runId);
  if (run) {
    const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
    run.logs.push(entry);
  }
}

function convertToJob(scraped: Record<string, unknown>): Job {
  return {
    id: scraped.id as string,
    title: scraped.title as string,
    company: scraped.company as string,
    location: (scraped.location as string) || null,
    description: (scraped.description as string) || null,
    url: scraped.link as string || scraped.url as string,
    salary: (scraped.salary as number) ?? null,
    postedAt: (scraped.postedAt as Date) || null,
    scrapedAt: (scraped.scrapedAt as Date) || new Date(),
    skills: Array.isArray(scraped.skills) ? scraped.skills as string[] : [],
    category: (scraped.category as string) || null,
  };
}

// ── Background Pipeline Execution ──

async function executePipelineRun(runId: string, profile?: Record<string, unknown>) {
  const errors: string[] = [];

  const saveToDb = async () => {
    const cached = activeRuns.get(runId);
    if (!cached) return;
    await prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        status: cached.status,
        logs: cached.logs,
        error: cached.error,
        completedAt: cached.completedAt ? new Date(cached.completedAt) : null,
      },
    }).catch(() => {
      // DB unavailable — cache still has the data for this session
    });
  };

  try {
    // Step 1: Scrape
    addLog(runId, "Iniciando scraping de bolsas de trabajo...");
    const query = process.env.JOB_QUERY || "software engineer";
    const maxJobs = parseInt(process.env.MAX_JOBS_PER_SCRAPER || "10", 10);
    addLog(runId, `Buscando: "${query}" (máx. ${maxJobs} por fuente)`);

    const runner = new ScraperRunner({ query, maxJobs });
    const scrapedJobs = await runner.runAllScrapers();
    const scraperStats = runner.getStats();

    addLog(runId, `Scraping completado: ${scrapedJobs.length} jobs encontrados`);
    scraperStats.forEach((s: any) => {
      addLog(runId, `  ${s.name}: ${s.jobs} jobs${s.errors > 0 ? ` (${s.errors} errores)` : ""}`);
    });
    await saveToDb();

    // Step 2: Convert to Job format
    const allJobs = (scrapedJobs as any[]).map((j: any) => convertToJob(j));
    addLog(runId, `${allJobs.length} jobs convertidos al formato interno`);

    // Step 3: Save to DB
    let savedCount = 0;
    if (allJobs.length > 0) {
      addLog(runId, "Guardando jobs en la base de datos...");
      try {
        const savedIds = await saveNewJobs(allJobs as any);
        savedCount = savedIds.length;
        addLog(runId, `${savedCount} jobs guardados en DB`);
      } catch (dbError) {
        const msg = dbError instanceof Error ? dbError.message : "Error guardando en DB";
        addLog(runId, `⚠️ DB: ${msg} (continuando sin persistencia)`);
        errors.push(msg);
      }
      await saveToDb();
    }

    // Step 4: Calculate match scores
    let matches: MatchedJob[] = [];
    if (profile && allJobs.length > 0) {
      addLog(runId, "Calculando scores de matching...");
      const userProfile: UserProfile = {
        id: "pipeline-run",
        userId: "extracted",
        createdAt: new Date(),
        updatedAt: new Date(),
        skills: (profile.skills as string[]) || [],
        interests: (profile.jobTitles as string[]) || [],
        location: ((profile.locations as string[]) || [])[0] || null,
        remoteOnly: ((profile.locations as string[]) || []).some(
          (l: string) => l.toLowerCase().includes("remoto") || l.toLowerCase().includes("remote")
        ),
        experienceLevel: (profile.experienceLevel as any) || null,
        minSalary: null,
        maxSalary: null,
        skillWeight: 0.4,
        interestWeight: 0.3,
        locationWeight: 0.2,
        salaryWeight: 0.1,
      };

      matches = scoreAndSortJobs(allJobs, userProfile, 0);
      addLog(runId, `Matching completado: ${matches.length} jobs con score`);

      const excellent = matches.filter((m) => m.score.overall >= 80).length;
      const good = matches.filter((m) => m.score.overall >= 60 && m.score.overall < 80).length;
      addLog(runId, `  Excelentes (≥80): ${excellent} | Buenos (60-79): ${good} | Potenciales (<60): ${matches.length - excellent - good}`);
      await saveToDb();
    } else if (allJobs.length > 0) {
      addLog(runId, "Sin perfil — asignando scores neutrales");
      matches = allJobs.map((job) => ({
        job,
        score: {
          overall: 100,
          skillMatch: 0,
          interestMatch: 0,
          locationMatch: 0,
          salaryMatch: 0,
          matchedSkills: [] as string[],
        },
      }));
    }

    // Step 5: Cleanup old jobs
    addLog(runId, "Limpiando jobs antiguos...");
    let cleaned = 0;
    try {
      const emailedCleaned = await cleanupEmailedJobs(7);
      const oldCleaned = await cleanupOldJobs(1);
      cleaned = emailedCleaned + oldCleaned;
      addLog(runId, `Limpieza completada: ${cleaned} jobs removidos`);
    } catch (cleanupError) {
      const msg = cleanupError instanceof Error ? cleanupError.message : "Error en limpieza";
      addLog(runId, `⚠️ Cleanup: ${msg}`);
      errors.push(msg);
    }

    // Build result
    const result = {
      scraped: allJobs.length,
      matched: matches.length,
      saved: savedCount,
      cleaned,
      errors,
      scraperStats: scraperStats.map((s: any) => ({
        name: s.name,
        jobs: s.jobs,
        errors: s.errors,
        duration: s.duration || 0,
      })),
      matches: matches.map((m) => ({
        job: {
          ...m.job,
          postedAt: m.job.postedAt?.toISOString() || null,
          scrapedAt: m.job.scrapedAt.toISOString(),
        },
        score: m.score,
      })),
    };

    // Update in-memory cache
    const cached = activeRuns.get(runId);
    if (cached) {
      cached.status = "completed";
      cached.completedAt = new Date().toISOString();
    }

    addLog(runId, "✅ Pipeline completado exitosamente");

    // Persist to DB (result + final status)
    await prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        logs: cached?.logs || [],
        result: result as object,
        completedAt: new Date(),
      },
    }).catch(() => {});

    // Remove from cache so subsequent GETs read the full result from DB
    activeRuns.delete(runId);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error desconocido";

    const cached = activeRuns.get(runId);
    if (cached) {
      cached.status = "error";
      cached.error = errorMsg;
      cached.completedAt = new Date().toISOString();
    }
    addLog(runId, `❌ Error: ${errorMsg}`);

    await prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        status: "error",
        logs: cached?.logs || [],
        error: errorMsg,
        completedAt: new Date(),
      },
    }).catch(() => {});

    // Remove from cache so subsequent GETs read from DB
    activeRuns.delete(runId);
  }
}

// ── Routes ──

/**
 * POST /api/pipeline/run
 * Start a new pipeline execution and persist to DB.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const profile = body.profile || null;

    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create DB record first
    const now = new Date();
    await prisma.pipelineRun.create({
      data: {
        id: runId,
        status: "running",
        logs: [`[${now.toLocaleTimeString()}] Pipeline iniciado...`, `[${now.toLocaleTimeString()}] ID de ejecución: ${runId}`],
        startedAt: now,
      },
    }).catch((err) => {
      throw new Error(`No se pudo crear el registro en DB: ${err.message}`);
    });

    // Sync in-memory cache
    activeRuns.set(runId, {
      id: runId,
      status: "running",
      logs: [`[${now.toLocaleTimeString()}] Pipeline iniciado...`, `[${now.toLocaleTimeString()}] ID de ejecución: ${runId}`],
    });

    // Run in background (don't await) — errors handled inside executePipelineRun
    executePipelineRun(runId, profile as Record<string, unknown> | undefined);

    // Clean up cache entry after 5 minutes (DB is the permanent store)
    setTimeout(() => {
      activeRuns.delete(runId);
    }, 5 * 60 * 1000);

    return NextResponse.json({ runId, status: "running" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al iniciar pipeline" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pipeline/run?runId=xxx
 * Poll for pipeline status — reads from cache (active) or DB (completed).
 */
export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json({ error: "runId es requerido" }, { status: 400 });
  }

  // Active run? Read from fast in-memory cache
  const cached = activeRuns.get(runId);
  if (cached) {
    return NextResponse.json({
      id: cached.id,
      status: cached.status,
      logs: cached.logs,
      result: null, // result is only in DB after completion
      error: cached.error,
      startedAt: null,
      completedAt: cached.completedAt,
    });
  }

  // Completed/persisted run? Read from DB
  try {
    const run = await prisma.pipelineRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: "Run no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      id: run.id,
      status: run.status,
      logs: run.logs as string[],
      result: run.result,
      error: run.error,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() || null,
    });
  } catch (dbError) {
    return NextResponse.json(
      { error: dbError instanceof Error ? dbError.message : "Error al consultar DB" },
      { status: 500 }
    );
  }
}
