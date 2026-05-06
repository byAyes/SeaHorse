import { logger } from '../lib/automation/logger';
import { filterNewJobs, markJobsAsEmailed, cleanupOldJobs } from '../lib/automation/job-history';
import { formatJobDigest } from '../lib/email/template';
import { sendEmail } from '../lib/email';
import { ScraperRunner } from '../scrapers/index';
import type { Job as ScrapedJob, ScraperStats } from '../scrapers/types';

/**
 * Convert scraped job to database job format
 */
function convertToDbJob(scraped: ScrapedJob) {
  const scrapedSalary = (scraped as any).salary ?? null;
  const scrapedSkills = (scraped as any).skills ?? [];
  const scrapedCategory = (scraped as any).category ?? null;
  const scrapedPostedAt = (scraped as any).postedAt ?? null;

  return {
    id: scraped.id,
    title: scraped.title,
    company: scraped.company,
    location: scraped.location || null,
    description: scraped.description || null,
    url: scraped.link,
    salary: scrapedSalary,
    postedAt: scrapedPostedAt,
    scrapedAt: scraped.scrapedAt,
    skills: Array.isArray(scrapedSkills) ? scrapedSkills : [],
    category: scrapedCategory,
  };
}

/**
 * Filter jobs from the last N days
 * @param jobs - Array of jobs to filter
 * @param days - Number of days (default: 3)
 * @returns Jobs from the last N days
 */
interface DbJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string;
  salary: any;
  postedAt: any;
  scrapedAt: Date;
  skills: string[];
  category: string | null;
}

function filterByDate(jobs: DbJob[], days: number = 3): DbJob[] {
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - days);

return jobs.filter(job => {
// If job has postedAt, use it
if (job.postedAt) {
const postedDate = new Date(job.postedAt);
return postedDate >= cutoffDate;
}
// If no date, include it (assume recent)
return true;
});
}

/**
 * Pipeline execution result
 */
interface PipelineResult {
  scraped: number;
  matched: number;
  sent: number;
  cleaned: number;
  scraperStats: ScraperStats[];
}

/**
 * Execute the full automation pipeline:
 * 1. Scrape all job boards
 * 2. Filter for new jobs
 * 3. Match jobs against user profile
 * 4. Send email digest
 * 5. Mark jobs as emailed
 * 6. Clean up old jobs
 */
export async function executePipeline(): Promise<PipelineResult> {
  const result: PipelineResult = {
    scraped: 0,
    matched: 0,
    sent: 0,
    cleaned: 0,
    scraperStats: [],
  };

  try {
    // Step 1: Scrape job boards
    logger.info('Starting job scraping...');
    
    // Run scrapers from all job boards
    const query = process.env.JOB_QUERY || 'software engineer';
    const maxJobs = parseInt(process.env.MAX_JOBS_PER_SCRAPER || '10', 10);
    
  logger.info(`Scraping job boards for: "${query}" (max ${maxJobs} jobs per board)`);

  const runner = new ScraperRunner({ query, maxJobs });
  const scrapedJobs = await runner.runAllScrapers();

  // Capture per-scraper stats
  result.scraperStats = runner.getStats();
  logger.scraperSummary(result.scraperStats);

  // Convert scraped jobs to database format
    const allJobs = scrapedJobs.map(convertToDbJob);
    
result.scraped = allJobs.length;
logger.success(`Scraped ${allJobs.length} jobs from all boards`);

// Step 1.5: Filter jobs from last 3 days
const daysBack = parseInt(process.env.JOB_DAYS_FILTER || '3', 10);
logger.info(`Filtering jobs from last ${daysBack} days...`);
const recentJobs = filterByDate(allJobs, daysBack);
logger.info(`Found ${recentJobs.length} jobs from last ${daysBack} days`);

// Step 2: Filter for new jobs (not already emailed)
logger.info('Filtering for new jobs...');
const newJobs = await filterNewJobs(recentJobs);
result.matched = newJobs.length;
logger.info(`Found ${newJobs.length} new jobs`);

    // Step 3: Send email digest if there are jobs
    if (newJobs.length > 0) {
      logger.info('Sending email digest...');
      const digest = formatJobDigest(
        newJobs.map(job => ({
          job,
          score: 100, // TODO: Calculate actual match score
          matchedSkills: [],
        })),
        new Date().toISOString()
      );

      const emailResult = await sendEmail(
        process.env.GMAIL_RECIPIENT || '',
        `Weekly Job Digest - ${new Date().toLocaleDateString()}`,
        digest
      );

      if (emailResult.success) {
        result.sent = newJobs.length;
        logger.success(`Sent email with ${result.sent} jobs`);
        
        // Step 4: Mark jobs as emailed
        await markJobsAsEmailed(newJobs.map(job => job.id));
      } else {
        logger.error('Failed to send email', new Error(emailResult.error));
      }
    } else {
      logger.info('No new jobs to send');
    }

    // Step 5: Clean up old jobs
    logger.info('Cleaning up old jobs...');
    result.cleaned = await cleanupOldJobs(3); // 3 months retention

    return result;
  } catch (error) {
    logger.error('Pipeline execution failed', error instanceof Error ? error : undefined);
    throw error;
  }
}
