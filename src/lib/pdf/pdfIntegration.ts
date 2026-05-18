import { prisma } from '../prisma';
import { formatJobDigest } from '../email/template';
import { logger } from '../automation/logger';
import type { MatchedJob } from '../../types/job-match';

export interface PDFJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string;
  salary: number | null;
  postedAt: Date | null;
}

/**
 * Process PDF-extracted jobs for the matching pipeline
 * @param jobs - Array of extracted PDF jobs
 * @returns Array of matched jobs with scores
 */
export async function processPDFJobs(jobs: PDFJob[]): Promise<MatchedJob[]> {
  if (!jobs || jobs.length === 0) {
    return [];
  }

  logger.info(`Processing ${jobs.length} PDF jobs for matching`);

  // Get user profile for matching
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId: 'default' },
  });

  if (!userProfile) {
    logger.warning('No user profile found for PDF job matching');
    return jobs.map((job) => ({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        url: job.url,
        salary: job.salary,
        postedAt: job.postedAt,
      },
      score: {
        overall: 50,
        skillScore: 0,
        interestScore: 0,
        locationScore: 0,
        salaryScore: 0,
        matchedSkills: [],
        missingSkills: [],
      },
    }));
  }

  // Match each job against user profile
  const matchedJobs: MatchedJob[] = jobs.map((job) => {
    const jobSkills = extractSkills(job);
    const matchedSkills = userProfile.skills.filter((s) =>
      jobSkills.some((js) => js.toLowerCase().includes(s.toLowerCase())),
    );
    const missingSkills = userProfile.skills.filter(
      (s) => !jobSkills.some((js) => js.toLowerCase().includes(s.toLowerCase())),
    );

    const skillScore =
      userProfile.skills.length > 0 ? (matchedSkills.length / userProfile.skills.length) * 100 : 0;

    const overall = Math.round(skillScore * (userProfile.skillWeight || 0.4));

    return {
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        url: job.url,
        salary: job.salary,
        postedAt: job.postedAt,
      },
      score: {
        overall,
        skillScore,
        interestScore: 0,
        locationScore: 0,
        salaryScore: 0,
        matchedSkills,
        missingSkills,
      },
    };
  });

  // Sort by overall score descending
  matchedJobs.sort((a, b) => b.score.overall - a.score.overall);

  logger.success(`Matched ${matchedJobs.length} PDF jobs`);
  return matchedJobs;
}

/**
 * Prepare PDF jobs for email digest workflow
 * Groups PDF jobs and marks them for email inclusion
 * @param jobs - Array of matched PDF jobs
 * @returns Formatted email digest object with html and text
 */
export async function preparePDFJobsForEmail(
  jobs: MatchedJob[],
): Promise<{ html: string; text: string }> {
  if (!jobs || jobs.length === 0) {
    return formatJobDigest([], new Date().toISOString());
  }

  // Convert MatchedJob[] to format expected by formatJobDigest
  const digestJobs = jobs.map((matched) => ({
    job: matched.job,
    score: matched.score.overall,
    matchedSkills: matched.score.matchedSkills,
  }));

  // Format using existing email template
  const emailBody = formatJobDigest(digestJobs, new Date().toISOString());

  return emailBody;
}

/**
 * Extract skills from job description and title
 * @param job - PDF job object
 * @returns Array of extracted skill keywords
 */
function extractSkills(job: PDFJob): string[] {
  const text = [job.title, job.description || ''].join(' ').toLowerCase();
  const commonSkills = [
    'javascript',
    'typescript',
    'python',
    'java',
    'go',
    'rust',
    'react',
    'angular',
    'vue',
    'node',
    'express',
    'aws',
    'azure',
    'gcp',
    'docker',
    'kubernetes',
    'sql',
    'nosql',
    'mongodb',
    'postgresql',
    'redis',
    'git',
    'ci/cd',
    'agile',
    'scrum',
  ];
  return commonSkills.filter((skill) => text.includes(skill));
}
