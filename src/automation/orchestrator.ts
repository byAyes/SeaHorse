import { logger } from '../lib/automation/logger';
import {
  filterNewJobs,
  saveNewJobs,
  markJobsAsEmailed,
  cleanupEmailedJobs,
  cleanupOldJobs,
} from '../lib/automation/job-history';
import { formatJobDigest } from '../lib/email/template';
import type { ProfileInfo } from '../lib/email/template';
import { sendEmail } from '../lib/email';
import { ScraperRunner } from '../scrapers/index';
import type { Job as ScrapedJob, ScraperStats } from '../scrapers/types';
import { calculateMatchScore } from '../matching/scorer';
import { analyzeJob, isValidJobUrl } from '../matching/jobAnalyzer';
import type { UserProfile, ExperienceLevel } from '../types/user-profile';
import type { Job } from '../types/job';

/**
 * Extended scraped job type with optional fields
 * Some scrapers provide salary/skills/category, others don't.
 */
interface ScrapedJobWithMeta extends ScrapedJob {
  salary?: number | null;
  skills?: string[];
  category?: string | null;
  postedAt?: string | number | Date | null;
}

/**
 * Convert scraped job to database job format with enrichment:
 * - Extracts skills, category, and salary from description when missing
 * - Validates job URLs
 */
function convertToDbJob(scraped: ScrapedJob): DbJob | null {
  // Filter out jobs with invalid/empty URLs
  if (!isValidJobUrl(scraped.link)) {
    logger.warning(`Filtered job "${scraped.title}" at ${scraped.company}: invalid URL`);
    return null;
  }

  // Extended scraped data (some scrapers provide extra fields)
  const ext = scraped as ScrapedJobWithMeta;
  const scrapedSalary = ext.salary ?? null;
  const scrapedSkills = ext.skills ?? [];
  const scrapedCategory = ext.category ?? null;
  const scrapedPostedAt = ext.postedAt ?? null;
  const postedAt: Date | null = scrapedPostedAt instanceof Date
    ? scrapedPostedAt
    : scrapedPostedAt
      ? new Date(scrapedPostedAt)
      : null;

  // Analyze description to enrich missing fields
  const analysis = analyzeJob(scraped.title, scraped.description || null);

  // Use scraped data if available, fall back to analysis
  const skills = Array.isArray(scrapedSkills) && scrapedSkills.length > 0
    ? scrapedSkills
    : analysis.skills;
  const category = scrapedCategory || analysis.category;
  const salary = scrapedSalary ?? analysis.salary;

  return {
    id: scraped.id,
    title: scraped.title,
    company: scraped.company,
    location: scraped.location || null,
    description: scraped.description || null,
    url: scraped.link,
    salary,
    postedAt,
    scrapedAt: scraped.scrapedAt,
    skills,
    category,
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
  salary: number | null;
  postedAt: Date | null;
  scrapedAt: Date;
  skills: string[];
  category: string | null;
}

function filterByDate(jobs: DbJob[], days: number = 3): DbJob[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return jobs.filter((job) => {
    // If job has postedAt, use it
    if (job.postedAt) {
      const postedDate = new Date(job.postedAt as string | number | Date);
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
 * 5. Mark jobs as emailed (with DB UUIDs)
 * 6. Clean up emailed jobs older than 7 days
 * 7. Safety net: clean up any jobs older than 1 month
 *
 * @param profile Optional extracted CV profile for email personalization
 */
export async function executePipeline(profile?: ProfileInfo): Promise<PipelineResult> {
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

    // Convert scraped jobs to database format (filters out invalid URLs)
    const allJobs = scrapedJobs.map(convertToDbJob).filter(Boolean) as DbJob[];

    const filteredCount = scrapedJobs.length - allJobs.length;
    result.scraped = allJobs.length;
    logger.success(`Scraped ${allJobs.length} jobs from all boards${filteredCount > 0 ? ` (${filteredCount} filtered out for invalid URLs)` : ''}`);

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

    // Step 2.5: Persist new jobs to database
    let savedIds: string[] = [];
    if (newJobs.length > 0) {
      logger.info('Persisting new jobs to database...');
      savedIds = await saveNewJobs(newJobs);
      logger.info(`Saved ${savedIds.length} jobs to database`);
    }

    // Build user profile for matching (if profile extracted)
    let userProfile: UserProfile | null = null;
    if (profile) {
      userProfile = {
        id: 'extracted-profile',
        userId: 'extracted',
        createdAt: new Date(),
        updatedAt: new Date(),
        skills: profile.skills || [],
        interests: profile.jobTitles || [],
        location: profile.locations?.[0] || null,
        remoteOnly:
          (profile.locations || []).some(
            (l) => l.toLowerCase().includes('remoto') || l.toLowerCase().includes('remote'),
          ) || false,
        experienceLevel: (profile.experienceLevel as ExperienceLevel) || null,
        minSalary: null,
        maxSalary: null,
        skillWeight: 0.4,
        interestWeight: 0.3,
        locationWeight: 0.2,
        salaryWeight: 0.1,
        summary: null,
        languages: [],
        jobTitles: [],
        industries: [],
        education: [],
      };
      logger.info(
        `Building profile for matching: ${profile.skills?.length || 0} skills, ${profile.jobTitles?.length || 0} target roles`,
      );
    }

    // Step 3: Send email digest if there are jobs
    if (newJobs.length > 0) {
      logger.info('Sending email digest...');

      // Calculate real match scores from profile
      const scoredJobs = newJobs.map((job) => {
        if (userProfile) {
          const matchScore = calculateMatchScore(userProfile, job as Job);
          return {
            job,
            score: Math.round(matchScore.overall),
            matchedSkills: matchScore.matchedSkills,
          };
        }
        // No profile — keep neutral scoring
        return {
          job,
          score: 100,
          matchedSkills: [],
        };
      });

      logger.info(
        `Match scores calculated: ${scoredJobs.filter((j) => j.score >= 80).length} excellent, ${scoredJobs.filter((j) => j.score >= 60 && j.score < 80).length} good, ${scoredJobs.filter((j) => j.score < 60).length} potential`,
      );

      const { text, html } = formatJobDigest(
        scoredJobs,
        new Date().toISOString(),
        profile, // Pass profile for personalized email header
      );

      const emailResult = await sendEmail(
        process.env.GMAIL_RECIPIENT || '',
        `Weekly Job Digest - ${new Date().toLocaleDateString()}`,
        text,
        undefined, // from (default)
        html, // html body
        process.env.EMAIL_CC || undefined, // CC (optional, via EMAIL_CC env var)
      );

      if (emailResult.success) {
        result.sent = newJobs.length;
        logger.success(
          `Sent email with ${result.sent} jobs${process.env.EMAIL_CC ? ` (CC: ${process.env.EMAIL_CC})` : ''}`,
        );

        // Step 4: Mark jobs as emailed (use DB UUIDs; fallback to scraper IDs if persist failed)
        const idsToMark = savedIds.length > 0 ? savedIds : newJobs.map((job) => job.id);
        await markJobsAsEmailed(idsToMark);
      } else {
        logger.error('Failed to send email', new Error(emailResult.error));
      }
    } else {
      logger.info('No new jobs to send');
    }

    // Step 5: Clean up emailed jobs older than 7 days to keep DB lean
    logger.info('Running DB cleanup (emailed >7d + orphaned >1mo)...');
    const cleaned = await cleanupEmailedJobs(7);

    // Safety net: clean up any jobs (emailed or not) older than 1 month
    const oldCleaned = await cleanupOldJobs(1);
    result.cleaned = cleaned + oldCleaned;
    logger.info(
      `Cleaned up ${result.cleaned} old jobs (${cleaned} emailed, ${oldCleaned} orphaned)`,
    );

    return result;
  } catch (error) {
    logger.error('Pipeline execution failed', error instanceof Error ? error : undefined);
    throw error;
  }
}
