/**
 * Jina Reader Job Scraper
 *
 * Uses Jina Reader API (https://r.jina.ai/) to extract job listings from
 * LinkedIn and Indeed as a fallback when direct scrapers fail.
 *
 * Jina Reader's headless Chrome can render JavaScript-heavy pages that
 * traditional HTTP scrapers and Scrapling cannot handle, making it ideal
 * for sites like LinkedIn (currently blocked) and Indeed (intermittent).
 *
 * @see https://github.com/jina-ai/reader
 * @see https://r.jina.ai/
 */

import axios from 'axios';
import path from 'path';
import { Job, ScraperConfig, ScraperResult } from '../types';
import { rateLimiter } from '../utils/rateLimiter';
import { logger } from '../../lib/automation/logger';

// ─── Configuration ─────────────────────────────────────────────────────────

const JINA_READER_BASE = process.env.JINA_READER_BASE_URL || 'https://r.jina.ai';

interface SourceConfig {
  name: string;
  buildUrl: (query: string) => string;
  parseMarkdown: (markdown: string) => Partial<Job>[];
}

// Timeout for Jina Reader requests (it uses headless Chrome, so it's slower)
const JINA_TIMEOUT_MS = 45_000;

// ─── Source Definitions ────────────────────────────────────────────────────

const SOURCES: Record<string, SourceConfig> = {
  linkedin: {
    name: 'linkedin',
    buildUrl: (query: string) =>
      `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(query)}&f_TPR=r2592000&location=`,
    parseMarkdown: (markdown: string) => parseLinkedInMarkdown(markdown),
  },
  indeed: {
    name: 'indeed',
    buildUrl: (query: string) =>
      `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&sort=date&fromage=3`,
    parseMarkdown: (markdown: string) => parseIndeedMarkdown(markdown),
  },
  computrabajo: {
    name: 'computrabajo',
    buildUrl: (query: string) => buildComputrabajoUrl(query),
    parseMarkdown: (markdown: string) => parseComputrabajoMarkdown(markdown),
  },
  glassdoor: {
    name: 'glassdoor',
    buildUrl: (query: string) =>
      `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(query)}&fromage=7`,
    parseMarkdown: (markdown: string) => parseGlassdoorMarkdown(markdown),
  },
};

/**
 * Build Computrabajo search URL from query.
 * Uses the base URL from scrapers.yaml or defaults to co.computrabajo.com.
 */
function buildComputrabajoUrl(query: string): string {
  const country = process.env.COMPUTRABAJO_COUNTRY || 'co';
  const baseUrl = process.env.COMPUTRABAJO_BASE_URL || `https://${country}.computrabajo.com`;
  const slug = query
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${baseUrl}/trabajo-de-${slug}?q=${encodeURIComponent(query)}`;
}

// ─── Parser: LinkedIn ──────────────────────────────────────────────────────

/**
 * Parse LinkedIn job search results from Jina Reader markdown.
 *
 * LinkedIn renders as a list of job cards. Jina Reader typically outputs:
 *
 * ## Senior Software Engineer
 * **Company:** Google
 * **Location:** Mountain View, CA
 * ...
 *
 * Or as bulleted items with key-value pairs.
 */
function parseLinkedInMarkdown(markdown: string): Partial<Job>[] {
  const jobs: Partial<Job>[] = [];
  const seen = new Set<string>();

  // Strategy 1: Heading-based job blocks (## Title pattern)
  // Split by ## headings — each block is a potential job
  const headingBlocks = markdown.split(/(?=^##\s)/m);
  for (const block of headingBlocks) {
    if (!block.trim()) continue;

    const title = extractTitle(block);
    if (!title) continue;

    const company = extractField(block, 'company') || extractAfterPrefix(block, ['at', '·', '|']);
    const location = extractField(block, 'location') || extractLocationFromLine(block);
    const description = extractDescription(block);
    const link = extractLink(block);

    const jobKey = `${title}|${company || ''}`.toLowerCase();
    if (seen.has(jobKey)) continue;
    seen.add(jobKey);

    jobs.push({
      title,
      company: company || '',
      location: location || '',
      link: link || '',
      description: description || '',
      source: 'linkedin',
    });
  }

  // Strategy 2: Bullet-list format
  if (jobs.length < 2) {
    const bulletJobs = parseBulletList(markdown, 'linkedin');
    for (const job of bulletJobs) {
      const jobKey = `${job.title}|${job.company || ''}`.toLowerCase();
      if (!seen.has(jobKey)) {
        seen.add(jobKey);
        jobs.push(job);
      }
    }
  }

  return jobs;
}

// ─── Parser: Indeed ────────────────────────────────────────────────────────

/**
 * Parse Indeed job search results from Jina Reader markdown.
 *
 * Indeed's rendered output is similar — cards with title, company, location.
 */
function parseIndeedMarkdown(markdown: string): Partial<Job>[] {
  const jobs: Partial<Job>[] = [];
  const seen = new Set<string>();

  // Strategy 1: Heading-based job blocks
  const headingBlocks = markdown.split(/(?=^##\s)/m);
  for (const block of headingBlocks) {
    if (!block.trim()) continue;

    const title = extractTitle(block);
    if (!title) continue;

    const company = extractField(block, 'company') || extractAfterPrefix(block, ['at', '·', '|']);
    const location = extractField(block, 'location') || extractLocationFromLine(block);
    const salary = extractSalary(block);
    const description = extractDescription(block);
    const link = extractLink(block);

    const jobKey = `${title}|${company || ''}`.toLowerCase();
    if (seen.has(jobKey)) continue;
    seen.add(jobKey);

    const job: Partial<Job> = {
      title,
      company: company || '',
      location: location || '',
      link: link || '',
      description: description || '',
      source: 'indeed',
    };

    // Attach salary as extra metadata if found
    if (salary) {
      (job as Record<string, unknown>).salary = salary;
    }

    jobs.push(job);
  }

  // Strategy 2: Bullet-list format fallback
  if (jobs.length < 2) {
    const bulletJobs = parseBulletList(markdown, 'indeed');
    for (const job of bulletJobs) {
      const jobKey = `${job.title}|${job.company || ''}`.toLowerCase();
      if (!seen.has(jobKey)) {
        seen.add(jobKey);
        jobs.push(job);
      }
    }
  }

  return jobs;
}

// ─── Shared Parsing Utilities ──────────────────────────────────────────────

/**
 * Extract job title from a block — first `##` heading or first bold line.
 */
function extractTitle(text: string): string | null {
  // ## Title (most common in Jina Reader output)
  const headingMatch = text.match(/^##\s+(.+?)(?:\n|$)/m);
  if (headingMatch) {
    const title = headingMatch[1].trim();
    if (isValidTitle(title)) return title;
  }

  // **Title** at the start of a bullet
  const boldMatch = text.match(/^\*\*(.+?)\*\*/);
  if (boldMatch) {
    const title = boldMatch[1].trim();
    if (isValidTitle(title)) return title;
  }

  // Line with common job title patterns
  const lineMatch = text.match(
    /^(Senior|Lead|Staff|Principal|Junior|Head|Chief|Sr\.?)?\s*:?\s*(.+?)\s*(?:at|–|—|·|\||-)\s/i,
  );
  if (lineMatch) {
    const title = (lineMatch[1] ? `${lineMatch[1]} ${lineMatch[2]}` : lineMatch[2]).trim();
    if (isValidTitle(title)) return title;
  }

  return null;
}

/**
 * Check if a string looks like a valid job title.
 */
function isValidTitle(title: string): boolean {
  if (!title || title.length < 4 || title.length > 200) return false;

  // Skip navigation/text that's clearly not a job title
  const skipPatterns = [
    /^search/i,
    /^sign in/i,
    /^sign up/i,
    /^job search/i,
    /^advanced/i,
    /^page \d+/i,
    /^loading/i,
    /^recommended/i,
    /^recent/i,
    /^salary/i,
    /^company reviews/i,
    /^find jobs/i,
    /^create alert/i,
    /^upload/i,
    /^browse/i,
    /^resources/i,
    /^help/i,
    /^privacy/i,
    /^terms/i,
    /^accessibility/i,
    /^cookie/i,
    /^your profile/i,
    /^my jobs/i,
    /^job alerts/i,
    /^skills/i,
    /^companies/i,
    /^about/i,
    /^post/i,
    /^employer/i,
    /^indeed/i,
    /^linkedin/i,
    /^glassdoor/i,
    /^computrabajo/i,
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(title)) return false;
  }

  // Must look like a job role — contains at least one job-related keyword
  // or has a reasonable structure
  const jobKeywords =
    /engineer|developer|architect|manager|director|lead|specialist|analyst|scientist|consultant|administrator|designer|coordinator|intern|associate|representative|supervisor|technician|operator|assistant|executive|officer|head|chief|partner|advisor|specialist|agent|clerk|aide|trainee|apprentice|fellow|instructor|teacher|professor|researcher|nurse|doctor|physician|surgeon|therapist|counselor|attorney|lawyer|paralegal|accountant|auditor|broker|underwriter|planner|buyer|logistics|hr|recruiter|trainer|consultant|liaison/i;
  const hasJobKeyword = jobKeywords.test(title);

  // Accept titles that look like role descriptions even without job keywords
  // e.g., "Software Engineer" has "Engineer", "Frontend Developer" has "Developer"
  // But also accept generic-sounding titles if they're long enough
  if (!hasJobKeyword && title.split(/\s+/).length < 2) return false;

  // Exclude lines that are clearly URLs or metadata
  if (/^https?:\/\//i.test(title)) return false;
  if (/^\d+/.test(title) && title.length < 10) return false;

  return true;
}

/**
 * Extract a labeled field from a markdown block, e.g. `**Company:** Google`.
 */
function extractField(text: string, fieldName: string): string | null {
  const patterns = [
    new RegExp(`\\*\\*${fieldName}\\s*:\\*\\*\\s*(.+?)(?:\\n|$)`, 'i'),
    new RegExp(`${fieldName}:\\s*(.+?)(?:\\n|$)`, 'i'),
    new RegExp(`\\*${fieldName}\\*:\\s*(.+?)(?:\\n|$)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match[1].trim();
      if (value && value.length < 100) return value;
    }
  }

  return null;
}

/**
 * Extract text after a prefix like "at", "·", "|" on the same line as the title.
 * Handles patterns like "Senior Engineer at Google" or "Engineer · Company · Location"
 */
function extractAfterPrefix(text: string, prefixes: string[]): string | null {
  const lines = text.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    for (const prefix of prefixes) {
      // Match the prefix followed by company name (capitalized words)
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`${escapedPrefix}\\s+([A-Z][A-Za-z0-9 &.$]+?)(?:\\s+[·|]|\\s*$)`);
      const match = line.match(pattern);
      if (match) {
        const company = match[1].trim();
        if (company.length > 1 && company.length < 60) return company;
      }
    }
  }
  return null;
}

/**
 * Extract location from a line containing location-related keywords.
 */
function extractLocationFromLine(text: string): string | null {
  const lines = text.split('\n').filter((l) => l.trim());
  for (const line of lines) {
    // Skip the title line
    if (line.startsWith('##') || line.startsWith('**')) continue;

    // Look for location patterns: "City, State" or "Remote" or "City, Country"
    const locationPatterns = [
      /(Remote|Remoto|Hybrid|Híbrido)\b/i,
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2})\b/, // "Mountain View, CA"
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+)/, // "San Francisco, California"
      /\b(?:in|location:|located in|based in)\s+([A-Z][A-Za-z\s,]+?)(?:\.|$|\n)/i,
    ];

    for (const pattern of locationPatterns) {
      const match = line.match(pattern);
      if (match) {
        const loc = (match[1] || match[0]).trim();
        if (loc.length > 1 && loc.length < 60) return loc;
      }
    }
  }
  return null;
}

/**
 * Extract salary string from a block.
 */
function extractSalary(text: string): string | null {
  const salaryPatterns = [
    /\$([\d,]+)\s*(?:–|—|-|to)\s*\$?([\d,]+)/i,
    /\$([\d,]+)\s*(?:per|\/|a|an)\s*(?:year|hr|hour|month|yr|annually)/i,
    /(?:salary|pay|range):\s*\$?([\d,]+(?:\s*–\s*\$?[\d,]+)?)/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return null;
}

/**
 * Extract description (text following the title/company/location lines).
 */
function extractDescription(text: string): string | null {
  const lines = text.split('\n').filter((l) => l.trim());
  // Skip the first few lines (title, company, location headers)
  const contentLines: string[] = [];
  let startedContent = false;

  for (const line of lines) {
    if (
      !startedContent &&
      (line.startsWith('##') ||
        line.startsWith('**') ||
        /^(company|location|salary):/i.test(line.trim()))
    ) {
      continue;
    }
    startedContent = true;

    const trimmed = line.trim();
    // Skip URLs, empty lines, and section headers
    if (/^https?:\/\//i.test(trimmed)) continue;
    if (/^---/.test(trimmed)) continue;
    if (trimmed.length < 5) continue;

    contentLines.push(trimmed);
  }

  if (contentLines.length === 0) return null;
  return contentLines.slice(0, 5).join(' ').slice(0, 500);
}

/**
 * Extract the first URL from a markdown block.
 */
function extractLink(text: string): string | null {
  // Markdown links: [text](url)
  const mdLinkMatch = text.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (mdLinkMatch) return mdLinkMatch[1];

  // Plain URLs
  const urlMatch = text.match(/https?:\/\/[^\s\n)"]+/);
  if (urlMatch) return urlMatch[0];

  return null;
}

/**
 * Parse bullet-list style job listings.
 * Format: `- **Title** at Company — Location`
 */
function parseBulletList(markdown: string, source: string): Partial<Job>[] {
  const jobs: Partial<Job>[] = [];
  const seen = new Set<string>();

  // Match bullet items with bold text
  const bulletPattern =
    /^-?\s*\*\*(.+?)\*\*(?:\s*(?:at|@|–|—|·|\|)\s*(.+?))?(?:\s*(?:–|—|·|\|)\s*(.+?))?$/gm;
  let match;

  while ((match = bulletPattern.exec(markdown)) !== null) {
    const title = match[1]?.trim();
    const company = match[2]?.trim();
    const location = match[3]?.trim();

    if (!title || !isValidTitle(title)) continue;

    const jobKey = `${title}|${company || ''}`.toLowerCase();
    if (seen.has(jobKey)) continue;
    seen.add(jobKey);

    // Extract link from the line following the bullet
    const lineStart = match.index;
    const remainingAfterMatch = markdown.slice(
      lineStart + match[0].length,
      lineStart + match[0].length + 300,
    );
    const linkMatch = remainingAfterMatch.match(/https?:\/\/[^\s\n)"]+/);

    jobs.push({
      title,
      company: company || '',
      location: location || '',
      link: linkMatch ? linkMatch[0] : '',
      description: '',
      source,
    });
  }

  return jobs;
}

// ─── Parser: Computrabajo ────────────────────────────────────────────────────

/**
 * Parse Computrabajo job search results from Jina Reader markdown.
 *
 * Computrabajo is a Latin American job board with Spanish content.
 * Jina Reader renders each job listing as a `##` heading block with
 * the title as a markdown link, followed by details as plain text:
 *
 * ## [Desarrollador Kotlin](https://co.computrabajo.com/ofertas-de-trabajo/...)
 * Postulado  Vista
 * 4,5 [Inter Rapidisimo S.A](https://co.computrabajo.com/interrapidisimo)
 * Bogotá, D.C., Bogotá, D.C.
 * $ 6.500.000,00 (Mensual)
 * Hace 1 hora
 *
 * Note: no labeled fields like **Empresa:** — everything is positional.
 */
function parseComputrabajoMarkdown(markdown: string): Partial<Job>[] {
  const jobs: Partial<Job>[] = [];
  const seen = new Set<string>();

  // Split by ## headings — each block is one job listing
  const headingBlocks = markdown.split(/(?=^##\s)/m);
  for (const block of headingBlocks) {
    if (!block.trim()) continue;
    if (block.trim().length < 20) continue;

    // Extract title from ## [Title](url) format
    const parsed = extractComputrabajoHeading(block);
    if (!parsed || !parsed.title) continue;

    const { title, link } = parsed;

    // Split block into non-empty lines for positional parsing
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Determine what each line contains based on its content
    const company = extractComputrabajoCompany(lines);
    const location = extractComputrabajoLocation(lines);
    const salary = extractComputrabajoSalary(lines);

    const jobKey = `${title}|${company || ''}`.toLowerCase();
    if (seen.has(jobKey)) continue;
    seen.add(jobKey);

    const job: Partial<Job> = {
      title,
      company: company || '',
      location: location || '',
      link: link || '',
      description: '',
      source: 'computrabajo',
    };

    if (salary) {
      (job as Record<string, unknown>).salary = salary;
    }

    jobs.push(job);
  }

  return jobs;
}

/**
 * Parse a Computrabajo heading line: `## [Title](url)`
 * Extracts the title text and job URL from markdown link syntax.
 */
function extractComputrabajoHeading(block: string): { title: string; link: string } | null {
  const headingMatch = block.match(/^##\s*\[([^\]]+)\]\(([^)]+)\)/m);
  if (!headingMatch) return null;

  const title = headingMatch[1].trim();
  const link = headingMatch[2].trim();

  if (!title || title.length < 3 || title.length > 200) return null;
  if (!isValidSpanishTitle(title)) return null;

  return { title, link };
}

/**
 * Extract company name from Computrabajo block lines.
 *
 * The company line looks like one of:
 *   - `[Inter Rapidisimo S.A](https://...)`
 *   - `4,5 [Inter Rapidisimo S.A](https://...)`
 *   - `Rating [Company Name](url)`
 */
function extractComputrabajoCompany(lines: string[]): string | null {
  for (const line of lines) {
    // Skip the heading line (starts with ##) and action lines
    if (line.startsWith('##')) continue;
    if (/^Postulado/i.test(line)) continue;
    if (/^Vista/i.test(line)) continue;
    if (/^Hace\s+\d+/i.test(line)) continue; // "Hace 1 hora"
    if (/^\$/.test(line)) continue; // Salary line
    if (/^\(\d+\)/.test(line)) continue; // Pagination like "(5)"

    // Match [Company](url) optionally prefixed by rating like "4,5" or "4.5"
    const companyMatch = line.match(/(?:[\d.,]+\s*)?\[([^\]]+)\]\([^)]+\)/);
    if (companyMatch) {
      const company = companyMatch[1].trim();
      if (company.length > 1 && company.length < 80) return company;
    }
  }
  return null;
}

/**
 * Extract location from Computrabajo block lines.
 *
 * Location lines look like:
 *   - "Bogotá, D.C., Bogotá, D.C."
 *   - "Ciudad de México, CDMX"
 *   - "Buenos Aires"
 *   - "Remoto"
 */
function extractComputrabajoLocation(lines: string[]): string | null {
  for (const line of lines) {
    if (line.startsWith('##')) continue;
    if (/^Postulado/i.test(line)) continue;
    if (/^Hace\s+\d+/i.test(line)) continue;
    if (/^\$/.test(line)) continue;
    if (/\[[^\]]+\]\([^)]+\)/.test(line)) continue; // Has a markdown link (company)
    if (/^\(\d+\)/.test(line)) continue;
    if (/^(Siguiente|Anterior|1|2|3|4|5)/i.test(line)) continue;

    const trimmed = line.trim();
    if (trimmed.length < 3) continue;

    // Check if it looks like a location:
    // - Starts with uppercase (city name)
    // - Contains commas or accented chars typical of Spanish locations
    // - Contains Spanish remote/work mode keywords
    const locationMatch = trimmed.match(
      /^(Remoto|Home Office|Híbrido|Presencial|Modalidad|Teletrabajo)/i,
    );
    if (locationMatch) return locationMatch[1];

    // Match "City, Region" or "City, Country" patterns
    const cityMatch = trimmed.match(
      /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:[\s,]+[A-ZÁÉÍÓÚÑa-záéíóúñ.]+){1,4}$/,
    );
    if (cityMatch && trimmed.length > 4 && trimmed.length < 80) return trimmed;
  }
  return null;
}

/**
 * Extract salary from Computrabajo block lines.
 *
 * Salary formats:
 *   - "$ 6.500.000,00 (Mensual)"
 *   - "$ 2.000.000 (Mensual)"
 *   - "$ 30.000.000 - $ 40.000.000 (Anual)"
 *   - "$ 1.200.000,00"
 */
function extractComputrabajoSalary(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim();
    // Match $ with optional space, followed by numbers with dots/commas
    const salaryMatch = trimmed.match(
      /^\$\s*[\d.]+(?:[.,]\d+)?(?:\s*[-–]\s*\$?\s*[\d.]+(?:[.,]\d+)?)?(?:\s*\([^)]*\))?/,
    );
    if (salaryMatch) return salaryMatch[0].trim();
  }
  return null;
}

/**
 * Check if a string looks like a valid Spanish job title.
 */
function isValidSpanishTitle(title: string): boolean {
  if (!title || title.length < 4 || title.length > 200) return false;

  // Skip navigation/non-job patterns (in Spanish)
  const skipPatterns = [
    /^buscar/i,
    /^iniciar sesión/i,
    /^registrarse/i,
    /^crear cuenta/i,
    /^oferta/i,
    /^empleo/i,
    /^trabajo/i,
    /^página \d+/i,
    /^cargando/i,
    /^recomendado/i,
    /^recientes/i,
    /^salario/i,
    /^opiniones/i,
    /^subir/i,
    /^ayuda/i,
    /^privacidad/i,
    /^términos/i,
    /^aviso/i,
    /^publicar/i,
    /^empleador/i,
    /^computrabajo/i,
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(title)) return false;
  }

  // Accept if it has Spanish/English job keywords
  const jobKeywords =
    /ingeniero|desarrollador|analista|consultor|coordinador|director|gerente|administrador|especialista|técnico|supervisor|asistente|asociado|representante|practicante|becario|líder|lider|jefe|arquitecto|diseñador|programador|soporte|secretario|contador|auditor|entrenador|instructor|profesor|investigador|enfermero|médico|doctor|abogado|seller|engineer|developer|manager|analyst|specialist|consultant|designer|architect|lead|head|chief|officer/i;

  const hasJobKeyword = jobKeywords.test(title);

  if (!hasJobKeyword && title.split(/\s+/).length < 2) return false;

  if (/^https?:\/\//i.test(title)) return false;

  return true;
}

// ─── Parser: Glassdoor ──────────────────────────────────────────────────────

/**
 * Parse Glassdoor job search results from Jina Reader markdown.
 *
 * Glassdoor shows job listings with company ratings, salary estimates, and
 * location. Jina Reader typically outputs:
 *
 * ## Senior Software Engineer
 * **Company:** Google
 * **Rating:** 4.5 ★
 * **Location:** Mountain View, CA
 * **Salary:** $150K – $220K
 * ...
 */
function parseGlassdoorMarkdown(markdown: string): Partial<Job>[] {
  const jobs: Partial<Job>[] = [];
  const seen = new Set<string>();

  // Strategy 1: Heading-based job blocks (## Title pattern)
  const headingBlocks = markdown.split(/(?=^##\s)/m);
  for (const block of headingBlocks) {
    if (!block.trim()) continue;

    const title = extractTitle(block);
    if (!title) continue;

    const company =
      extractField(block, 'company') ||
      extractField(block, 'Company') ||
      extractAfterPrefix(block, ['at', '·', '|']);
    const location =
      extractField(block, 'location') ||
      extractField(block, 'Location') ||
      extractLocationFromLine(block);
    const salary =
      extractField(block, 'salary') ||
      extractField(block, 'Salary') ||
      extractField(block, 'estimate') ||
      extractField(block, 'pay range') ||
      extractGlassdoorSalary(block);
    const rating = extractGlassdoorRating(block);
    const description = extractDescription(block);
    const link = extractLink(block);

    const jobKey = `${title}|${company || ''}`.toLowerCase();
    if (seen.has(jobKey)) continue;
    seen.add(jobKey);

    const job: Partial<Job> = {
      title,
      company: company || '',
      location: location || '',
      link: link || '',
      description: description || '',
      source: 'glassdoor',
    };

    // Attach salary as extra metadata if found
    if (salary) {
      (job as Record<string, unknown>).salary = salary;
    }
    // Attach rating as extra metadata if found
    if (rating) {
      (job as Record<string, unknown>).rating = rating;
    }

    jobs.push(job);
  }

  // Strategy 2: Bullet-list format fallback
  if (jobs.length < 2) {
    const bulletJobs = parseBulletList(markdown, 'glassdoor');
    for (const job of bulletJobs) {
      const jobKey = `${job.title}|${job.company || ''}`.toLowerCase();
      if (!seen.has(jobKey)) {
        seen.add(jobKey);
        jobs.push(job);
      }
    }
  }

  return jobs;
}

/**
 * Extract Glassdoor salary estimate from text.
 * Handles formats like "$150K – $220K", "$80K+", "$120K - $160K", "$50K - $70K (Employer est.)"
 */
function extractGlassdoorSalary(text: string): string | null {
  const salaryPatterns = [
    /\$([\d]+(?:,\d{3})*)(?:K|k|,000)?\s*(?:–|—|-|to)\s*\$?([\d]+(?:,\d{3})*)(?:K|k|,000)?(?:\s*\([^)]*\))?/i,
    /\$([\d]+(?:,\d{3})*)(?:K|k|,000)?[\s+]*(?:\/|per)\s*(?:year|yr|hour|hr)/i,
    /(?:salary|pay|range|estimate):\s*\$?([\d,]+(?:K|k)?(?:\s*–\s*\$?[\d,]+(?:K|k)?)?)/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }

  return null;
}

/**
 * Extract Glassdoor company rating from text.
 * Handles formats like "3.5 ★", "Rating: 4.1", "4.2 stars"
 */
function extractGlassdoorRating(text: string): string | null {
  const ratingPatterns = [
    // Number followed by ★ star character
    /([\d]\.[\d])\s*★/,
    // Number followed by "stars" text
    /([\d]\.[\d])\s*stars?/i,
    // Rating label
    /(?:rating|Rating):\s*([\d]\.[\d])/,
  ];

  for (const pattern of ratingPatterns) {
    const match = text.match(pattern);
    if (match) {
      const rating = match[1];
      const num = parseFloat(rating);
      if (num >= 1.0 && num <= 5.0) return rating.trim();
    }
  }

  return null;
}

// ─── JinaReaderScraper Class ───────────────────────────────────────────────

export class JinaReaderScraper {
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  get name(): string {
    return `jinareader-${this.source}`;
  }

  /**
   * Scrape job listings via Jina Reader for the configured source.
   */
  async scrape(config: ScraperConfig): Promise<ScraperResult> {
    const sourceConfig = SOURCES[this.source];
    if (!sourceConfig) {
      return {
        success: false,
        error: `Unknown source: ${this.source}. Supported: ${Object.keys(SOURCES).join(', ')}`,
      };
    }

    try {
      // Respect rate limits
      await rateLimiter.wait();

      // Build the Jina Reader URL
      const targetUrl = sourceConfig.buildUrl(config.query);
      const jinaUrl = `${JINA_READER_BASE}/${targetUrl}`;

      logger.info(
        `[JinaReader-${this.source}] Fetching via Jina Reader: ${targetUrl.slice(0, 100)}...`,
      );

      // Fetch content from Jina Reader
      const response = await axios.get(jinaUrl, {
        timeout: JINA_TIMEOUT_MS,
        headers: {
          Accept: 'text/plain',
          'X-Engine': 'browser', // Use headless Chrome for JS-rendered content
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        responseType: 'text',
        validateStatus: (status) => status < 500, // Accept 4xx for error handling
      });

      if (response.status !== 200) {
        logger.warning(
          `[JinaReader-${this.source}] API returned status ${response.status}: ${response.statusText}`,
        );
        return {
          success: false,
          error: `Jina Reader API returned status ${response.status}`,
        };
      }

      const markdown = typeof response.data === 'string' ? response.data : String(response.data);

      if (!markdown || markdown.length < 50) {
        logger.warning(`[JinaReader-${this.source}] Empty or too short response`);
        return { success: true, data: [] };
      }

      // Parse markdown to extract jobs
      const parsedJobs = sourceConfig.parseMarkdown(markdown);

      // Deduplicate and limit
      const seen = new Set<string>();
      const jobs: Job[] = [];

      for (const partial of parsedJobs) {
        const key = `${partial.title ?? ''}|${partial.company ?? ''}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const id = this.generateId(partial.link || partial.title || '');

        const job: Record<string, unknown> = {
          id,
          title: partial.title?.trim() || '',
          company: partial.company?.trim() || '',
          location: partial.location?.trim() || '',
          link: partial.link?.trim() || '',
          description: partial.description?.trim() || '',
          source: partial.source || this.source,
          scrapedAt: new Date(),
        };

        // Preserve extra metadata from parsers (e.g., salary, rating)
        const partialRaw = partial as Record<string, unknown>;
        for (const key of Object.keys(partialRaw)) {
          if (!(key in job)) {
            job[key] = partialRaw[key];
          }
        }

        if (job.title && job.company) {
          jobs.push(job as unknown as Job);
        }
      }

      const maxJobs = config.maxJobs || 10;
      const limited = jobs.slice(0, maxJobs);

      logger.success(
        `[JinaReader-${this.source}] Extracted ${limited.length} jobs (from ${parsedJobs.length} candidates)`,
      );

      return { success: true, data: limited };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warning(`[JinaReader-${this.source}] Failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Generate a deterministic ID from a string.
   */
  private generateId(input: string): string {
    const hash = Buffer.from(input, 'utf-8').toString('base64').slice(0, 12).replace(/[+/=]/g, '');
    return `jr-${hash}`;
  }
}

// ─── CLI Execution ─────────────────────────────────────────────────────────

// Check if this file is being executed directly (not imported by Jest or another module)
// We use a string check instead of import.meta.url for Jest compatibility
const isDirectExecution =
  process.argv[1] &&
  !process.env.JEST_WORKER_ID &&
  (process.argv[1].replace(/\\/g, '/').endsWith('jinaReader.ts') ||
    process.argv[1].replace(/\\/g, '/').endsWith('jinaReader.js'));

if (isDirectExecution) {
  const source = process.argv[2] || 'linkedin';
  const query = process.argv[3] || 'software engineer';
  const maxJobs = parseInt(process.argv[4] || '10', 10);

  const scraper = new JinaReaderScraper(source);

  scraper
    .scrape({ query, maxJobs })
    .then((result) => {
      if (result.success && result.data) {
        console.log(`\n✅ Found ${result.data.length} jobs from ${source}:`);
        result.data.forEach((job, i) => {
          console.log(`${i + 1}. ${job.title} at ${job.company} - ${job.location}`);
          console.log(`   Link: ${job.link}`);
        });
      } else {
        console.error(`❌ Failed: ${result.error}`);
      }
    })
    .catch(console.error);
}
