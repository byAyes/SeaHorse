import axios from 'axios';
import { Job, ScraperConfig, ScraperResult } from '../types';

/**
 * JSearch API job scraper
 * Free API that aggregates jobs from Indeed, LinkedIn, Glassdoor, etc.
 * No API key required for basic usage (100 requests/day limit)
 * 
 * @see https://jsearchapi.com/
 */
export class JSearchScraper {
  private readonly baseUrl = 'https://jsearch.p.rapidapi.com';
  private readonly apiKey: string;

  constructor(config: ScraperConfig) {
    // API key from environment or empty (works without key for limited usage)
    this.apiKey = process.env.JSEARCH_API_KEY || '';
  }

  /**
   * Search jobs using JSearch API
   * @param config - Scraper configuration
   * @returns Promise resolving to scraper result with jobs
   */
  async search(config: ScraperConfig): Promise<ScraperResult> {
    try {
      const { query, maxJobs = 10 } = config;
      
      // Build search parameters
      const params = new URLSearchParams({
        query: query || 'software engineer',
        num_pages: Math.ceil(maxJobs / 10).toString(), // 10 jobs per page
        date_posted: '3days', // Last 3 days only
      });

      const url = `${this.baseUrl}/search?${params.toString()}`;
      
      console.log(`[JSearch] Searching for: ${query}`);

      // API headers
      const headers: any = {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      };

      // If no API key, try without authentication (limited to 100 requests/day)
      if (!this.apiKey) {
        console.log('[JSearch] No API key provided, using unauthenticated request (limited)');
        delete headers['X-RapidAPI-Key'];
        delete headers['X-RapidAPI-Host'];
      }

      const response = await axios.get(url, { headers });
      const data = response.data;

      if (!data.status || data.status !== 'OK') {
        throw new Error(data.message || 'JSearch API error');
      }

      const jobs: Job[] = (data.data || []).map((job: any) => this.convertJob(job));
      
      console.log(`[JSearch] Found ${jobs.length} jobs`);
      
      return {
        success: true,
        data: jobs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[JSearch] Error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Convert JSearch job to our Job format
   */
  private convertJob(job: any): Job {
    return {
      id: job.job_id || '',
      title: job.job_title || '',
      company: job.employer_name || '',
      location: job.job_location || '',
      link: job.job_apply_link || job.job_apply_is_valid || '',
      description: job.job_description || '',
      source: 'jsearch',
      scrapedAt: new Date(),
    };
  }
}

// CLI execution
if (require.main === module) {
  const query = process.argv[2] || 'software engineer';
  const maxJobs = parseInt(process.argv[3] || '10', 10);
  
  const scraper = new JSearchScraper({ query, maxJobs });
  
  scraper.search({ query, maxJobs })
    .then(result => {
      if (result.success && result.data) {
        console.log(`\n✅ Successfully found ${result.data.length} jobs:`);
        result.data.forEach((job, i) => {
          console.log(`${i + 1}. ${job.title} at ${job.company} - ${job.location}`);
          console.log(`   Link: ${job.link}`);
        });
      } else {
        console.error('❌ Failed to fetch jobs:', result.error);
      }
    })
    .catch(console.error);
}
