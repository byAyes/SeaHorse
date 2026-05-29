/**
 * CV-based Job Matcher
 * Matches jobs to users based on CV-extracted profile data
 */

import { prisma } from '../lib/prisma';
import { scoreAndSortJobs } from './scorer';
import { Job } from '../types/job';
import { UserProfile, ExperienceLevel } from '../types/user-profile';

/**
 * Match jobs to a user's CV profile
 * Uses the latest CV data for matching
 */
export async function matchJobsToCVProfile(jobs: Job[], cvId: string): Promise<unknown[]> {
  try {
    // Fetch CV data
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      throw new Error('CV not found');
    }

    // Build temporary UserProfile from CV data
    const cvProfile: Partial<UserProfile> = {
      skills: cv.skills,
      experienceLevel: null,
      location: null,
      remoteOnly: false,
    };

    // Parse experience to determine level
    if (cv.experience.length > 0) {
      const years = calculateYearsFromExperience(cv.experience);
      cvProfile.experienceLevel = inferExperienceLevel(years);
    }

    // Get full user profile for weights
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: cv.userId },
    });

    // Merge CV data with user profile
    const profile: UserProfile = {
      id: userProfile?.id || 'cv-profile',
      userId: cv.userId,
      createdAt: userProfile?.createdAt ?? new Date(),
      updatedAt: userProfile?.updatedAt ?? new Date(),
      skills: cvProfile.skills || [],
      interests: userProfile?.interests || [],
      location: cvProfile.location || userProfile?.location || null,
      remoteOnly: userProfile?.remoteOnly || false,
      experienceLevel: (cvProfile.experienceLevel ||
        userProfile?.experienceLevel ||
        null) as ExperienceLevel | null,
      minSalary: userProfile?.minSalary || null,
      maxSalary: userProfile?.maxSalary || null,
      skillWeight: userProfile?.skillWeight || 0.4,
      interestWeight: userProfile?.interestWeight || 0.3,
      locationWeight: userProfile?.locationWeight || 0.2,
      salaryWeight: userProfile?.salaryWeight || 0.1,
      summary: userProfile?.summary || null,
      languages: userProfile?.languages || [],
      jobTitles: userProfile?.jobTitles || [],
      industries: userProfile?.industries || [],
      education: userProfile?.education || [],
    };

    // Use existing scoring function
    const matchedJobs = scoreAndSortJobs(jobs, profile);

    return matchedJobs;
  } catch (error) {
    console.error('Error matching jobs to CV:', error);
    return [];
  }
}

/**
 * Calculate years of experience from CV experience array
 */
function calculateYearsFromExperience(experience: string[]): number {
  let totalYears = 0;

  for (const expStr of experience) {
    try {
      const exp = JSON.parse(expStr);
      if (exp.duration) {
        const yearMatch = exp.duration.match(/\d{4}/g);
        if (yearMatch && yearMatch.length >= 2) {
          const startYear = parseInt(yearMatch[0]);
          const endYear = parseInt(yearMatch[1]);
          if (!isNaN(startYear) && !isNaN(endYear)) {
            totalYears += Math.max(0, endYear - startYear);
          }
        }
      }
    } catch {
      // Skip invalid entries
    }
  }

  return totalYears;
}

/**
 * Infer experience level from years
 */
function inferExperienceLevel(years: number): ExperienceLevel {
  if (years < 2) {
    return 'junior';
  } else if (years < 5) {
    return 'mid';
  } else if (years < 10) {
    return 'senior';
  } else {
    return 'lead';
  }
}
