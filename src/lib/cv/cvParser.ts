/**
 * CV Parser Module
 * Extracts and parses text content from CV PDF documents
 * Detects sections: Skills, Experience, Education
 */

import { parsePDF } from '../pdf/pdfParser';
import type { CVParsedResult } from '../../types/cv';

/**
 * Parse a CV PDF and extract structured sections
 * @param pdfBuffer - PDF file as Buffer
 * @returns Promise resolving to CVParsedResult with sections
 */
export async function parseCV(pdfBuffer: Buffer): Promise<CVParsedResult> {
  try {
    // Parse PDF using shared PDF parser
    const result = await parsePDF(pdfBuffer);

    if (!result.success || !result.text) {
      throw new Error(result.error || 'Failed to extract text from PDF');
    }

    const rawText = result.text;

    // Clean and normalize text
    const cleanedText = cleanText(rawText);

    // Detect sections
    const sections = detectSections(cleanedText);

    return {
      rawText: cleanedText,
      sections,
    };
  } catch (error) {
    console.error('Error parsing CV PDF:', error);
    throw new Error(
      `Failed to parse CV: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { cause: error },
    );
  }
}

/**
 * Clean and normalize text extracted from PDF
 * - Remove special characters
 * - Normalize whitespace
 * - Fix common PDF extraction issues
 */
function cleanText(text: string): string {
  return (
    text
      // Replace multiple newlines with double newline
      .replace(/\n\s*\n/g, '\n\n')
      // Replace multiple spaces with single space
      .replace(/[ \t]+/g, ' ')
      // Remove special PDF characters
      .replace(/[\x80-\xFF]/g, '-')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .trim()
  );
}

/**
 * Detect sections in CV text
 * Uses regex patterns to identify common CV section headers
 */
function detectSections(text: string): CVParsedResult['sections'] {
  const sections: CVParsedResult['sections'] = {};

  // Common section header patterns (case-insensitive)
  const sectionPatterns = {
    skills: [
      /(?:technical\s+)?skills?\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|\n?[A-Z][a-z]+\s*:|$)/i,
      /(?:skills|competencies|expertise)\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|Experience|Education|$)/i,
    ],
    experience: [
      /(?:work\s+)?experience\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|Education|Skills|$)/i,
      /(?:employment\s+history|work\s+history)\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|Education|Skills|$)/i,
    ],
    education: [
      /education\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|Skills|Experience|$)/i,
      /(?:academic\s+)?(?:qualifications|background)\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|Skills|Experience|$)/i,
    ],
  };

  // Try to match each section
  for (const [sectionName, patterns] of Object.entries(sectionPatterns)) {
    for (const pattern of patterns as RegExp[]) {
      const match = text.match(pattern);
      if (match && match[1]) {
        sections[sectionName as keyof typeof sections] = match[1].trim();
        break;
      }
    }
  }

  // If no sections detected, assume entire text is skills
  if (Object.keys(sections).length === 0) {
    sections.skills = text;
  }

  return sections;
}

/**
 * Extract text from specific section
 * Useful for re-processing CVs with updated extraction logic
 */
export function extractSectionText(
  rawText: string,
  section: 'skills' | 'experience' | 'education',
): string {
  const sections = detectSections(rawText);
  return sections[section] || '';
}
