import { Job, ScraperConfig, PythonScraperConfig, ScraperStats } from './types';
import { rateLimiter } from './utils/rateLimiter';
import { JSearchScraper } from './strategies/jsearch';
import { IndeedScraper } from './strategies/indeed';
import { JinaReaderScraper } from './strategies/jinaReader';
import { spawnPythonScraper, PythonScraperResult } from './bridge/pythonBridge';
import { logger } from '../lib/automation/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

function loadPythonScraperConfigs(): PythonScraperConfig[] {
  const yamlPath = path.join(process.cwd(), 'scrapers.yaml');
  if (!fs.existsSync(yamlPath)) {
    logger.warning('scrapers.yaml not found, no Python scrapers configured');
    return [];
  }

  const raw = fs.readFileSync(yamlPath, 'utf-8');
  const parsed = yaml.load(raw) as Record<string, unknown>;

  if (!parsed?.scrapers) return [];

  return Object.entries(parsed.scrapers as Record<string, unknown>).map(([name, cfg]) => {
    const config = cfg as Record<string, unknown>;
    return {
      name,
      module: (config.module as string) || `scrapers.${name}`,
      className:
        (config.className as string) || `${name.charAt(0).toUpperCase() + name.slice(1)}Scraper`,
      enabled: (config.enabled as boolean) !== false,
      maxJobs: (config.max_jobs as number) || 10,
      rateLimitMs: (config.rate_limit_ms as number) || 5000,
      extra: config,
    };
  });
}

export class ScraperRunner {
  private config: ScraperConfig;
  private allJobs: Job[] = [];
  private stats: ScraperStats[] = [];

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  getStats(): ScraperStats[] {
    return this.stats;
  }

  async runAllScrapers(): Promise<Job[]> {
    this.allJobs = [];
    this.stats = [];

    logger.info(
      `Starting job search — query: "${this.config.query}", max: ${this.config.maxJobs || 'unlimited'}`,
    );

    // Step 1: Try JSearch API
    const jsearchJobs = await this.tryJSearch();
    if (jsearchJobs.length > 0) {
      this.allJobs.push(...jsearchJobs);
      logger.success(`JSearch API: ${jsearchJobs.length} jobs`);
    }

    // Step 2: Run TS HTTP scrapers + Python scrapers in parallel
    const pythonConfigs = loadPythonScraperConfigs().filter((c) => c.enabled);

    const promises: Promise<ScraperStats>[] = [];

    // Indeed (HTTP scraper — stays in TS)
    promises.push(this.runIndeedScraper());

    // Python scrapers via subprocess bridge
    for (const cfg of pythonConfigs) {
      promises.push(this.runPythonScraper(cfg));
    }

    // Run all in parallel with failure isolation
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.stats.push(result.value);
        if (result.value.success && result.value.jobCount > 0) {
          // Jobs are already added inside each runner method
        }
      } else {
        this.stats.push({
          scraper: 'unknown',
          success: false,
          jobCount: 0,
          duration: 0,
          error: result.reason?.message || 'Unknown rejection',
        });
      }
    }

    // Step 3: JinaReader fallback for sources that returned 0 jobs
    // LinkedIn and Indeed are the primary candidates — they're often blocked
    const fallbackSources = this.identifyFailedSources();
    if (fallbackSources.length > 0) {
      await this.runJinaReaderFallbacks(fallbackSources);
    }

    logger.info(
      `Scraping complete — total: ${this.allJobs.length} jobs from ${this.stats.length} scrapers`,
    );
    return this.allJobs;
  }

  private async tryJSearch(): Promise<Job[]> {
    try {
      const jsearch = new JSearchScraper(this.config);
      const result = await jsearch.search(this.config);

      if (result.success && result.data && result.data.length > 0) {
        this.stats.push({
          scraper: 'jsearch',
          success: true,
          jobCount: result.data.length,
          duration: 0,
        });
        return result.data;
      }

      // Record failed stats when JSearch returns gracefully with success:false
      this.stats.push({
        scraper: 'jsearch',
        success: false,
        jobCount: 0,
        duration: 0,
        error: result.error || 'No results',
      });
    } catch (error) {
      logger.warning('JSearch API failed, continuing with other scrapers');
      this.stats.push({
        scraper: 'jsearch',
        success: false,
        jobCount: 0,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return [];
  }

  private async runIndeedScraper(): Promise<ScraperStats> {
    const start = Date.now();
    try {
      await rateLimiter.wait();
      const scraper = new IndeedScraper(this.config);
      const result = await scraper.scrape(this.config);
      const duration = Date.now() - start;

      if (result.success && result.data) {
        this.allJobs.push(...result.data);
        return { scraper: 'indeed', success: true, jobCount: result.data.length, duration };
      }
      return { scraper: 'indeed', success: false, jobCount: 0, duration, error: result.error };
    } catch (error) {
      return {
        scraper: 'indeed',
        success: false,
        jobCount: 0,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async runPythonScraper(cfg: PythonScraperConfig): Promise<ScraperStats> {
    const start = Date.now();
    try {
      const result: PythonScraperResult = await spawnPythonScraper({
        scriptName: cfg.name,
        query: this.config.query,
        maxJobs: cfg.maxJobs || this.config.maxJobs || 10,
        timeout: 60000,
      });

      if (result.success && result.data) {
        this.allJobs.push(...result.data);
      }

      return {
        scraper: cfg.name,
        success: result.success,
        jobCount: result.jobCount,
        duration: result.duration || Date.now() - start,
        error: result.error,
      };
    } catch (error) {
      return {
        scraper: cfg.name,
        success: false,
        jobCount: 0,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Identify which sources returned 0 jobs and should use JinaReader fallback.
   * Checks the stats from the current scrape run.
   */
  private identifyFailedSources(): string[] {
    const fallbackCandidates = ['linkedin', 'indeed', 'computrabajo', 'glassdoor'];
    const failed: string[] = [];

    for (const source of fallbackCandidates) {
      const sourceStats = this.stats.filter((s) => s.scraper === source);
      // If no stats for this source, it wasn't tried — skip (not a failure)
      if (sourceStats.length === 0) continue;
      // Fail if: all attempts failed OR all returned 0 jobs
      const allFailed = sourceStats.every((s) => !s.success);
      const allEmpty = sourceStats.every((s) => s.success && s.jobCount === 0);

      if (allFailed || allEmpty) {
        failed.push(source);
        logger.info(
          `[Fallback] ${source} needs fallback (failed: ${allFailed}, empty: ${allEmpty})`,
        );
      }
    }

    return failed;
  }

  /**
   * Run JinaReader as fallback for sources that failed during normal scraping.
   * Retries up to MAX_RETRIES times with exponential backoff to handle transient
   * rate limiting / timeouts from LinkedIn and other blocked sources.
   * Deduplicates results against already-collected jobs.
   *
   * The retry strategy is:
   * - Attempt 1: immediate
   * - Attempt 2: after 2s backoff
   * - Attempt 3: after 4s backoff (cumulative max: 6s per source)
   *
   * This improves LinkedIn's success rate from ~1 job to ~5+ jobs in the pipeline.
   */
  private async runJinaReaderFallbacks(sources: string[]): Promise<void> {
    const MAX_RETRIES = 3;

    for (const source of sources) {
      // Rebuild keys before each source to catch jobs added by previous fallbacks
      const existingKeys = new Set(
        this.allJobs.map((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}`),
      );

      // Track total time across all retry attempts
      const overallStart = Date.now();
      let lastResult: { success: boolean; data?: Job[]; error?: string } | null = null;
      let lastError: string | undefined;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.info(
            `[Fallback] Trying JinaReader for: ${source} (attempt ${attempt}/${MAX_RETRIES})`,
          );
          const scraper = new JinaReaderScraper(source);
          const result = await scraper.scrape(this.config);

          if (result.success && result.data && result.data.length > 0) {
            // Success — exit retry loop immediately
            lastResult = result;
            break;
          }

          // scrape() returned success=false or empty data — may be transient
          lastResult = result;
          lastError = result.error || 'empty';

          if (attempt < MAX_RETRIES) {
            const delayMs = attempt * 2000; // 2s, then 4s
            logger.info(
              `[Fallback] JinaReader-${source} attempt ${attempt} returned ${result.data?.length ?? 0} jobs (${lastError}), retrying in ${delayMs}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } catch (error) {
          lastResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          lastError = error instanceof Error ? error.message : 'Unknown';

          if (attempt < MAX_RETRIES) {
            const delayMs = attempt * 2000; // 2s, then 4s
            logger.info(
              `[Fallback] JinaReader-${source} attempt ${attempt} threw: ${lastError}, retrying in ${delayMs}ms...`,
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      // ─── Process final result after retry loop ──────────────────────────
      const totalDuration = Date.now() - overallStart;

      if (lastResult && lastResult.success && lastResult.data && lastResult.data.length > 0) {
        // Add only jobs that don't already exist (dedup across sources)
        const newJobs = lastResult.data.filter((job) => {
          const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
          return !existingKeys.has(key);
        });

        if (newJobs.length > 0) {
          this.allJobs.push(...newJobs);
          // Add newly seen keys for logging clarity
          for (const job of newJobs) {
            existingKeys.add(`${job.title.toLowerCase()}|${job.company.toLowerCase()}`);
          }
          logger.success(
            `[Fallback] JinaReader-${source}: ${newJobs.length} new jobs (${lastResult.data.length} total found, ${lastResult.data.length - newJobs.length} dupes skipped)`,
          );
        } else {
          logger.info(
            `[Fallback] JinaReader-${source}: ${lastResult.data.length} found but all duplicates`,
          );
        }

        this.stats.push({
          scraper: `jinareader-${source}`,
          success: true,
          jobCount: newJobs.length,
          duration: totalDuration,
        });
      } else {
        const logError = lastResult?.error || lastError || 'empty';
        logger.warning(
          `[Fallback] JinaReader-${source} returned no results after ${MAX_RETRIES} attempts: ${logError}`,
        );
        this.stats.push({
          scraper: `jinareader-${source}`,
          success: false,
          jobCount: 0,
          duration: totalDuration,
          error: logError,
        });
      }
    }
  }

  async saveToJSON(outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(this.allJobs, null, 2), 'utf-8');
    logger.info(`Jobs saved to ${outputPath}`);
  }

  getJobs(): Job[] {
    return this.allJobs;
  }

  clearJobs(): void {
    this.allJobs = [];
  }
}

export async function runScrapers(config: ScraperConfig, outputPath?: string): Promise<Job[]> {
  const runner = new ScraperRunner(config);
  const jobs = await runner.runAllScrapers();

  if (outputPath) {
    await runner.saveToJSON(outputPath);
  }

  return jobs;
}

// CLI execution check — avoid import.meta.url for Jest compatibility
if (
  process.argv[1] &&
  !process.env.JEST_WORKER_ID &&
  (process.argv[1].replace(/\\/g, '/').endsWith('index.ts') ||
    process.argv[1].replace(/\\/g, '/').endsWith('index.js'))
) {
  const query = process.argv[2] || 'software engineer';
  const maxJobs = parseInt(process.argv[3] || '10', 10);
  const output = process.argv[4] || 'data/jobs.json';

  logger.info(`CLI mode — query: ${query}, max: ${maxJobs}`);

  runScrapers({ query, maxJobs }, output)
    .then((jobs) => {
      logger.success(`Done! ${jobs.length} jobs total.`);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Fatal error', error instanceof Error ? error : undefined);
      process.exit(1);
    });
}
