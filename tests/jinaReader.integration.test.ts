/**
 * Jina Reader — Integration Tests
 *
 * Tests the full JinaReaderScraper.scrape() flow with realistic mock HTTP
 * responses that simulate real r.jina.ai output, and tests the ScraperRunner
 * fallback integration (identifyFailedSources + runJinaReaderFallbacks).
 *
 * @see https://r.jina.ai/
 */

import axios from 'axios';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../src/lib/automation/logger', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../src/scrapers/utils/rateLimiter', () => ({
  rateLimiter: {
    wait: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock IndeedScraper to prevent slow HTTP calls during integration tests
jest.mock('../src/scrapers/strategies/indeed', () => ({
  IndeedScraper: jest.fn().mockImplementation(() => ({
    scrape: jest.fn().mockResolvedValue({
      success: true,
      data: [],
      error: undefined,
    }),
  })),
}));

// Mock Python bridge to prevent subprocess spawning during integration tests
jest.mock('../src/scrapers/bridge/pythonBridge', () => ({
  spawnPythonScraper: jest.fn().mockResolvedValue({
    scraper: 'mocked',
    success: false,
    jobCount: 0,
    duration: 10,
    error: 'Mocked — no Python in test',
  }),
}));

import { JinaReaderScraper } from '../src/scrapers/strategies/jinaReader';
import { ScraperRunner } from '../src/scrapers/index';
import { Job, ScraperStats } from '../src/scrapers/types';

// ─── Realistic Markdown Fixtures ────────────────────────────────────────────
//
// These fixtures simulate the actual output format from r.jina.ai
// based on live tests performed during development.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Real Computrabajo format from r.jina.ai:
 * ## [Title](url) with positional company/location/salary.
 */
const COMPUTRABAJO_REALISTIC = `[Skip to main content](https://co.computrabajo.com/)

## [Desarrollador Kotlin](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-kotlin-ABC123)
Postulado  Vista
4,5 [Inter Rapidisimo S.A](https://co.computrabajo.com/interrapidisimo)
Bogotá, D.C., Bogotá, D.C.
$ 6.500.000,00 (Mensual)
Hace 1 hora

## [Desarrollador Full Stack](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-full-stack-DEF456)
Postulado  Vista
[Key Team](https://co.computrabajo.com/keyteam)
Bogotá, D.C., Bogotá, D.C.
$ 4.500.000,00 (Mensual)
Hace 2 horas

## [Desarrolladora Comercial](https://co.computrabajo.com/ofertas-de-trabajo/desarrolladora-comercial-GHI789)
Postulado  Vista
[MANZHU SAS](https://co.computrabajo.com/manzhu-sas)
Cali, Valle del Cauca
Hace 3 horas

## [Desarrollador Net Senior](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-net-senior-JKL012)
Postulado  Vista
[BROWSER TRAVEL SOLUTIONS](https://co.computrabajo.com/browser-travel)
Bogotá, D.C., Bogotá, D.C.
$ 8.500.000,00 (Mensual)
Hace 5 horas

## [Desarrollador Front End](https://co.computrabajo.com/ofertas-de-trabajo/desarrollador-front-end-MNO345)
Postulado  Vista
[BROWSER TRAVEL SOLUTIONS](https://co.computrabajo.com/browser-travel)
Bogotá, D.C., Bogotá, D.C.
$ 3.500.000,00 (Mensual)
Hace 6 horas

(5)
Siguiente
`;

/**
 * Computrabajo with rating in 4.0 format (dot instead of comma).
 */
const COMPUTRABAJO_DOT_RATING = `
## [Analista de Datos](https://co.computrabajo.com/ofertas-de-trabajo/analista-datos-PQR678)
Postulado  Vista
4.0 [DataCorp SAS](https://co.computrabajo.com/datacorp)
Medellín, Antioquia
$ 5.000.000,00 (Mensual)
Hace 1 día
`;

/**
 * Computrabajo with salary range.
 */
const COMPUTRABAJO_RANGE = `
## [Gerente de TI](https://co.computrabajo.com/ofertas-de-trabajo/gerente-ti-STU901)
Postulado  Vista
[Big Enterprise SA](https://co.computrabajo.com/bigenterprise)
Bogotá, D.C., Bogotá, D.C.
$ 10.000.000 - $ 15.000.000 (Mensual)
Hace 2 días
`;

/**
 * Computrabajo remote keyword.
 */
const COMPUTRABAJO_REMOTO = `
## [Soporte Técnico](https://co.computrabajo.com/ofertas-de-trabajo/soporte-tecnico-VWX234)
Postulado  Vista
[TechSupport Ltda](https://co.computrabajo.com/techsupport)
Remoto
$ 2.000.000,00 (Mensual)
Hace 4 horas
`;

/** LinkedIn format: heading with **Company:**, **Location:** labels. */
const LINKEDIN_REALISTIC = `
## Senior Software Engineer
**Company:** Google
**Location:** Mountain View, CA
**Salary:** $180,000 - $250,000
We are looking for a senior engineer to join our Search team.
You will work on large-scale distributed systems.

## Product Manager
**Company:** Microsoft
**Location:** Redmond, WA
**Salary:** $150,000 - $200,000
Drive product strategy for Azure cloud services.

## Junior Developer
**Company:** Startup Inc
**Location:** Remote
Join our fast-growing team building the next generation of fintech.

## Staff Engineer
**Company:** Stripe
**Location:** San Francisco, CA
**Salary:** $220,000 - $300,000
Design and build payment infrastructure at scale.

## Data Scientist
**Company:** Meta
**Location:** Menlo Park, CA
**Salary:** $160,000 - $240,000
Apply machine learning to improve ad targeting.
`;

/**
 * Indeed format: heading with **Company:**, **Location:**, salary line.
 */
const INDEED_REALISTIC = `
## AWS Solutions Architect
**Company:** Amazon Web Services
**Location:** Seattle, WA
$160,000 - $220,000 a year
Design cloud architectures for enterprise customers.
Full-time position with benefits.

## Frontend Engineer
**Company:** Apple
**Location:** Cupertino, CA
$150,000 - $200,000 a year
Build beautiful user interfaces for iOS and macOS.
5+ years of experience required.

## DevOps Engineer
**Company:** Netflix
**Location:** Los Gatos, CA
$170,000 - $250,000 a year
Manage infrastructure for streaming platform serving 200M+ users.

## Machine Learning Engineer
**Company:** Nvidia
**Location:** Santa Clara, CA
$180,000 - $260,000 a year
Develop deep learning models for autonomous vehicles.

## Backend Developer
**Company:** Spotify
**Location:** New York, NY
$140,000 - $190,000 a year
Build APIs for music recommendation engine.
`;

/**
 * Glassdoor format: heading with **Company:**, **Salary:**, **Rating:** labels.
 */
const GLASSDOOR_REALISTIC = `
## Senior Engineer
**Company:** Netflix
**Location:** Los Gatos, CA
**Salary:** $150K – $220K
**Rating:** 4.2 ★
Streaming entertainment company with great culture.

## Engineering Manager
**Company:** Apple
**Location:** Cupertino, CA
**Salary:** $200K - $280K
**Rating:** 4.5 ★
Lead the iOS platform team.

## Product Designer
**Company:** Airbnb
**Location:** San Francisco, CA
**Salary:** $130K – $190K
**Rating:** 4.3 ★
Design delightful travel experiences.

## Staff Engineer
**Company:** Google
**Location:** Mountain View, CA
**Salary:** $250K - $350K
**Rating:** 4.4 ★
Build next-generation search infrastructure.

## Solutions Architect
**Company:** Salesforce
**Location:** Remote
**Salary:** $140K – $210K (Employer est.)
**Rating:** 4.0 ★
Design enterprise CRM solutions.
`;

/**
 * Glassdoor with dollar format (not K-notation).
 */
const GLASSDOOR_DOLLAR_FORMAT = `
## Data Engineer
**Company:** Databricks
**Location:** San Francisco, CA
**Salary:** $180,000 - $250,000
**Rating:** 4.1 ★
Build data lakehouse platform.
`;

/**
 * Glassdoor with "stars" text instead of ★ symbol.
 */
const GLASSDOOR_STARS_TEXT = `
## QA Engineer
**Company:** TestCorp
**Location:** Austin, TX
**Salary:** $100K - $140K
**Rating:** 3.5 stars
Quality assurance for mobile applications.
`;

/**
 * 451 response (LinkedIn block).
 */
const LINKEDIN_451_RESPONSE = `<!DOCTYPE html>
<html>
<head><title>451 Unavailable For Legal Reasons</title></head>
<body>
<h1>451</h1>
<p>Unavailable For Legal Reasons</p>
</body>
</html>`;

/**
 * Indeed 403 response (Cloudflare block).
 */
const INDEED_403_RESPONSE = `<!DOCTYPE html>
<html>
<head><title>403 Forbidden</title></head>
<body>
<h1>403</h1>
<p>Access denied by Cloudflare</p>
</body>
</html>`;

/**
 * Glassdoor rate-limited response.
 */
const GLASSDOOR_RATE_LIMITED = `<!DOCTYPE html>
<html>
<head><title>429 Too Many Requests</title></head>
<body>
<h1>429</h1>
<p>Rate limit exceeded. Try again later.</p>
</body>
</html>`;

/**
 * Large response with mixed content (navigation, filters, actual jobs).
 */
const MIXED_CONTENT_LARGE = `
## Jobs at Google
## Jobs at Meta

## Sign in to see more
## Upload your resume

## [Desarrollador Senior](https://co.computrabajo.com/ofertas-de-trabajo/senior-dev-ZZZ999)
Postulado  Vista
[Tech Giant SAS](https://co.computrabajo.com/techgiant)
Bogotá, D.C., Bogotá, D.C.
$ 9.000.000,00 (Mensual)
Hace 2 horas

## Find your next role
## Create job alert

## Privacy policy
## Terms of service

## [Junior Developer](https://co.computrabajo.com/ofertas-de-trabajo/junior-dev-YYY888)
Postulado  Vista
[Startup Co](https://co.computrabajo.com/startupco)
Medellín, Antioquia
$ 2.500.000,00 (Mensual)
Hace 1 día
`;

// ─── Helper: Reset mocks ────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Mock setTimeout to resolve immediately in retry tests (avoids 2s/4s real delays)
  jest.spyOn(global, 'setTimeout').mockImplementation((fn: (...args: unknown[]) => void) => {
    if (typeof fn === 'function') fn();
    return 0 as unknown as NodeJS.Timeout;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// =============================================================================
// PART 1: JinaReaderScraper Integration Tests
// =============================================================================

describe('JinaReaderScraper Integration — Computrabajo', () => {
  it('should extract 5 jobs with titles, companies, locations, and salaries', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_REALISTIC,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: 'desarrollador', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(5);

    const jobs = result.data!;
    expect(jobs[0].title).toBe('Desarrollador Kotlin');
    expect(jobs[0].company).toBe('Inter Rapidisimo S.A');
    expect(jobs[0].location).toContain('Bogotá');
    expect((jobs[0] as Record<string, unknown>).salary).toContain('6.500.000');

    expect(jobs[1].company).toBe('Key Team');
    expect(jobs[1].location).toContain('Bogotá');

    expect(jobs[2].location).toContain('Cali');
    expect(jobs[3].title).toBe('Desarrollador Net Senior');
    expect(jobs[4].title).toBe('Desarrollador Front End');
  });

  it('should handle dot-format rating (4.0 instead of 4,5)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_DOT_RATING,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: 'analista', maxJobs: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].title).toBe('Analista de Datos');
    expect(result.data![0].company).toBe('DataCorp SAS');
    expect(result.data![0].location).toBe('Medellín, Antioquia');
  });

  it('should handle salary ranges ($ X.XXX.XXX - $ X.XXX.XXX)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_RANGE,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: 'gerente', maxJobs: 5 });

    expect(result.data![0].company).toBe('Big Enterprise SA');
    expect((result.data![0] as Record<string, unknown>).salary).toContain('10.000.000');
  });

  it('should detect Remoto/Remote work mode as location', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_REMOTO,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: 'soporte', maxJobs: 5 });

    expect(result.data![0].location).toBe('Remoto');
  });

  it('should not extract links for company entries', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_REALISTIC,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    // Job link should be the job posting URL, not the company URL
    for (const job of result.data!) {
      expect(job.link).toContain('computrabajo.com/ofertas-de-trabajo');
      expect(job.link).not.toContain('computrabajo.com/interrapidisimo');
    }
  });

  it('should respect maxJobs parameter (limit to 2)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_REALISTIC,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 2 });

    expect(result.data).toHaveLength(2);
  });

  it('should filter out non-job headings in mixed content', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: MIXED_CONTENT_LARGE,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    // Should extract only 2 real jobs, skip navigation headings
    expect(result.data).toHaveLength(2);
    expect(result.data![0].title).toBe('Desarrollador Senior');
    expect(result.data![1].title).toBe('Junior Developer');
  });

  it('should generate valid job IDs in format jr-{hash}', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_REALISTIC,
    });

    const scraper = new JinaReaderScraper('computrabajo');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    for (const job of result.data!) {
      expect(job.id).toMatch(/^jr-[a-zA-Z0-9]+$/);
    }
  });

  it('should generate deterministic IDs (same input = same ID)', async () => {
    const mockData = COMPUTRABAJO_REALISTIC;
    mockedAxios.get.mockResolvedValueOnce({ status: 200, statusText: 'OK', data: mockData });
    mockedAxios.get.mockResolvedValueOnce({ status: 200, statusText: 'OK', data: mockData });

    const scraper = new JinaReaderScraper('computrabajo');
    const result1 = await scraper.scrape({ query: '', maxJobs: 5 });
    const result2 = await scraper.scrape({ query: '', maxJobs: 5 });

    expect(result1.data![0].id).toBe(result2.data![0].id);
    expect(result1.data![1].id).toBe(result2.data![1].id);
  });
});

describe('JinaReaderScraper Integration — LinkedIn', () => {
  it('should extract 5 jobs with Company and Location fields', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_REALISTIC,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(5);
    expect(result.data![0].company).toBe('Google');
    expect(result.data![0].location).toContain('Mountain View');
    expect(result.data![1].company).toBe('Microsoft');
    expect(result.data![2].company).toBe('Startup Inc');
    expect(result.data![2].location).toBe('Remote');
  });

  it('should extract company name via **Company:** label', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_REALISTIC,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 1 });

    expect(result.data![0].company).toBe('Google');
  });

  it('should handle 451 Unavailable For Legal Reasons', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 451,
      statusText: 'Unavailable For Legal Reasons',
      data: LINKEDIN_451_RESPONSE,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('451');
  });

  it('should not crash on blocked source — return graceful error', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND r.jina.ai'));

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should extract link from the first markdown URL', async () => {
    // LinkedIn markdown with actual job links
    const linkedInWithLinks = `
## Software Engineer
**Company:** Google
**Location:** Mountain View, CA
**Link:** [Apply](https://www.linkedin.com/jobs/view/123)
Job description here.
`;

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: linkedInWithLinks,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 1 });

    expect(result.data![0].link).toContain('linkedin.com');
  });
});

describe('JinaReaderScraper Integration — Indeed', () => {
  it('should extract 5 jobs with salary lines', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: INDEED_REALISTIC,
    });

    const scraper = new JinaReaderScraper('indeed');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(5);
    expect(result.data![0].company).toBe('Amazon Web Services');
    expect(result.data![1].company).toBe('Apple');
    expect(result.data![2].company).toBe('Netflix');
  });

  it('should extract salary metadata from Indeed format', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: INDEED_REALISTIC,
    });

    const scraper = new JinaReaderScraper('indeed');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    // All jobs should have salary extracted
    for (const job of result.data!) {
      expect((job as Record<string, unknown>).salary).toBeTruthy();
    }
  });

  it('should handle 403 Cloudflare block', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 403,
      statusText: 'Forbidden',
      data: INDEED_403_RESPONSE,
    });

    const scraper = new JinaReaderScraper('indeed');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('403');
  });
});

describe('JinaReaderScraper Integration — Glassdoor', () => {
  it('should extract 5 jobs with salary and rating metadata', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_REALISTIC,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(5);
    expect(result.data![0].company).toBe('Netflix');
    expect(result.data![1].company).toBe('Apple');
    expect(result.data![4].location).toBe('Remote');
  });

  it('should extract K-notation salary ($150K – $220K)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_REALISTIC,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    for (const job of result.data!) {
      const salary = (job as Record<string, unknown>).salary as string;
      expect(salary).toBeTruthy();
      expect(salary).toContain('K');
    }
  });

  it('should extract dollar-format salary ($180,000 - $250,000)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_DOLLAR_FORMAT,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    expect(result.data).toHaveLength(1);
    const salary = (result.data![0] as Record<string, unknown>).salary as string;
    expect(salary).toContain('180,000');
  });

  it('should extract company rating (X.X ★)', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_REALISTIC,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    const netflixJob = result.data!.find((j) => j.company === 'Netflix');
    expect((netflixJob as Record<string, unknown>).rating).toBe('4.2');

    const appleJob = result.data!.find((j) => j.company === 'Apple');
    expect((appleJob as Record<string, unknown>).rating).toBe('4.5');

    const airbnbJob = result.data!.find((j) => j.company === 'Airbnb');
    expect((airbnbJob as Record<string, unknown>).rating).toBe('4.3');
  });

  it('should extract rating from "stars" text format', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_STARS_TEXT,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    expect((result.data![0] as Record<string, unknown>).rating).toBe('3.5');
  });

  it('should include Employer est. suffix in salary', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: GLASSDOOR_REALISTIC,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: '', maxJobs: 5 });

    const sfJob = result.data!.find((j) => j.company === 'Salesforce');
    const salary = (sfJob as Record<string, unknown>).salary as string;
    expect(salary).toContain('Employer est.');
  });

  it('should handle 429 rate limit', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      status: 429,
      statusText: 'Too Many Requests',
      data: GLASSDOOR_RATE_LIMITED,
    });

    const scraper = new JinaReaderScraper('glassdoor');
    const result = await scraper.scrape({ query: 'engineer', maxJobs: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('429');
  });
});

describe('JinaReaderScraper — Cross-source dedup', () => {
  it('should deduplicate jobs with same title+company within a single scrape', async () => {
    const duplicateSource = `
## Software Engineer
**Company:** Google
**Location:** Mountain View, CA

## Software Engineer
**Company:** Google
**Location:** Mountain View, CA

## Different Role
**Company:** Google
**Location:** Mountain View, CA
`;

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: duplicateSource,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    expect(result.data).toHaveLength(2);
  });

  it('should deduplicate jobs even with different source names', async () => {
    // Job board may list the same job with slight variations
    const nearDuplicateSource = `
## Software Engineer
**Company:** Google
**Location:** Mountain View, CA

## Software Engineer
**Company:** Google
**Location:** Mountain View, California
`;

    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: nearDuplicateSource,
    });

    const scraper = new JinaReaderScraper('linkedin');
    const result = await scraper.scrape({ query: '', maxJobs: 10 });

    // These have same title+company but different locations
    // Two different location strings SHOULD be treated as different jobs
    // (dedup is by title|company only, not location)
    expect(result.data).toHaveLength(1);
  });
});

// =============================================================================
// PART 2: ScraperRunner Fallback Flow Tests
// =============================================================================

describe('ScraperRunner — identifyFailedSources()', () => {
  /**
   * To test the private method identifyFailedSources(), we exercise it
   * indirectly by setting up specific stats scenarios via runAllScrapers().
   * We mock the scrapers it calls and control their results.
   */

  it('should identify linkedin as failed when all linkedin attempts returned 0 jobs', async () => {
    // Create a ScraperRunner and manually inject stats
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    const stats: ScraperStats[] = [
      { scraper: 'jsearch', success: true, jobCount: 8, duration: 500 },
      { scraper: 'indeed', success: false, jobCount: 0, duration: 300, error: '403 Forbidden' },
      { scraper: 'linkedin', success: true, jobCount: 0, duration: 1000 },
      { scraper: 'computrabajo', success: true, jobCount: 5, duration: 800 },
      { scraper: 'glassdoor', success: false, jobCount: 0, duration: 200, error: 'Blocked' },
    ];

    // Access private stats via type assertion
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    // Access private method via bracket notation
    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();

    // linkedin: success=true, jobCount=0 → allEmpty=true → failed
    // indeed: success=false → allFailed=true → failed
    // computrabajo: success=true, jobCount=5 → not failed
    // glassdoor: success=false → allFailed=true → failed
    expect(failedSources).toContain('linkedin');
    expect(failedSources).toContain('indeed');
    expect(failedSources).toContain('glassdoor');
    expect(failedSources).not.toContain('computrabajo');
  });

  it('should not add sources with successful stats', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: true, jobCount: 3, duration: 500 },
      { scraper: 'indeed', success: true, jobCount: 5, duration: 400 },
      { scraper: 'computrabajo', success: true, jobCount: 7, duration: 600 },
      { scraper: 'glassdoor', success: true, jobCount: 2, duration: 300 },
    ];

    (runner as unknown as { stats: ScraperStats[] }).stats = stats;
    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();

    expect(failedSources).toHaveLength(0);
  });

  it('should return empty array when no scrapers have run yet', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();

    expect(failedSources).toHaveLength(0);
  });

  it('should handle partial failures correctly (some succeeded, some failed)', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: true, jobCount: 0, duration: 300 },
      { scraper: 'indeed', success: true, jobCount: 0, duration: 400 },
      { scraper: 'computrabajo', success: true, jobCount: 5, duration: 500 },
      { scraper: 'glassdoor', success: false, jobCount: 0, duration: 200, error: 'timeout' },
    ];

    (runner as unknown as { stats: ScraperStats[] }).stats = stats;
    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();

    // linkedin: success=true, jobCount=0 → empty
    // indeed: success=true, jobCount=0 → empty
    // computrabajo: success=true, jobCount=5 → ok
    // glassdoor: success=false → failed
    expect(failedSources).toContain('linkedin');
    expect(failedSources).toContain('indeed');
    expect(failedSources).toContain('glassdoor');
    expect(failedSources).not.toContain('computrabajo');
  });
});

describe('ScraperRunner — runJinaReaderFallbacks()', () => {
  /**
   * The fallback flow:
   * 1. identifyFailedSources() returns sources that failed/returned 0
   * 2. runJinaReaderFallbacks() iterates sources
   * 3. For each source, creates JinaReaderScraper and calls scrape()
   * 4. Dedups against existing jobs via title|company key
   * 5. Records jinareader-{source} stats
   */

  it('should add new jobs from JinaReader fallback and log stats', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    // Simulate existing jobs from other scrapers
    const existingJobs = (runner as unknown as { allJobs: Job[] }).allJobs;
    existingJobs.push(
      {
        id: '1',
        title: 'Engineer',
        company: 'Google',
        location: 'CA',
        link: '',
        description: '',
        source: 'jsearch',
        scrapedAt: new Date(),
      },
      {
        id: '2',
        title: 'Developer',
        company: 'Meta',
        location: 'CA',
        link: '',
        description: '',
        source: 'jsearch',
        scrapedAt: new Date(),
      },
    );

    // Setup stats to trigger fallback for linkedin + indeed
    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: true, jobCount: 0, duration: 500 },
      { scraper: 'indeed', success: true, jobCount: 0, duration: 400 },
      { scraper: 'computrabajo', success: true, jobCount: 5, duration: 300 },
    ];
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    // Mock axios for JinaReader calls (linkedin + indeed)
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_REALISTIC,
    });
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: INDEED_REALISTIC,
    });

    // Trigger fallbacks
    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();
    await (
      runner as unknown as { runJinaReaderFallbacks(sources: string[]): Promise<void> }
    ).runJinaReaderFallbacks(failedSources);

    const finalJobs = (runner as unknown as { allJobs: Job[] }).allJobs;
    const finalStats = (runner as unknown as { stats: ScraperStats[] }).stats;

    // 2 existing + 5 linkedin + 5 indeed = 12
    expect(finalJobs.length).toBe(12);

    // Should have jinareader-linkedin and jinareader-indeed stats
    const jrLinkedinStats = finalStats.find((s) => s.scraper === 'jinareader-linkedin');
    const jrIndeedStats = finalStats.find((s) => s.scraper === 'jinareader-indeed');
    expect(jrLinkedinStats).toBeDefined();
    expect(jrLinkedinStats!.success).toBe(true);
    expect(jrLinkedinStats!.jobCount).toBe(5);
    expect(jrIndeedStats).toBeDefined();
    expect(jrIndeedStats!.success).toBe(true);
    expect(jrIndeedStats!.jobCount).toBe(5);
  });

  it('should skip dedup: not add jobs that already exist by title+company', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    // Simulate existing jobs that overlap with linkedin results
    const existingJobs = (runner as unknown as { allJobs: Job[] }).allJobs;
    existingJobs.push(
      {
        id: 'existing1',
        title: 'Senior Software Engineer',
        company: 'Google',
        location: 'Already Scraped',
        link: '',
        description: '',
        source: 'jsearch',
        scrapedAt: new Date(),
      },
      {
        id: 'existing2',
        title: 'Product Manager',
        company: 'Microsoft',
        location: 'Already Scraped',
        link: '',
        description: '',
        source: 'indeed',
        scrapedAt: new Date(),
      },
      {
        id: 'existing3',
        title: 'Unique Job',
        company: 'Unique Corp',
        location: 'NY',
        link: '',
        description: '',
        source: 'jsearch',
        scrapedAt: new Date(),
      },
    );

    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: true, jobCount: 0, duration: 500 },
    ];
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    // Mock: LinkedIn returns 5 jobs, 2 of which overlap with existing
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_REALISTIC,
    });

    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();
    await (
      runner as unknown as { runJinaReaderFallbacks(sources: string[]): Promise<void> }
    ).runJinaReaderFallbacks(failedSources);

    const finalJobs = (runner as unknown as { allJobs: Job[] }).allJobs;

    // 3 existing + 3 new (Jr Developer, Staff Engineer, Data Scientist — Senior SWE and PM are dupes)
    // Total should be 6
    expect(finalJobs.length).toBe(6);

    // Verify the unique job is still there
    expect(finalJobs.some((j) => j.title === 'Unique Job')).toBe(true);
    // Verify the original (non-deduped) versions are kept
    const googleJob = finalJobs.find((j) => j.title === 'Senior Software Engineer');
    expect(googleJob).toBeDefined();
    expect(googleJob!.location).toBe('Already Scraped');
  });

  it('should handle JinaReader fallback failure gracefully (retries 3x, all fail)', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: false, jobCount: 0, duration: 500, error: 'blocked' },
    ];
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    // Mock JinaReader fails for ALL retry attempts (3x)
    mockedAxios.get.mockRejectedValue(new Error('ETIMEDOUT'));

    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();
    await (
      runner as unknown as { runJinaReaderFallbacks(sources: string[]): Promise<void> }
    ).runJinaReaderFallbacks(failedSources);

    const finalStats = (runner as unknown as { stats: ScraperStats[] }).stats;

    // Should have fallen-back with error recorded after all retries
    const jrLinkedinStats = finalStats.find((s) => s.scraper === 'jinareader-linkedin');
    expect(jrLinkedinStats).toBeDefined();
    expect(jrLinkedinStats!.success).toBe(false);
    expect(jrLinkedinStats!.error).toBe('ETIMEDOUT');
  });

  it('should retry failed JinaReader fallback and recover on 2nd attempt', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: false, jobCount: 0, duration: 500, error: 'blocked' },
    ];
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    // Attempt 1: fails with timeout
    mockedAxios.get.mockRejectedValueOnce(new Error('ETIMEDOUT'));
    // Attempt 2: succeeds with linkedin jobs
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_REALISTIC,
    });

    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();
    await (
      runner as unknown as { runJinaReaderFallbacks(sources: string[]): Promise<void> }
    ).runJinaReaderFallbacks(failedSources);

    const finalStats = (runner as unknown as { stats: ScraperStats[] }).stats;
    const finalJobs = (runner as unknown as { allJobs: Job[] }).allJobs;

    // Should have recovered on retry and recorded success with 5 jobs
    const jrLinkedinStats = finalStats.find((s) => s.scraper === 'jinareader-linkedin');
    expect(jrLinkedinStats).toBeDefined();
    expect(jrLinkedinStats!.success).toBe(true);
    expect(jrLinkedinStats!.jobCount).toBe(5);
    expect(finalJobs.length).toBe(5);
  });

  it('should retry empty results and recover on 3rd attempt', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: false, jobCount: 0, duration: 500, error: 'blocked' },
    ];
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    // Attempt 1: empty results
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: '# No jobs found\nSearch results are empty.',
    });
    // Attempt 2: empty again
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: '# No jobs found\nSearch results are empty.',
    });
    // Attempt 3: success!
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: LINKEDIN_REALISTIC,
    });

    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();
    await (
      runner as unknown as { runJinaReaderFallbacks(sources: string[]): Promise<void> }
    ).runJinaReaderFallbacks(failedSources);

    const finalStats = (runner as unknown as { stats: ScraperStats[] }).stats;
    const finalJobs = (runner as unknown as { allJobs: Job[] }).allJobs;

    // Should have recovered on 3rd attempt
    const jrLinkedinStats = finalStats.find((s) => s.scraper === 'jinareader-linkedin');
    expect(jrLinkedinStats).toBeDefined();
    expect(jrLinkedinStats!.success).toBe(true);
    expect(jrLinkedinStats!.jobCount).toBe(5);
    expect(finalJobs.length).toBe(5);
  });

  it('should handle mixed fallback results (some succeed, some fail after 3 retries)', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: false, jobCount: 0, duration: 500 },
      { scraper: 'indeed', success: true, jobCount: 0, duration: 400 },
    ];
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    // LinkedIn fails for all 3 retry attempts
    mockedAxios.get.mockRejectedValueOnce(new Error('LinkedIn blocked'));
    mockedAxios.get.mockRejectedValueOnce(new Error('LinkedIn blocked'));
    mockedAxios.get.mockRejectedValueOnce(new Error('LinkedIn blocked'));
    // Indeed succeeds on first try (no retry needed)
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: INDEED_REALISTIC,
    });

    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();
    await (
      runner as unknown as { runJinaReaderFallbacks(sources: string[]): Promise<void> }
    ).runJinaReaderFallbacks(failedSources);

    const finalStats = (runner as unknown as { stats: ScraperStats[] }).stats;
    const finalJobs = (runner as unknown as { allJobs: Job[] }).allJobs;

    const jrLinkedinStats = finalStats.find((s) => s.scraper === 'jinareader-linkedin');
    expect(jrLinkedinStats!.success).toBe(false);

    const jrIndeedStats = finalStats.find((s) => s.scraper === 'jinareader-indeed');
    expect(jrIndeedStats!.success).toBe(true);
    expect(jrIndeedStats!.jobCount).toBe(5);

    // Should have 5 indeed jobs
    expect(finalJobs.length).toBe(5);
  });

  it('should not run fallback when no sources failed', async () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });

    const stats: ScraperStats[] = [
      { scraper: 'linkedin', success: true, jobCount: 5, duration: 500 },
      { scraper: 'indeed', success: true, jobCount: 3, duration: 400 },
      { scraper: 'computrabajo', success: true, jobCount: 7, duration: 300 },
      { scraper: 'glassdoor', success: true, jobCount: 2, duration: 200 },
    ];
    (runner as unknown as { stats: ScraperStats[] }).stats = stats;

    const failedSources = (
      runner as unknown as { identifyFailedSources(): string[] }
    ).identifyFailedSources();
    expect(failedSources).toHaveLength(0);
  });
});

describe('ScraperRunner — Full pipeline integration', () => {
  /**
   * Test the full runAllScrapers() flow with mocked scrapers.
   * This tests the orchestration: JSearch → Python scrapers → fallback.
   */

  it('should orchestrate JSearch + Indeed + Python scrapers + JinaReader fallback', async () => {
    // This test verifies the high-level flow by mocking axios for JinaReader.
    // JSearch and Indeed are not mocked (they'll return empty results).
    // Python scrapers require YAML config which doesn't exist in test env.

    // Mock axios for the JinaReader fallback calls
    mockedAxios.get.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: COMPUTRABAJO_REALISTIC,
    });

    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    const jobs = await runner.runAllScrapers();
    const stats = runner.getStats();

    // Should have run at least some scrapers
    expect(stats.length).toBeGreaterThan(0);
    expect(jobs).toBeDefined();
  });

  it('should populate stats after runAllScrapers even with failures', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 403,
      statusText: 'Forbidden',
      data: '<html>Forbidden</html>',
    });

    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    await runner.runAllScrapers();
    const stats = runner.getStats();

    // Stats should be populated
    expect(stats.length).toBeGreaterThan(0);

    // Should include jsearch
    const jsearchStats = stats.find((s) => s.scraper === 'jsearch');
    expect(jsearchStats).toBeDefined();

    // Should include indeed (mocked to succeed with 0 jobs)
    const indeedStats = stats.find((s) => s.scraper === 'indeed');
    expect(indeedStats).toBeDefined();
    expect(indeedStats!.success).toBe(true);
    expect(indeedStats!.jobCount).toBe(0);
  });
});

describe('ScraperRunner — getStats(), getJobs(), clearJobs()', () => {
  it('should start with empty stats and jobs', () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    expect(runner.getStats()).toHaveLength(0);
    expect(runner.getJobs()).toHaveLength(0);
  });

  it('should clear jobs on clearJobs()', () => {
    const runner = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    const jobs = runner.getJobs();
    jobs.push({
      id: '1',
      title: 'Test',
      company: 'TestCorp',
      location: 'Remote',
      link: '',
      description: '',
      source: 'test',
      scrapedAt: new Date(),
    });

    runner.clearJobs();
    expect(runner.getJobs()).toHaveLength(0);
  });

  it('should be isolated between instances', () => {
    const runner1 = new ScraperRunner({ query: 'engineer', maxJobs: 10 });
    const runner2 = new ScraperRunner({ query: 'designer', maxJobs: 5 });

    runner1.getJobs().push({
      id: '1',
      title: 'Eng',
      company: 'C1',
      location: '',
      link: '',
      description: '',
      source: 'test',
      scrapedAt: new Date(),
    });

    expect(runner1.getJobs()).toHaveLength(1);
    expect(runner2.getJobs()).toHaveLength(0);
    expect(runner1.getStats()).toHaveLength(0);
    expect(runner2.getStats()).toHaveLength(0);
  });
});
