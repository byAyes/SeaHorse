/**
 * Main job matching scorer
 * Combines all matching factors with weighted scoring
 */

import { calculateSkillOverlap } from './skill-matcher';
import { calculateInterestMatch } from './interest-matcher';
import { calculateLocationMatch } from './location-matcher';
import { calculateSalaryMatch } from './salary-matcher';
import { UserProfile } from '../types/user-profile';
import { Job } from '../types/job';
import { MatchScore, MatchedJob } from '../types/job-match';

/**
 * Calculate overall match score for a job against a user profile
 * @param user - User profile with preferences
 * @param job - Job to score
 * @returns MatchScore with individual and overall scores
 */
export function calculateMatchScore(user: UserProfile, job: Job): MatchScore {
  // Calculate individual scores — pass job description for fallback text matching
  const skillOverlap = calculateSkillOverlap(user.skills, job.skills, job.description);
  const skillMatch = skillOverlap.score / 100; // Normalize to 0-1

  const interestMatchRaw = calculateInterestMatch(user.interests, job.category || '') / 100;
  const locationMatchRaw =
    calculateLocationMatch(user.location, job.location || '', user.remoteOnly) / 100;
  const salaryMatchRaw = calculateSalaryMatch(user.minSalary, user.maxSalary, job.salary) / 100;

  // Weighted average using user's weights
  const overall =
    skillMatch * user.skillWeight +
    interestMatchRaw * user.interestWeight +
    locationMatchRaw * user.locationWeight +
    salaryMatchRaw * user.salaryWeight;

  // Convert back to 0-100 scale
  const overallPercent = Math.round(overall * 100) / 100;
  const skillPercent = Math.round(skillMatch * 100);
  const interestPercent = Math.round(interestMatchRaw * 100);
  const locationPercent = Math.round(locationMatchRaw * 100);
  const salaryPercent = Math.round(salaryMatchRaw * 100);

  return {
    overall: overallPercent,
    skillMatch: skillPercent,
    interestMatch: interestPercent,
    locationMatch: locationPercent,
    salaryMatch: salaryPercent,
    matchedSkills: skillOverlap.matchedSkills,
    explanation: `Overall match: ${overallPercent}% (Skills: ${skillPercent}%, Interests: ${interestPercent}%, Location: ${locationPercent}%, Salary: ${salaryPercent}%)`,
  };
}

/**
 * Score and sort jobs by match score
 * @param jobs - Array of jobs to score
 * @param user - User profile
 * @param threshold - Minimum score threshold (default 70)
 * @returns Array of matched jobs sorted by score descending
 */
export function scoreAndSortJobs(
  jobs: Job[],
  user: UserProfile,
  threshold: number = 70,
): MatchedJob[] {
  const matchedJobs: MatchedJob[] = jobs
    .map((job) => ({
      job,
      score: calculateMatchScore(user, job),
    }))
    .filter(({ score }) => score.overall >= threshold)
    .sort((a, b) => b.score.overall - a.score.overall);

  return matchedJobs;
}
