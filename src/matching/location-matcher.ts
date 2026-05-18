/**
 * Location matching utilities for job matching system
 * Matches user location preferences against job location
 */

/**
 * Calculate location match between user preference and job location
 * @param userLocation - User's preferred location (null if no preference)
 * @param jobLocation - Job's location
 * @param remoteOnly - Whether user only wants remote jobs
 * @returns Score from 0-100
 */
export function calculateLocationMatch(
  userLocation: string | null,
  jobLocation: string,
  remoteOnly: boolean,
): number {
  const jobLower = jobLocation.toLowerCase();
  const isRemoteJob = jobLower.includes('remote') || jobLower.includes('remoto');

  if (remoteOnly) {
    return isRemoteJob ? 100 : 0;
  }

  if (!userLocation) {
    return 100;
  }

  const userLower = userLocation.toLowerCase();

  if (userLower === jobLower) {
    return 100;
  }

  if (jobLower.includes(userLower) || userLower.includes(jobLower)) {
    return 80;
  }

  const userCity = userLower.split(',')[0].trim();
  const jobCity = jobLower.split(',')[0].trim();
  if (userCity && jobCity && (jobLower.includes(userCity) || userLower.includes(jobCity))) {
    return 70;
  }

  if (isRemoteJob) {
    return 50;
  }

  return 0;
}
