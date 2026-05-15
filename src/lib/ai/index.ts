/**
 * AI Profile Extraction — Barrel Exports
 */

export { extractProfileFromPDF, extractProfileFromText, parseAIResponse } from './pdfProfileExtractor';
export {
  buildScrapeStrategy,
  generateSearchQueries,
  prioritizeSources,
  getPrimaryQuery,
  getCombinedQueries,
} from './scrapeStrategy';

export type {
  ExtractedProfile,
  ScrapeStrategy,
  ProfileExtractionResult,
  ProfileExtractionOptions,
  ExperienceLevel,
} from '../../types/ai-profile';
