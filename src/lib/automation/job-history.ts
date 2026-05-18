import type { Job } from '../../types/job';
import { prisma } from '../../lib/prisma';

/**
 * Save new jobs to the database, skipping any that already exist by URL
 * @param jobs Array of jobs to save
 * @returns Array of DB IDs for the saved jobs
 */
export async function saveNewJobs(jobs: Job[]): Promise<string[]> {
  try {
    if (jobs.length === 0) return [];

    await prisma.job.createMany({
      data: jobs.map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location ?? null,
        description: j.description ?? null,
        url: j.url,
        salary: typeof j.salary === 'number' ? j.salary : null,
        postedAt: j.postedAt ?? null,
        scrapedAt: j.scrapedAt ?? new Date(),
        skills: j.skills ?? [],
        category: j.category ?? null,
      })),
      skipDuplicates: true,
    });

    // Query back to get the DB-generated UUIDs
    const created = await prisma.job.findMany({
      where: { url: { in: jobs.map((j) => j.url) } },
      select: { id: true },
    });

    return created.map((j) => j.id);
  } catch (error) {
    console.error('Error saving new jobs:', error);
    return [];
  }
}

/**
 * Filter jobs to only include new jobs (not already in database or already emailed)
 * @param jobs Array of jobs to filter
 * @returns Array of new jobs that haven't been emailed
 */
export async function filterNewJobs(jobs: Job[]): Promise<Job[]> {
  try {
    if (jobs.length === 0) return [];

    const existingUrls = await prisma.job.findMany({
      where: {
        url: { in: jobs.map((j) => j.url) },
      },
      select: { url: true, emailedAt: true },
    });

    const emailedUrlSet = new Set(
      existingUrls.filter((j) => j.emailedAt !== null).map((j) => j.url),
    );
    const existingUrlSet = new Set(existingUrls.map((j) => j.url));

    return jobs.filter((job) => {
      if (existingUrlSet.has(job.url)) {
        return !emailedUrlSet.has(job.url);
      }
      return true;
    });
  } catch (error) {
    console.error('Error filtering jobs:', error);
    return jobs;
  }
}

/**
 * Mark jobs as emailed by setting emailedAt timestamp
 * @param jobIds Array of job IDs to mark as emailed
 * @returns Number of jobs updated
 */
export async function markJobsAsEmailed(jobIds: string[]): Promise<number> {
  try {
    if (jobIds.length === 0) return 0;

    const result = await prisma.job.updateMany({
      where: { id: { in: jobIds } },
      data: { emailedAt: new Date() },
    });

    return result.count;
  } catch (error) {
    console.error('Error marking jobs as emailed:', error);
    return 0;
  }
}

/**
 * Clean up old jobs beyond retention period
 * @param retentionMonths Number of months to retain jobs (default: 3)
 * @returns Number of jobs deleted
 */
export async function cleanupOldJobs(retentionMonths: number = 3): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);

    const result = await prisma.job.deleteMany({
      where: {
        scrapedAt: { lt: cutoffDate },
      },
    });

    return result.count;
  } catch (error) {
    console.error('Error cleaning up old jobs:', error);
    return 0;
  }
}

/**
 * Delete jobs that were emailed more than N days ago, keeping DB lean
 * @param retentionDays Days to retain emailed jobs (default: 7)
 * @returns Number of jobs deleted
 */
export async function cleanupEmailedJobs(retentionDays: number = 7): Promise<number> {
  try {
    if (retentionDays <= 0) {
      const result = await prisma.job.deleteMany({
        where: { emailedAt: { not: null } },
      });
      return result.count;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.job.deleteMany({
      where: {
        emailedAt: { not: null, lt: cutoffDate },
      },
    });

    return result.count;
  } catch (error) {
    console.error('Error cleaning up emailed jobs:', error);
    return 0;
  }
}
