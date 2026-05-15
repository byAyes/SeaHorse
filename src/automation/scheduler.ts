import 'dotenv/config';

import { logger } from '../lib/automation/logger';
import { executePipeline } from './orchestrator';

/**
 * Main automation entry point
 * Runs the full pipeline and handles top-level errors
 */
export async function runAutomation(): Promise<void> {
  logger.success('Starting Job Email Automation Pipeline');

  try {
    const result = await executePipeline();

    logger.success('Pipeline completed successfully');
    logger.info('Summary:', {
      scraped: result.scraped,
      matched: result.matched,
      sent: result.sent,
      cleaned: result.cleaned,
    });

    if (result.scraperStats?.length) {
      logger.scraperSummary(result.scraperStats);
    }
  } catch (error) {
    logger.error('Pipeline failed', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}

// Main guard - run if this file is executed directly
// ESM equivalent of require.main === module
import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  runAutomation().catch(console.error);
}

