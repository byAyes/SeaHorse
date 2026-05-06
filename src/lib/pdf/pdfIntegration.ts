/**
 * PDF Integration with matching and email workflow
 * Integrates PDF-extracted jobs with existing job matching algorithm and email notification workflow
 */

import { scoreAndSortJobs } from '../../matching/scorer';
import { formatJobDigest } from '../email/template';
import { ExtractedJob } from '../../types/pdf';
import { Job } from '../../types/job';
import { MatchedJob } from '../../types/job-match';
import { UserProfile } from '../../types/user-profile';
import { prisma } from '../prisma';

/**
 * Convert ExtractedJob to Job format
 * Adds default fields required by the Job interface
 * @param extracted - Extracted job from PDF
 * @param index - Index for generating unique ID
 * @returns Job object compatible with existing scoring system
 */
function convertToJob(extracted: ExtractedJob, index: number): Job {
  return {
    id: `pdf-${index}-${Date.now()}-${extracted.title.toLowerCase().replace(/\s+/g, '-')}`,
    title: extracted.title,
    company: extracted.company,
    location: extracted.location || null,
    description: extracted.description,
    url: extracted.url || `#${extracted.title.toLowerCase().replace(/\s+/g, '-')}`,
    salary: null,
    postedAt: new Date(),
    scrapedAt: new Date(),
    skills: extracted.requirements || [],
    category: null
  };
}

/**
 * Match PDF-extracted jobs against user profile
 * Uses existing scoring system from scorer.ts
 * @param jobs - Array of extracted jobs from PDF
 * @param userId - User ID to match against
 * @param threshold - Minimum match score threshold (default 70)
 * @returns Array of matched jobs sorted by score descending
 */
export async function matchPDFJobs(
  jobs: ExtractedJob[],
  userId: string,
  threshold: number = 70
): Promise<MatchedJob[]> {
  // Fetch user profile from database
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId }
  });

  if (!userProfile) {
    throw new Error(`User profile not found for userId: ${userId}`);
  }

  // Convert user profile to UserProfile type
  const profile: UserProfile = {
    id: userProfile.id,
    userId: userProfile.userId,
    createdAt: userProfile.createdAt,
    updatedAt: userProfile.updatedAt,
    skills: userProfile.skills,
    interests: userProfile.interests,
    location: userProfile.location,
    remoteOnly: userProfile.remoteOnly,
    experienceLevel: userProfile.experienceLevel as any,
    minSalary: userProfile.minSalary,
    maxSalary: userProfile.maxSalary,
    skillWeight: userProfile.skillWeight,
    interestWeight: userProfile.interestWeight,
    locationWeight: userProfile.locationWeight,
    salaryWeight: userProfile.salaryWeight
  };

  // Convert extracted jobs to Job format
  const jobList: Job[] = jobs.map((job, index) => convertToJob(job, index));

  // Use existing scoring system
  const matchedJobs = scoreAndSortJobs(jobList, profile, threshold);

  return matchedJobs;
}

/**
 * Prepare PDF jobs for email digest workflow
 * Groups PDF jobs and marks them for email inclusion
 * @param jobs - Array of matched PDF jobs
 * @returns Formatted email digest string
 */
export async function preparePDFJobsForEmail(
  jobs: MatchedJob[]
): Promise<string> {
  if (!jobs || jobs.length === 0) {
    return formatJobDigest([], new Date().toISOString());
  }

  // Convert MatchedJob[] to format expected by formatJobDigest
  const digestJobs = jobs.map(matched => ({
    job: matched.job,
    score: matched.score.overall,
    matchedSkills: matched.score.matchedSkills
  }));

  // Format using existing email template
  const emailBody = formatJobDigest(digestJobs, new Date().toISOString());

  return emailBody;
}

/**
 * Get all PDF-sourced jobs from database
 * Filters jobs by source marker or emailDigestId
 * @param userId - User ID to filter by
 * @returns Array of PDF-sourced jobs
 */
export async function getPDFJobs(userId: string): Promise<Job[]> {
  try {
    // Fetch jobs associated with user's email digests
    const userDigests = await prisma.emailDigest.findMany({
      where: {
        jobs: {
          some: {
            // Filter jobs that have PDF marker in description or URL
            description: {
              contains: 'PDF-extracted'
            }
          }
        }
      },
      include: {
        jobs: true
      }
    });

    // Flatten and deduplicate jobs
    const jobSet = new Set<string>();
    const pdfJobs: Job[] = [];

    userDigests.forEach((digest: any) => {
      digest.jobs.forEach((job: any) => {
        if (!jobSet.has(job.id)) {
          jobSet.add(job.id);
          pdfJobs.push({
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            url: job.url,
            salary: job.salary,
            postedAt: job.postedAt,
            scrapedAt: job.scrapedAt,
            skills: job.skills,
            category: job.category
          });
        }
      });
    });

    return pdfJobs;
  } catch (error) {
    console.error('Error fetching PDF jobs:', error);
    return [];
  }
}

/**
 * Save matched PDF jobs to database
 * Associates matched jobs with email digest workflow
 * @param matchedJobs - Array of matched PDF jobs to save
 * @param userId - User ID for tracking
 */
export async function savePDFMatches(
  matchedJobs: MatchedJob[],
  userId: string
): Promise<void> {
  try {
    // Create or update email digest for these matches
    const digest = await prisma.emailDigest.create({
      data: {
        sentAt: new Date(),
        jobCount: matchedJobs.length,
        jobs: {
          create: matchedJobs.map(match => ({
            title: match.job.title,
            company: match.job.company,
            location: match.job.location,
            description: `PDF-extracted job - Match: ${match.score.overall}%`,
            url: match.job.url,
            salary: match.job.salary,
            postedAt: match.job.postedAt,
            scrapedAt: new Date(),
            skills: match.job.skills,
            category: match.job.category
          }))
        }
      }
    });

    console.log(`Saved ${matchedJobs.length} PDF matches to digest ${digest.id}`);
  } catch (error) {
    console.error('Error saving PDF matches:', error);
    throw error;
  }
}
