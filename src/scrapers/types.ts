/**
 * Job interface representing a standardized job listing
 * Contains all required fields for job board scraping
 */
export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  link: string;
  description: string;
  source: string;
  scrapedAt: Date;
}

/**
 * Configuration options for scrapers
 */
export interface ScraperConfig {
  query: string;
  maxJobs?: number;
  rateLimitMs?: number;
}

/**
 * Result type for scraper operations
 */
export interface ScraperResult<T = Job[]> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Abstract scraper interface that all scrapers must implement
 */
export interface Scraper {
  scrape(config: ScraperConfig): Promise<ScraperResult>;
}

/**
 * Configuration for Python subprocess scrapers
 * Loaded from scrapers.yaml
 */
export interface PythonScraperConfig {
  name: string;
  module: string;
  className: string;
  enabled: boolean;
  maxJobs: number;
  rateLimitMs: number;
  extra?: Record<string, unknown>;
}

/**
 * Per-scraper execution stats
 */
export interface ScraperStats {
  scraper: string;
  success: boolean;
  jobCount: number;
  duration: number;
  error?: string;
}
