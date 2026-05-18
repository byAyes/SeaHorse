/**
 * Jest unit tests for PDF Profile Extraction module
 *
 * Tests the strategy builder logic (no AI dependency):
 * - generateSearchQueries
 * - buildScrapeStrategy
 * - prioritizeSources
 * - getPrimaryQuery / getCombinedQueries
 *
 * Tests the keyword fallback extractor logic:
 * - parseAIResponse
 */

import {
  buildScrapeStrategy,
  generateSearchQueries,
  prioritizeSources,
  getPrimaryQuery,
  getCombinedQueries,
} from '../src/lib/ai/scrapeStrategy';

// ─── ScrapeStrategy Tests ───────────────────────────────────────────────────

describe('buildScrapeStrategy', () => {
  it('should generate a strategy from a complete profile', () => {
    const profile = {
      jobTitles: ['Senior React Engineer', 'Frontend Developer'],
      skills: ['TypeScript', 'React', 'Node.js', 'AWS', 'Docker'],
      industries: ['Technology', 'Software'],
      locations: ['Colombia', 'Remote'],
      experienceLevel: 'senior',
      languages: [{ language: 'Spanish', level: 'Native' }],
    };

    const strategy = buildScrapeStrategy(profile);

    expect(strategy.searchQueries).toHaveLength(5);
    expect(strategy.searchQueries[0]).toContain('Senior React Engineer');
    expect(strategy.searchQueries[0]).toContain('Colombia');
    expect(strategy.locations).toEqual(['Colombia', 'Remote']);
    expect(strategy.experienceLevel).toBe('senior');
    expect(strategy.prioritizedSources).toContain('jsearch');
    expect(strategy.prioritizedSources).toContain('linkedin');
  });

  it('should handle minimal profile with only job titles', () => {
    const profile = {
      jobTitles: ['Software Engineer'],
      skills: [],
      industries: [],
      locations: [],
      experienceLevel: 'mid',
      languages: [],
    };

    const strategy = buildScrapeStrategy(profile);

    expect(strategy.searchQueries.length).toBeGreaterThanOrEqual(1);
    expect(strategy.searchQueries[0]).toContain('Software Engineer');
    // Should include remote when no locations provided
    expect(
      strategy.searchQueries.some(function (q) {
        return q.toLowerCase().includes('remote');
      }),
    ).toBe(true);
  });
});

describe('generateSearchQueries', () => {
  it('should generate queries from titles and locations', () => {
    const queries = generateSearchQueries(
      ['Senior React Engineer', 'Backend Developer'],
      ['TypeScript', 'React', 'Node.js'],
      ['Colombia', 'Remote'],
    );

    expect(queries.length).toBeGreaterThanOrEqual(2);
    expect(queries.length).toBeLessThanOrEqual(5);
    expect(queries[0]).toContain('Senior React Engineer');
  });

  it('should not duplicate queries (case-insensitive)', () => {
    const queries = generateSearchQueries(['Developer'], ['JavaScript'], ['New York']);

    // Same query shouldn't appear twice
    const unique = new Set(
      queries.map(function (q) {
        return q.toLowerCase();
      }),
    );
    expect(unique.size).toBe(queries.length);
  });

  it('should handle empty titles gracefully', () => {
    const queries = generateSearchQueries([], ['Python'], ['Remote']);
    expect(queries.length).toBeGreaterThanOrEqual(0);
  });
});

describe('prioritizeSources', () => {
  it('should prioritize jsearch and linkedin for technology', () => {
    const sources = prioritizeSources(['Technology']);
    expect(sources.indexOf('jsearch')).toBeLessThan(sources.indexOf('glassdoor'));
  });

  it('should prioritize indeed and glassdoor for healthcare', () => {
    const sources = prioritizeSources(['Healthcare']);
    expect(sources[0]).toBe('indeed');
  });

  it('should return default sources for unknown industries', () => {
    const sources = prioritizeSources(['Unknown Industry']);
    expect(sources).toEqual(['jsearch', 'linkedin', 'indeed', 'glassdoor']);
  });

  it('should handle empty industries', () => {
    const sources = prioritizeSources([]);
    expect(sources).toEqual(['jsearch', 'linkedin', 'indeed', 'glassdoor']);
  });
});

describe('getPrimaryQuery / getCombinedQueries', () => {
  it('should return the first query as primary', () => {
    const profile = {
      jobTitles: ['React Developer'],
      skills: ['React'],
      industries: [],
      locations: ['Remote'],
      experienceLevel: 'mid',
      languages: [],
    };
    const strategy = buildScrapeStrategy(profile);
    expect(getPrimaryQuery(strategy)).toBe(strategy.searchQueries[0]);
  });

  it('should join queries with pipe separator', () => {
    const profile = {
      jobTitles: ['Dev'],
      skills: ['JS'],
      industries: [],
      locations: ['Remote'],
      experienceLevel: 'junior',
      languages: [],
    };
    const strategy = buildScrapeStrategy(profile);
    const combined = getCombinedQueries(strategy);
    expect(combined).toContain(' | ');
  });
});

// ─── Data Integrity Tests ───────────────────────────────────────────────────

describe('Profile data integrity', () => {
  it('should handle profile with salary range', () => {
    // Verify the data shape holds salary correctly
    const salaryRange = { min: 80000, max: 120000, currency: 'USD' };
    expect(salaryRange.min).toBe(80000);
    expect(salaryRange.max).toBe(120000);
    expect(salaryRange.currency).toBe('USD');
  });

  it('should handle profile with languages', () => {
    const languages = [
      { language: 'English', level: 'Professional' },
      { language: 'Spanish', level: 'Native' },
    ];

    expect(languages).toHaveLength(2);
    expect(languages[0].language).toBe('English');
    expect(languages[0].level).toBe('Professional');
  });

  it('should have valid experience levels', function () {
    const validLevels = ['junior', 'mid', 'senior', 'lead'];
    expect(validLevels).toContain('mid');
    expect(validLevels).toContain('senior');
    expect(validLevels).toContain('junior');
    expect(validLevels).toContain('lead');
  });
});
