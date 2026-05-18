/**
 * Job Extractor Module
 * Extracts structured job postings from plain text (e.g., extracted from PDF)
 */

import { ExtractedJob, PDFProcessingOptions } from '../../types/pdf.js';

/**
 * Extract job postings from plain text
 * Uses regex patterns to identify job titles, companies, descriptions, and requirements
 * @param text - Plain text content to extract jobs from
 * @param options - Optional processing options
 * @returns Promise resolving to array of extracted jobs
 */
export async function extractJobsFromText(
  text: string,
  options?: PDFProcessingOptions,
): Promise<ExtractedJob[]> {
  const jobs: ExtractedJob[] = [];

  // Split text into potential job sections
  const sections = splitIntoJobSections(text);

  // Process each section to extract job data
  for (const section of sections) {
    const job = extractJobFromSection(section, options);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

/**
 * Split text into potential job sections
 * Looks for patterns that indicate job posting boundaries
 */
function splitIntoJobSections(text: string): string[] {
  // Split on common job posting separators
  const separators = [
    /\n(?=\b(?:Job Title|Position|Role|Title)[:\s])/i,
    /\n(?=\b(?:Company|Employer)[:\s])/i,
    /\n(?=\b(?:We are|Looking for|Seeking)\b)/i,
    /\n(?=\b(?:Requirements|Qualifications|Skills)\b)/i,
    /\n{3,}/, // Multiple newlines as fallback
  ];

  let sections = [text];

  for (const separator of separators) {
    const newSections: string[] = [];
    for (const section of sections) {
      const parts = section.split(separator);
      newSections.push(...parts.filter((part) => part.trim().length > 0));
    }
    if (newSections.length > sections.length) {
      sections = newSections;
    }
  }

  return sections;
}

/**
 * Extract a single job from a text section
 */
function extractJobFromSection(
  section: string,
  options?: PDFProcessingOptions,
): ExtractedJob | null {
  const title = extractJobTitle(section);
  const company = extractCompany(section);
  const description = extractDescription(section);
  const requirements = options?.extractRequirements === false ? [] : extractRequirements(section);
  const location = extractLocation(section);

  // Only return job if we have at least a title or company
  if (!title && !company) {
    return null;
  }

  return {
    title: title || 'Unknown Position',
    company: company || 'Unknown Company',
    description: description || '',
    requirements,
    location,
  };
}

/**
 * Extract job title using regex patterns
 */
function extractJobTitle(text: string): string {
  const patterns = [
    /(?:job\s+)?title[:\s]+(.+?)(?:\n|$)/i,
    /(?:position|role)[:\s]+(.+?)(?:\n|$)/i,
    /(?:we are (?:looking for|seeking|hiring)[\s\S]*?)(?:for a|to join as)\s+(.+?)(?:\n|$)/i,
    /^(.+?)(?:\s+(?:-|—|:)\s+.*)?$/m, // First line as fallback
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  return '';
}

/**
 * Extract company name using regex patterns
 */
function extractCompany(text: string): string {
  const patterns = [
    /company[:\s]+(.+?)(?:\n|$)/i,
    /employer[:\s]+(.+?)(?:\n|$)/i,
    /(?:at|with|for)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
    /(?:we are|looking for|seeking)[\s\S]*?(?:at|from|with)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Extract job description
 */
function extractDescription(text: string): string {
  const patterns = [
    /description[:\s]([\s\S]*?)(?:(?:requirements?|qualifications?|skills?|responsibilities?)[:\s]|$)/i,
    /about\s+(?:the\s+)?(?:role|position)[:\s]([\s\S]*?)(?:(?:requirements?|qualifications?|skills?)[:\s]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: return first paragraph after title/company
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  const descriptionLines: string[] = [];
  let inDescription = false;

  for (const line of lines) {
    if (!inDescription && line.length > 50) {
      inDescription = true;
    }
    if (inDescription) {
      if (line.match(/^(requirements?|qualifications?|skills?|responsibilities?)[:\s]/i)) {
        break;
      }
      descriptionLines.push(line);
    }
  }

  return descriptionLines.join(' ').trim();
}

/**
 * Extract requirements/qualifications as array
 */
function extractRequirements(text: string): string[] {
  const requirements: string[] = [];

  // Look for requirements section
  const reqSectionMatch = text.match(
    /(?:requirements?|qualifications?|skills?|responsibilities?)[:\s]([\s\S]*?)(?:(?:benefits?|compensation|salary|how to apply|application)[:\s]|$)/i,
  );

  if (reqSectionMatch && reqSectionMatch[1]) {
    const reqText = reqSectionMatch[1];

    // Extract bullet points
    const bulletPoints = reqText.match(/(?:^|\n)\s*[-*•]\s*(.+)/g);
    if (bulletPoints) {
      bulletPoints.forEach((point) => {
        const clean = point.replace(/^[\s\n]*[-*•]\s*/, '').trim();
        if (clean.length > 0) {
          requirements.push(clean);
        }
      });
    }

    // If no bullet points, split by newlines
    if (requirements.length === 0) {
      const lines = reqText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0 && trimmed.length < 200) {
          requirements.push(trimmed);
        }
      }
    }
  }

  return requirements;
}

/**
 * Extract location if present
 */
function extractLocation(text: string): string | undefined {
  const patterns = [
    /location[:\s]+(.+?)(?:\n|$)/i,
    /(?:based in|located in|office in)[:\s]+(.+?)(?:\n|$)/i,
    /(?:remote|onsite|hybrid)[:\s]?[-]?\s*(.+?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}
