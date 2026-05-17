import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Run queries in parallel
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const results = await Promise.all([
      // Total jobs in the last 30 days
      prisma.job.count({
        where: { scrapedAt: { gte: thirtyDaysAgo } },
      }),

      // Today's jobs
      prisma.job.count({
        where: { scrapedAt: { gte: todayStart } },
      }),

      // Total user profiles
      prisma.userProfile.count(),

      // Recent jobs (last 5)
      prisma.job.findMany({
        take: 5,
        orderBy: { scrapedAt: "desc" },
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          url: true,
          salary: true,
          scrapedAt: true,
          skills: true,
          description: true,
          postedAt: true,
          category: true,
        },
      }),

      // Jobs grouped by day for the chart
      prisma.$queryRaw<
        Array<{ date: Date; count: bigint }>
      >`
        SELECT
          DATE(scraped_at) as date,
          COUNT(*) as count
        FROM "Job"
        WHERE scraped_at >= ${thirtyDaysAgo}
        GROUP BY DATE(scraped_at)
        ORDER BY date ASC
      `,

      // Email digests
      prisma.emailDigest.findMany({
        select: { id: true, sentAt: true, jobCount: true },
        orderBy: { sentAt: "desc" },
        take: 1,
      }),

      // Total pipeline runs (completed + error)
      prisma.pipelineRun.count({
        where: { status: { in: ["completed", "error"] } },
      }),

      // Last pipeline run
      prisma.pipelineRun.findFirst({
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          result: true,
          error: true,
        },
      }),

      // Top skills aggregated from recent 200 jobs
      prisma.job.findMany({
        take: 200,
        orderBy: { scrapedAt: "desc" },
        select: { skills: true },
      }),    ]);

    const totalJobs = results[0] as number;
    const totalJobsToday = results[1] as number;
    const totalProfiles = results[2] as number;
    const recentJobRows = results[3] as Array<{
      id: string;
      title: string;
      company: string;
      location: string | null;
      description: string | null;
      url: string;
      salary: number | null;
      postedAt: Date | null;
      scrapedAt: Date;
      skills: unknown;
      category: string | null;
    }>;
    const jobsByDayResult = results[4] as Array<{ date: Date; count: bigint }>;
    const emailDigests = results[5] as Array<{ id: string; sentAt: Date; jobCount: number }>;
    const pipelineRuns = results[6] as number;
    const lastPipelineRunRow = results[7] as {
      id: string;
      status: string;
      startedAt: Date;
      completedAt: Date | null;
      result: unknown;
      error: string | null;
    } | null;
    const skillsResult = results[8] as Array<{ skills: string[] }>;

    const lastDigest = emailDigests[0];

    // Compute top skills from job records
    const skillCount = new Map<string, number>();
    for (const row of skillsResult) {
      const skills = Array.isArray(row.skills)
        ? (row.skills as string[])
        : [];
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

    // Format jobs by day
    const jobsByDay = (jobsByDayResult as Array<{ date: Date; count: bigint }>).map(
      (row: { date: Date; count: bigint }) => ({
        date: row.date.toISOString().split("T")[0],
        count: Number(row.count),
      })
    );

    // Compute trend: compare last 7 days vs previous 7 days
    const last7 = jobsByDay
      .filter((d) => {
        const date = new Date(d.date);
        return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      })
      .reduce((sum, d) => sum + d.count, 0);
    const prev7 = jobsByDay
      .filter((d) => {
        const date = new Date(d.date);
        return (
          date >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) &&
          date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        );
      })
      .reduce((sum, d) => sum + d.count, 0);
    const jobTrend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : last7 > 0 ? 100 : 0;

    // Format recent matches — try to estimate scores from skills overlap
    const recentMatches = recentJobRows.map((job: { id: string; title: string; company: string; location: string | null; description: string | null; url: string; salary: number | null; postedAt: Date | null; scrapedAt: Date; skills: unknown; category: string | null; }) => {
      const jobSkills = Array.isArray(job.skills)
        ? (job.skills as string[])
        : [];
      return {
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description || "",
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
          explanation:
            "Visita la página de resultados para ver scores detallados.",
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
          scraped: (lastPipelineRunRow.result as any)?.scraped || 0,
          matched: (lastPipelineRunRow.result as any)?.matched || 0,
          saved: (lastPipelineRunRow.result as any)?.saved || 0,
          error: lastPipelineRunRow.error || null,
        }
      : lastDigest
        ? {
            id: lastDigest.id,
            status: "completed",
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
      jobsByDay,
      topSkills,
      recentMatches,
      lastPipelineRun: formattedLastRun,
    });
  } catch (error) {
    console.error("Stats API error:", error);
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
      { status: 500 }
    );
  }
}
