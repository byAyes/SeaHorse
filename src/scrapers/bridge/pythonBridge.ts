import { spawn } from 'child_process';
import * as path from 'path';
import type { Job, ScraperResult } from '../types';
import { logger } from '../../lib/automation/logger';

export interface PythonBridgeOptions {
  scriptName: string;
  query: string;
  maxJobs: number;
  timeout?: number;
}

export interface PythonScraperResult extends ScraperResult {
  scraper: string;
  jobCount: number;
  duration: number;
}

function forwardPythonLogs(raw: string): void {
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      const level = parsed.level || 'info';
      const scraper = parsed.scraper || 'python';
      const message = parsed.message || trimmed;

      if (level === 'error') {
        logger.error(`[${scraper}] ${message}`);
      } else if (level === 'warning') {
        logger.warning(`[${scraper}] ${message}`);
      } else {
        logger.info(`[${scraper}] ${message}`);
      }
    } catch {
      logger.info(`[python] ${trimmed}`);
    }
  }
}

export async function spawnPythonScraper(
  options: PythonBridgeOptions,
): Promise<PythonScraperResult> {
  const scriptModule = `scrapers.${options.scriptName}`;
  const args = [
    '-m',
    scriptModule,
    '--query',
    options.query,
    '--max-jobs',
    String(options.maxJobs),
  ];
  const startTime = Date.now();

  return new Promise((resolve) => {
    const cwd = path.resolve(process.cwd());
    const proc = spawn('python', args, {
      cwd,
      timeout: options.timeout ?? 60000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      forwardPythonLogs(text);
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        try {
          const jobs: Job[] = JSON.parse(stdout.trim()).map((j: Record<string, unknown>) => ({
            ...j,
            scrapedAt: new Date(j.scrapedAt as string),
          }));
          resolve({
            scraper: options.scriptName,
            success: true,
            jobCount: jobs.length,
            data: jobs,
            duration,
          });
        } catch (parseErr) {
          resolve({
            scraper: options.scriptName,
            success: false,
            jobCount: 0,
            data: undefined,
            duration,
            error: `JSON parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          });
        }
      } else {
        resolve({
          scraper: options.scriptName,
          success: false,
          jobCount: 0,
          data: undefined,
          duration,
          error: stderr.trim() || `Process exited with code ${code}`,
        });
      }
    });

    proc.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        scraper: options.scriptName,
        success: false,
        jobCount: 0,
        data: undefined,
        duration,
        error: err.message,
      });
    });
  });
}
