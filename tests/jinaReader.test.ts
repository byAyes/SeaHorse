/**
 * Jina Reader Scraper — Unit Tests
 *
 * Tests the parser functions for LinkedIn, Indeed, Computrabajo, and Glassdoor
 * using realistic mock markdown as returned by Jina Reader.
 */

// We test parser functions by importing the class and accessing private methods
// via the module's exported functions. Since the parsers are internal to the
// module, we test through the JinaReaderScraper class scrape() method using
// mock axios responses.

import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock the logger to avoid noise
jest.mock('../src/lib/automation/logger', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the rate limiter to resolve immediately
import { rateLimiter } from '../src/scrapers/utils/rateLimiter';
jest.mock('../src/scrapers/utils/rateLimiter', () => ({
  rateLimiter: {
    wait: jest.fn().mockResolvedValue(undefined),
  },
}));

import { JinaReaderScraper } from '../src/scrapers/strategies/jinaReader';

// ─── Mock Markdown Fixtures ─────────────────────────────────────────────────

const COMPUTRABAJO_MOCK_5 = `[Skip to main content](https://co.computrabajo.com/)

## [Desarrollador Kotlin](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-kotlin-123)
Postulado  Vista
4,5 [Inter Rapidisimo S.A](https://co.computrabajo.com/interrapidisimo)
Bogotá, D.C., Bogotá, D.C.
$ 6.500.000,00 (Mensual)
Hace 1 hora

## [Desarrollador Full Stack](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-full-stack-456)
Postulado  Vista
[Key Team](https://co.computrabajo.com/keyteam)
Bogotá, D.C., Bogotá, D.C.
$ 4.500.000,00 (Mensual)
Hace 2 horas

## [Desarrolladora Comercial](https://co.computrabajo.com/ofertas-de-trabajo/desarrolladora-comercial-789)
Postulado  Vista
[MANZHU SAS](https://co.computrabajo.com/manzhu-sas)
Cali, Valle del Cauca
Hace 3 horas

## [Desarrollador Net Senior](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-net-senior-101)
Postulado  Vista
[BROWSER TRAVEL SOLUTIONS](https://co.computrabajo.com/browser-travel)
Bogotá, D.C., Bogotá, D.C.
$ 8.500.000,00 (Mensual)
Hace 5 horas

## [Desarrollador Front End](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-front-end-202)
Postulado  Vista
[BROWSER TRAVEL SOLUTIONS](https://co.computrabajo.com/browser-travel)
Bogotá, D.C., Bogotá, D.C.
Hace 6 horas
`;

const COMPUTRABAJO_SINGLE = `
## [Senior Java Developer](https://co.computrabajo.com/ofertas-de-trabajo/senior-java-303)
Postulado  Vista
5,0 [Tech Corp SAS](https://co.computrabajo.com/tech-corp)
Medellín, Antioquia
$ 12.000.000,00 (Mensual)
Hace 1 día
`;

const COMPUTRABAJO_EMPTY = `[Skip to main content](https://co.computrabajo.com/)
No se encontraron ofertas de trabajo
`;

const LINKEDIN_MOCK = `
## Senior Software Engineer
**Company:** Google
**Location:** Mountain View, CA
$180,000 - $250,000
We are looking for a senior engineer to join our team.

## Product Manager at Microsoft
**Company:** Microsoft
**Location:** Redmond, WA
$150,000 - $200,000

## Junior Developer
**Company:** Startup Inc
**Location:** Remote
`;

const INDEED_MOCK = `
## Software Engineer
**Company:** Amazon
**Location:** Seattle, WA
$150,000 - $200,000 a year
Full-time position

## Data Scientist
**Company:** Meta
**Location:** Menlo Park, CA
$160,000 - $220,000 a year
`;

const GLASSDOOR_SALARY_MOCK = `
## Senior Engineer
**Company:** Netflix
**Location:** Los Gatos, CA
**Salary:** $150K – $220K
**Rating:** 4.2 ★
Streaming entertainment company

## Engineering Manager
**Company:** Apple
**Location:** Cupertino, CA
**Salary:** $200K - $280K
**Rating:** 4.5 ★
`;

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('JinaReaderScraper - Computrabajo Parser', () => {
  it('should extract 5 jobs from realistic Computrabajo markdown', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_MOCK_5,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: 'desarrollador', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(5);
    expect(result.data![0].title).toBe('Desarrollador Kotlin');
    expect(result.data![0].company).toBe('Inter Rapidisimo S.A');
    expect(result.data![0].location).toContain('Bogotá');
  });

  it('should extract company name without rating prefix', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_SINGLE,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: 'java', maxJobs: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].company).toBe('Tech Corp SAS');
    expect(result.data![0].location).toBe('Medellín, Antioquia');
  });

  it('should handle company with rating prefix (4,5 [Company])', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_MOCK_5,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    // "Inter Rapidisimo S.A" has a "4,5" rating prefix
    expect(result.data!.some((j) => j.company === 'Inter Rapidisimo S.A')).toBe(true);
  });

  it('should extract Spanish accented characters correctly', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_MOCK_5,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    expect(result.data!.some((j) => j.title.includes('Desarrollador'))).toBe(true);
    expect(result.data!.some((j) => j.location && j.location.includes('Bogotá'))).toBe(true);
    expect(result.data!.some((j) => j.location && j.location.includes('Cali'))).toBe(true);
    expect(result.data!.some((j) => j.location && j.location.includes('Valle del Cauca'))).toBe(
      true,
    );
  });

  it('should handle empty results gracefully', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_EMPTY,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: 'noexist', maxJobs: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it('should not extract non-job headings', async () => {
    // Computrabajo parser requires ## [Title](url) format with markdown link
    // Navigation headings like "Iniciar sesión" won't match
    const navMarkdown = `
## [Iniciar sesión](https://co.computrabajo.com/login)
Postulado  Vista

## [Desarrollador Web](https://co.computrabajo.com/desarrollador-web)
Postulado  Vista
[Test Corp](https://co.computrabajo.com/testcorp)
Bogotá, D.C.
`;
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: navMarkdown,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    // Should only extract "Desarrollador Web", skip navigation headings like "Iniciar sesión"
    expect(result.data).toHaveLength(1);
    expect(result.data![0].title).toBe('Desarrollador Web');
  });
});

describe('JinaReaderScraper - LinkedIn Parser', () => {
  it('should extract jobs from LinkedIn-style markdown', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_MOCK,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data!.length).toBeGreaterThanOrEqual(2);
    expect(result.data![0].title).toBe('Senior Software Engineer');
    expect(result.data![0].company).toBe('Google');
  });

  it('should handle Company field with colon', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_MOCK,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    const microsoft = result.data!.find((j) => j.title.includes('Product Manager'));
    expect(microsoft).toBeDefined();
    expect(microsoft!.company).toBe('Microsoft');
  });

  it('should handle empty response', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: 'No jobs found',
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});

describe('JinaReaderScraper - Indeed Parser', () => {
  it('should extract jobs from Indeed-style markdown', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: INDEED_MOCK,
    });

    const scraper = new JinaReaderScraper('indeed');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0].title).toBe('Software Engineer');
    expect(result.data![0].company).toBe('Amazon');
  });
});

describe('JinaReaderScraper - Glassdoor Parser', () => {
  it('should extract jobs with salary and rating', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_SALARY_MOCK,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data![0].title).toBe('Senior Engineer');
    expect(result.data![0].company).toBe('Netflix');
  });

  it('should extract glassdoor salary in K-notation', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_SALARY_MOCK,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    // Salary should be attached as metadata
    const netflixJob = result.data!.find((j) => j.title === 'Senior Engineer');
    expect(netflixJob).toBeDefined();
    // Check that salary was extracted by inspecting the raw job object
    expect((netflixJob as Record<string, unknown>).salary).toBeDefined();
  });

  it('should extract glassdoor company rating', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_SALARY_MOCK,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    const netflixJob = result.data!.find((j) => j.company === 'Netflix');
    expect((netflixJob as Record<string, unknown>).rating).toBe('4.2');
  });
});

describe('JinaReaderScraper - Error Handling', () => {
  it('should handle HTTP error status codes', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 403,
      statusText: 'Forbidden',
      data: 'Forbidden',
    });

    const scraper = new JinaReaderScraper('indeed');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });

  it('should handle network errors gracefully', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toBe('ETIMEDOUT');
  });

  it('should handle unknown source names', async () => {
    const scraper = new JinaReaderScraper('nonexistent');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown source');
  });

  it('should handle very short/empty response', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: 'OK',
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});

describe('JinaReaderScraper - Dedup', () => {
  it('should deduplicate identical jobs within a single scrape', async () => {
    const duplicateMarkdown = `
## Software Engineer
**Company:** Google
**Location:** Mountain View, CA

## Software Engineer
**Company:** Google
**Location:** Mountain View, CA

## Different Job
**Company:** Google
**Location:** Mountain View, CA
`;

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: duplicateMarkdown,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    // Should have 2 jobs (not 3), because the duplicate "Software Engineer at Google" is skipped
    expect(result.data).toHaveLength(2);
  });
});

describe('JinaReaderScraper - Rate Limiting', () => {
  it('should call rateLimiter.wait() before each request', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_SINGLE,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    await scraper.scrape({ query: '', maxJobs: 5 });

    expect(rateLimiter.wait).toHaveBeenCalledTimes(1);
  });
});
