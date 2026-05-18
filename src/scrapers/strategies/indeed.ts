import { Job, ScraperConfig, ScraperResult } from '../types';
import { HttpScraper } from './httpScraper';

/**
 * Indeed.com job scraper
 * Uses HTTP requests with Cheerio for HTML parsing
 * Includes user-agent rotation and proper headers to avoid blocking
 */
export class IndeedScraper extends HttpScraper {
  private readonly baseUrl = 'https://www.indeed.com';

  constructor(config: ScraperConfig) {
    super(config, 'IndeedScraper');
  }

  /**
   * Scrape job listings from Indeed.com
   * @param config - Scraper configuration
   * @returns Promise resolving to scraper result with jobs
   */
  async scrape(config: ScraperConfig): Promise<ScraperResult> {
    try {
      const url = this.buildUrl(config);
      this.logger.info(`Scraping Indeed with query: ${config.query}`);

      const html = await this.fetchHtml(url);
      const $ = this.parseHtml(html);
      const jobs: Job[] = [];

      // Indeed modern card selectors (2024+ layout with A/B testing)
      const cardSelectors = [
        '.job_seen_beacon',
        '.cardOutline',
        "[class*='job_seen_beacon']",
        "[data-testid='job-card']",
        'li[class*="job"]',
        'div[class*="jobsearch"] > div > div',
        'div[id*="job"] > div',
        'div[data-testid*="job"]',
      ];

      let jobCards: ReturnType<typeof $> | null = null;
      for (const sel of cardSelectors) {
        const found = $(sel);
        if (found.length > 0) {
          jobCards = found;
          this.logger.info(`Found ${found.length} cards with selector: ${sel}`);
          break;
        }
      }

      if (!jobCards || jobCards.length === 0) {
        this.logger.warn('No job cards found on Indeed page');
        return { success: true, data: [] };
      }

      jobCards.each((_, element) => {
        try {
          const $el = $(element);

          // Title — try multiple selectors
          let title = '';
          for (const sel of [
            'h2 a[data-testid="job-card-title"]',
            'a[data-testid="job-card-title"]',
            'h2 a span',
            'a.jobCardLink',
            'h2 span',
            'a[class*="title"]',
            'a[class*="jobtitle"]',
          ]) {
            const txt = $el.find(sel).first().text().trim();
            if (txt) {
              title = txt;
              break;
            }
          }
          if (!title) return;

          // Company
          let company = '';
          for (const sel of [
            '[data-testid="job-card-company-name"]',
            '[data-testid="company-name"]',
            'span[class*="company"]',
            'div[class*="company"]',
            '[class*="companyName"]',
          ]) {
            const txt = $el.find(sel).first().text().trim();
            if (txt) {
              company = txt;
              break;
            }
          }

          // Location
          let location = '';
          for (const sel of [
            '[data-testid="job-card-location"]',
            '[data-testid="text-location"]',
            'div[class*="location"]',
            '[class*="location"]',
          ]) {
            const txt = $el.find(sel).first().text().trim();
            if (txt) {
              location = txt;
              break;
            }
          }

          // Link
          let link = '';
          for (const sel of [
            'h2 a',
            'a.jobCardLink',
            'a[class*="title"]',
            'a[href*="/rc/clk"]',
            'a[href*="job"]',
          ]) {
            const href = $el.find(sel).first().attr('href');
            if (href) {
              link = href;
              break;
            }
          }

          // Description snippet
          const description = $el
            .find('.job-snippet, [class*="snippet"], [class*="description"]')
            .first()
            .text()
            .trim();

          const fullLink = link ? this.normalizeUrl(link, this.baseUrl) : '';

          const job: Partial<Job> = {
            title,
            company,
            location,
            link: fullLink,
            description,
            source: 'indeed',
          };

          if (this.validateJob(job)) {
            jobs.push(this.createJob(job));
          }
        } catch (error) {
          this.logger.warn(
            `Error parsing job card: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }
      });

      this.logger.info(`Successfully extracted ${jobs.length} jobs from Indeed`);
      return { success: true, data: jobs };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Indeed scraping failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Build Indeed search URL
   * @param config - Scraper configuration
   * @returns Encoded search URL with date filter (last 3 days)
   */
  private buildUrl(config: ScraperConfig): string {
    const query = encodeURIComponent(config.query || '');
    // Sort by date and filter to last 3 days
    return `${this.baseUrl}/jobs?q=${query}&sort=date&fromage=3`;
  }
}
