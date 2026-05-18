/**
 * Interest matching utilities for job matching system
 * Matches user interests against job categories
 */

/**
 * Calculate interest match between user interests and job category
 * @param userInterests - Array of user's interests
 * @param jobCategory - Job's category
 * @returns Score from 0-100
 */
export function calculateInterestMatch(userInterests: string[], jobCategory: string): number {
  if (!jobCategory || userInterests.length === 0) {
    return 100;
  }

  const normalizedCategory = jobCategory.toLowerCase().trim();

  let bestScore = 0;

  for (const interest of userInterests) {
    const normalizedInterest = interest.toLowerCase().trim();

    if (normalizedInterest === normalizedCategory) {
      return 100;
    }

    if (
      normalizedInterest.includes(normalizedCategory) ||
      normalizedCategory.includes(normalizedInterest)
    ) {
      const shorterLen = Math.min(normalizedInterest.length, normalizedCategory.length);
      const longerLen = Math.max(normalizedInterest.length, normalizedCategory.length);
      const overlapRatio = shorterLen / longerLen;
      const score = Math.round(50 + 50 * overlapRatio);
      if (score > bestScore) bestScore = score;
    }
  }

  return bestScore;
}
