/**
 * Pipeline integration helper
 *
 * Wraps the extraction + scraping pipeline into a single function.
 * Overrides JOB_QUERY env var with personalized queries from the profile,
 * then delegates to the existing executePipeline.
 *
 * NOTE: This mutates process.env.JOB_QUERY and process.env.JOB_LOCATION
 * as a side effect. This is safe in CLI/single-run scenarios (GitHub Actions,
 * local runs) where each invocation runs in a fresh process. If this is ever
 * used in a long-lived server context, refactor to accept a config object.
 *
 * This keeps modifications to the core pipeline minimal.
 */

import { extractProfileFromPDF } from './pdfProfileExtractor';
import { buildScrapeStrategy, getPrimaryQuery } from './scrapeStrategy';
import { ExtractedProfile } from '../../types/ai-profile';

/**
 * Extract profile from a PDF path, build a scraping strategy,
 * and override environment variables for the pipeline.
 *
 * @returns The extracted profile if successful, null otherwise.
 */
export async function extractAndConfigurePipeline(
  pdfBuffer: Buffer,
): Promise<ExtractedProfile | null> {
  const result = await extractProfileFromPDF(pdfBuffer);

  if (!result.success || !result.profile || result.profile.jobTitles.length === 0) {
    return null;
  }

  const profile = result.profile;
  const strategy = buildScrapeStrategy(profile);

  // Override env vars for the pipeline to consume
  if (strategy.searchQueries.length > 0) {
    process.env.JOB_QUERY = getPrimaryQuery(strategy);
  }

  if (strategy.locations.length > 0) {
    process.env.JOB_LOCATION = strategy.locations[0];
  }

  return profile;
}
