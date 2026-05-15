/**
 * AI Profile Extraction types
 * Represents structured data extracted from a CV/Resume PDF using AI
 */

/**
 * Experience level — reuses the existing type from user-profile.ts
 * Values: 'junior' | 'mid' | 'senior' | 'lead'
 */
export type { ExperienceLevel } from './user-profile';

/**
 * Structured profile extracted from a CV/resume PDF
 */
export interface ExtractedProfile {
  /** Job titles extracted from CV (current and previous roles) */
  jobTitles: string[];
  /** Skills and technologies extracted from CV */
  skills: string[];
  /** Industries/sectors the candidate has experience in */
  industries: string[];
  /** Preferred or mentioned locations */
  locations: string[];
  /** Inferred experience level based on work history */
  experienceLevel: ExperienceLevel;
  /** Expected salary range, if mentioned in CV */
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  /** Languages mentioned in CV */
  languages: Array<{
    language: string;
    level?: string;
  }>;
  /** Professional summary or objective statement from CV */
  summary?: string;
}

/**
 * Scraping strategy generated from an extracted profile.
 * Used to configure the scraper pipeline for targeted job searches.
 */
export interface ScrapeStrategy {
  /** Multiple search queries derived from job titles and skills */
  searchQueries: string[];
  /** Primary locations to filter by */
  locations: string[];
  /** Experience level filter */
  experienceLevel?: string;
  /** Job boards or sources to prioritize (e.g., 'jsearch', 'linkedin') */
  prioritizedSources?: string[];
  /** Minimum salary filter */
  minSalary?: number;
}

/**
 * Result of profile extraction from an uploaded PDF
 */
export interface ProfileExtractionResult {
  success: boolean;
  profile?: ExtractedProfile;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Options for profile extraction
 */
export interface ProfileExtractionOptions {
  /** The AI model provider to use (defaults to gemini) */
  provider?: 'gemini' | 'openai' | 'ollama' | 'keyword';
  /** Language of the CV for prompt optimization */
  language?: string;
}
