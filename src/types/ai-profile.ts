/**
 * AI Profile Extraction types
 * Represents structured data extracted from a CV/Resume PDF using AI
 */

/**
 * Experience level — reuses the existing type from user-profile.ts
 * Values: 'junior' | 'mid' | 'senior' | 'lead'
 */
import type { ExperienceLevel } from './user-profile';
export type { ExperienceLevel };

/**
 * Structured work experience entry extracted from a CV
 */
export interface ExperienceEntry {
  /** Job title */
  jobTitle?: string;
  /** Company or organization name */
  company?: string;
  /** Duration string (e.g., "Jan 2020 - Dec 2022" or "2020-2022") */
  duration?: string;
  /** Description of responsibilities and achievements */
  description?: string;
}

/**
 * Structured profile extracted from a CV/resume PDF
 * All fields are designed to serve:
 * - Dashboard display (skills, summary, experienceLevel, languages, etc.)
 * - Job matching (skills, interests, location, salary, etc.)
 * - Scraping strategy generation (jobTitles, skills, locations, industries)
 * - Email digest personalization (name, jobTitles, skills)
 * - Auto-apply in the future (personalInfo, certifications, experience)
 */
export interface ExtractedProfile {
  /** Job titles extracted from CV (current and previous roles) */
  jobTitles: string[];
  /** Technical and hard skills extracted from CV */
  skills: string[];
  /** Soft skills / personal attributes (e.g., leadership, communication) */
  softSkills?: string[];
  /** Industries/sectors the candidate has experience in */
  industries: string[];
  /** Topics/areas the candidate is interested in (used for interest matching) */
  interests?: string[];
  /** Preferred or mentioned locations */
  locations: string[];
  /** Whether the candidate prefers remote work */
  remoteOnly?: boolean;
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
  /** Education entries extracted from CV */
  education?: Array<{
    degree?: string;
    institution?: string;
    graduationYear?: string;
  }>;
  /** Professional certifications (e.g., "AWS Certified Solutions Architect") */
  certifications?: string[];
  /** Structured work experience entries */
  experience?: ExperienceEntry[];
  /** Career objective or professional goal statement */
  objective?: string;
  /** Professional summary or objective statement from CV */
  summary?: string;
  /** Personal information (for future auto-apply feature) */
  personalInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    portfolio?: string;
    github?: string;
  };
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
  /** Specific AI provider (gemini | openrouter | nim) */
  aiProvider?: string;
  /** API key for the AI provider */
  aiApiKey?: string;
}
