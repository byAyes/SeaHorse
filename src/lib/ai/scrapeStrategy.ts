/**
 * Scraping Strategy Builder
 *
 * Takes an ExtractedProfile and generates targeted search queries, location
 * filters, and source priorities to configure the scraper pipeline for
 * personalized job searches.
 */

import { ExtractedProfile, ScrapeStrategy } from '../../types/ai-profile';

// ─── Industry → Source Priority Mapping ─────────────────────────────────────

const INDUSTRY_SOURCE_PRIORITY: Record<string, string[]> = {
  technology: ['jsearch', 'linkedin', 'indeed'],
  software: ['jsearch', 'linkedin', 'indeed'],
  healthcare: ['indeed', 'glassdoor', 'linkedin'],
  finance: ['linkedin', 'indeed', 'glassdoor'],
  education: ['indeed', 'linkedin', 'glassdoor'],
  manufacturing: ['indeed', 'glassdoor'],
  retail: ['indeed', 'glassdoor'],
};

const DEFAULT_SOURCES = ['jsearch', 'linkedin', 'indeed', 'glassdoor'];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build a complete scraping strategy from an extracted CV profile.
 * Generates search queries, location filters, and source priorities.
 */
export function buildScrapeStrategy(profile: ExtractedProfile): ScrapeStrategy {
  return {
    searchQueries: generateSearchQueries(profile.jobTitles, profile.skills, profile.locations),
    locations: profile.locations,
    experienceLevel: profile.experienceLevel,
    prioritizedSources: prioritizeSources(profile.industries),
    minSalary: profile.salaryRange?.min,
  };
}

/**
 * Generate multiple targeted search queries from job titles, skills, and locations.
 *
 * Strategy:
 * - For each job title, create a base query
 * - Combine top skills with the primary title
 * - Add location-specific variants
 * - Produce 3-5 unique queries
 */
export function generateSearchQueries(
  titles: string[],
  skills: string[],
  locations: string[],
): string[] {
  const queries: string[] = [];
  const topSkills = skills.slice(0, 5);
  const topLocations = locations.length > 0 ? locations.slice(0, 3) : ['Remote'];

  // 1. Title + Location queries (most specific)
  for (const title of titles.slice(0, 3)) {
    for (const loc of topLocations.slice(0, 2)) {
      queries.push(`${title} ${loc}`);
    }
  }

  // 2. Title + Top Skills (for technology-specific searches)
  if (topSkills.length > 0 && titles.length > 0) {
    const primaryTitle = titles[0];
    queries.push(`${primaryTitle} ${topSkills.slice(0, 3).join(' ')}`);
  }

  // 3. Skills-only queries (broadest)
  if (topSkills.length >= 2) {
    queries.push(topSkills.slice(0, 3).join(' '));
  }

  // 4. First title + "remote" (for remote seekers)
  if (titles.length > 0 && !topLocations.some((l) => l.toLowerCase() === 'remote')) {
    queries.push(`${titles[0]} remote`);
  }

  // 5. If there's a second unique location not yet covered
  if (titles.length > 0 && topLocations.length > 2) {
    queries.push(`${titles[0]} ${topLocations[2]}`);
  }

  // Deduplicate (case-insensitive) and limit to 5
  const seen = new Set<string>();
  const uniqueQueries: string[] = [];

  for (const q of queries) {
    const key = q.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueQueries.push(q.trim());
    }
    if (uniqueQueries.length >= 5) break;
  }

  return uniqueQueries;
}

/**
 * Prioritize job board sources based on the candidate's industries.
 * Technology → prioritize JSearch/LinkedIn
 * Healthcare → prioritize Indeed/Glassdoor
 * etc.
 */
export function prioritizeSources(industries: string[]): string[] {
  const prioritySources = new Set<string>();

  for (const industry of industries) {
    const normalized = industry.toLowerCase().trim();
    const sources = INDUSTRY_SOURCE_PRIORITY[normalized];
    if (sources) {
      for (const s of sources) {
        prioritySources.add(s);
      }
    }
  }

  // If no industry matched, return defaults
  if (prioritySources.size === 0) {
    return [...DEFAULT_SOURCES];
  }

  // Return prioritized sources with defaults as fallback
  return [...prioritySources, ...DEFAULT_SOURCES.filter((s) => !prioritySources.has(s))];
}

/**
 * Format the first query from a strategy as a single search string.
 * For use when overriding JOB_QUERY env var in the pipeline.
 */
export function getPrimaryQuery(strategy: ScrapeStrategy): string {
  return strategy.searchQueries[0] || 'software engineer';
}

/**
 * Join multiple queries into a pipe-separated string.
 * For use with scrapers that support multiple queries.
 */
export function getCombinedQueries(strategy: ScrapeStrategy): string {
  return strategy.searchQueries.join(' | ');
}
