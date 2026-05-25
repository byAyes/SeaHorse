import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LocalCollection } from '@/lib/local-data';
import type { Job } from '@/types/job';
import { authenticate } from '@/lib/auth/middleware';

// Cache de stats en memoria con TTL de 30 segundos
// Previene reprocesar todo el dataset en cada request
interface StatsCache {
  data: Record<string, unknown>;
  timestamp: number;
}

let statsCache: StatsCache | null = null;
const CACHE_TTL = 30_000; // 30 segundos

function getCachedStats() {
  if (statsCache && Date.now() - statsCache.timestamp < CACHE_TTL) {
    return statsCache.data;
  }
  return null;
}

function setCachedStats(data: Record<string, unknown>) {
  statsCache = { data, timestamp: Date.now() };
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Load all jobs once for counting, chart, and skills
    // Only load last 500 jobs to avoid OOM
    const jobCol = new LocalCollection<Job & { id: string }>('jobs');
    const allJobs = await jobCol.findMany();
    const limitedJobs = allJobs.slice(-500);
    const recentJobs = allJobs.filter((j) => j.scrapedAt >= thirtyDaysAgo);
    const todayJobs = allJobs.filter((j) => j.scrapedAt >= todayStart);

    const totalJobs = recentJobs.length;
    const totalJobsToday = todayJobs.length;

    // Total user profiles
    const totalProfiles = (await prisma.userProfile.count()) as number;

    // Recent jobs (last 5)
    const sortedJobs = [...limitedJobs].sort((a, b) => b.scrapedAt.getTime() - a.scrapedAt.getTime());
    const recentJobRows = sortedJobs.slice(0, 5).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description,
      url: j.url,
      salary: j.salary,
      postedAt: j.postedAt,
      scrapedAt: j.scrapedAt,
      skills: j.skills,
      category: j.category,
    }));

    // Jobs grouped by day for chart (replaces $queryRaw GROUP BY)
    const jobsByDayMap = new Map<string, number>();
    for (const job of recentJobs) {
      const dateKey = job.scrapedAt.toISOString().split('T')[0];
      jobsByDayMap.set(dateKey, (jobsByDayMap.get(dateKey) || 0) + 1);
    }
    const jobsByDayResult = Array.from(jobsByDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // Email digests
    const emailDigests = (await prisma.emailDigest.findMany({
      select: { id: true, sentAt: true, jobCount: true },
      orderBy: { sentAt: 'desc' },
      take: 1,
    })) as Array<{ id: string; sentAt: Date; jobCount: number }>;

    // Pipeline runs
    const pipelineRuns = (await prisma.pipelineRun.count({
      where: { status: { in: ['completed', 'error'] } },
    })) as number;

    // Last pipeline run
    const lastPipelineRunRow = (await prisma.pipelineRun.findFirst({
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        result: true,
        error: true,
      },
    })) as {
      id: string;
      status: string;
      startedAt: Date;
      completedAt: Date | null;
      result: unknown;
      error: string | null;
    } | null;

    // Top skills from recent 200 jobs
    const skillsJobs = sortedJobs.slice(0, 200);
    const skillCount = new Map<string, number>();
    for (const row of skillsJobs) {
      const skills = Array.isArray(row.skills) ? (row.skills as string[]) : [];
      for (const skill of skills) {
        const trimmed = skill.trim();
        if (trimmed) {
          skillCount.set(trimmed, (skillCount.get(trimmed) || 0) + 1);
        }
      }
    }
    const topSkills = Array.from(skillCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([skill, count]) => ({ skill, count }));

    const lastDigest = Array.isArray(emailDigests) ? emailDigests[0] : undefined;

    // Compute trend: compare last 7 days vs previous 7 days
    const last7 = jobsByDayResult
      .filter((d) => {
        const date = new Date(d.date);
        return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      })
      .reduce((sum, d) => sum + d.count, 0);
    const prev7 = jobsByDayResult
      .filter((d) => {
        const date = new Date(d.date);
        return (
          date >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) &&
          date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        );
      })
      .reduce((sum, d) => sum + d.count, 0);
    const jobTrend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0;

    // Format recent matches
    const recentMatches = recentJobRows.map((job) => {
      const jobSkills = Array.isArray(job.skills) ? (job.skills as string[]) : [];
      return {
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description || '',
          url: job.url,
          salary: job.salary,
          postedAt: job.postedAt?.toISOString() || null,
          scrapedAt: job.scrapedAt.toISOString(),
          skills: jobSkills,
          category: job.category,
        },
        score: {
          overall: 0,
          skillMatch: 0,
          interestMatch: 0,
          locationMatch: 0,
          salaryMatch: 0,
          matchedSkills: [] as string[],
          explanation: 'Visita la página de resultados para ver scores detallados.',
        },
      };
    });

    // Format last pipeline run
    const formattedLastRun = lastPipelineRunRow
      ? {
          id: lastPipelineRunRow.id,
          status: lastPipelineRunRow.status,
          startedAt: lastPipelineRunRow.startedAt.toISOString(),
          completedAt: lastPipelineRunRow.completedAt?.toISOString() || null,
          scraped: ((lastPipelineRunRow.result as Record<string, unknown>)?.scraped as number) || 0,
          matched: ((lastPipelineRunRow.result as Record<string, unknown>)?.matched as number) || 0,
          saved: ((lastPipelineRunRow.result as Record<string, unknown>)?.saved as number) || 0,
          error: lastPipelineRunRow.error || null,
        }
      : lastDigest
        ? {
            id: lastDigest.id,
            status: 'completed',
            startedAt: lastDigest.sentAt.toISOString(),
            completedAt: lastDigest.sentAt.toISOString(),
            scraped: lastDigest.jobCount,
            matched: 0,
            saved: 0,
            error: null,
          }
        : null;

    return NextResponse.json({
      totalJobs,
      totalJobsToday: Number(totalJobsToday),
      totalMatches: Math.min(totalJobs, 100),
      totalProfiles,
      pipelinesRun: pipelineRuns,
      jobTrend,
      jobsByDay: jobsByDayResult,
      topSkills,
      recentMatches,
      lastPipelineRun: formattedLastRun,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        totalJobs: 0,
        totalJobsToday: 0,
        totalMatches: 0,
        totalProfiles: 0,
        pipelinesRun: 0,
        jobTrend: 0,
        jobsByDay: [],
        topSkills: [],
        recentMatches: [],
        lastPipelineRun: null,
      },
      { status: 500 },
    );
  }
}
