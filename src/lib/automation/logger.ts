/**
 * Logger utility optimized for GitHub Actions
 * Detects if running in GitHub Actions and uses workflow commands
 */

const isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);

/**
 * Format timestamp for logs
 */
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Log info message
 */
export function info(message: string, data?: unknown): void {
  const logMessage = `[${timestamp()}] INFO: ${message}`;

  if (isGitHubActions) {
    console.log(`::notice ::${logMessage}`);
  } else {
    console.log(logMessage);
  }

  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Log error message
 */
export function error(message: string, err?: Error): void {
  const logMessage = `[${timestamp()}] ERROR: ${message}`;

  if (isGitHubActions) {
    console.log(`::error ::${logMessage}`);
  } else {
    console.error(logMessage);
  }

  if (err) {
    console.error('Stack:', err.stack);
  }
}

/**
 * Log success message
 */
export function success(message: string): void {
  const logMessage = `[${timestamp()}] ✓ ${message}`;

  if (isGitHubActions) {
    console.log(`::notice ::${logMessage}`);
  } else {
    console.log(logMessage);
  }
}

/**
 * Log warning message
 */
export function warning(message: string): void {
  const logMessage = `[${timestamp()}] ⚠ ${message}`;

  if (isGitHubActions) {
    console.log(`::warning ::${logMessage}`);
  } else {
    console.warn(logMessage);
  }
}

/**
 * Log a per-scraper stats line
 * Used by orchestrator to show scraper results
 */
export function scraperStat(
  scraper: string,
  success: boolean,
  jobCount: number,
  duration: number,
  error?: string,
): void {
  const status = success ? '✓' : '✗';
  const time = (duration / 1000).toFixed(1);
  const line = `[${timestamp()}] ${status} ${scraper}: ${jobCount} jobs in ${time}s${error ? ` — ${error}` : ''}`;

  if (isGitHubActions) {
    if (success) {
      console.log(`::notice ::${line}`);
    } else {
      console.log(`::error ::${line}`);
    }
  } else {
    if (success) {
      console.log(line);
    } else {
      console.error(line);
    }
  }
}

/**
 * Log a summary table of all scraper results
 */
export function scraperSummary(
  stats: Array<{
    scraper: string;
    success: boolean;
    jobCount: number;
    duration: number;
    error?: string;
  }>,
): void {
  const totalJobs = stats.reduce((sum, s) => sum + s.jobCount, 0);
  const totalTime = stats.reduce((sum, s) => sum + s.duration, 0);
  const failed = stats.filter((s) => !s.success).length;

  info('━━━ Scraper Summary ━━━');
  for (const s of stats) {
    scraperStat(s.scraper, s.success, s.jobCount, s.duration, s.error);
  }
  info(
    `━━━ Total: ${totalJobs} jobs from ${stats.length} scrapers (${failed} failed) in ${(totalTime / 1000).toFixed(1)}s ━━━`,
  );
}

/**
 * Logger object with all methods
 */
export const logger = {
  info,
  error,
  success,
  warning,
  scraperStat,
  scraperSummary,
};

export default logger;
