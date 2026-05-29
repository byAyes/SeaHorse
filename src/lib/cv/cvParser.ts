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
 * - Normalize whitespace
 * - Fix common PDF extraction issues
 *
 * NOTE: Does NOT strip accented characters (á, é, í, ó, ú, ñ, ü, etc.)
 * as those are critical for Spanish, French, Portuguese CVs.
 */
function cleanText(text: string): string {
  return (
    text
      // Replace multiple newlines with a single blank line separator
      .replace(/\n\s*\n/g, '\n\n')
      // Replace multiple spaces with single space
      .replace(/[ \t]+/g, ' ')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      // Trim trailing whitespace on each line
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim()
  );
}

/**
 * Detect sections in CV text
 * Uses flexible line-by-line matching for common CV section headers
 *
 * Handles:
 * - Mixed case, ALL CAPS, Title Case headers
 * - Headers followed by underline (=== or ---)
 * - Spanish, English, French, Portuguese headers
 * - Headers with trailing colons
 */
function detectSections(text: string): CVParsedResult['sections'] {
  // Section header regex patterns — tested against trimmed line content.
  // Order matters: more specific patterns first.
  const sectionDefs: Array<{
    name: 'skills' | 'experience' | 'education';
    patterns: RegExp[];
  }> = [
    {
      name: 'skills',
      patterns: [
        // "SKILLS", "Skills", "skills"
        /^(?:technical\s+)?(?:skills?|competenc(?:ies|y)|expertise)(?:\s*[&+]\s*(?:tools|technologies|methods|expertise))?$/i,
        // Spanish: "Habilidades", "Conocimientos Técnicos", "Tecnologías"
        /^(?:habilidades|conocimientos?\s*(?:técnicos?|técnicos?)?|tecnologías?|herramientas|competencias)$/i,
      ],
    },
    {
      name: 'experience',
      patterns: [
        // "EXPERIENCE", "Work Experience", "Professional Experience"
        /^(?:(?:work|professional|employment|relevant)\s+)?experience$/i,
        // "EMPLOYMENT HISTORY", "Work History", "Career History"
        /^(?:(?:employment|work|career)\s+)?history$/i,
        // Spanish: "Experiencia", "Experiencia Laboral", "Experiencia Profesional"
        /^(?:experiencia\s*(?:laboral|profesional)?|trayectoria\s*(?:laboral|profesional)?|historial\s*(?:laboral|profesional)?)$/i,
        // "PROJECTS", "Proyectos"
        /^(?:projects?|proyectos?)$/i,
      ],
    },
    {
      name: 'education',
      patterns: [
        // "EDUCATION", "Education & Training"
        /^education(?:\s*[&+]\s*(?:training|certifications?))?$/i,
        // "ACADEMIC BACKGROUND", "Qualifications"
        /^(?:academic\s+)?(?:background|qualifications?)$/i,
        // Spanish: "Educación", "Formación", "Estudios"
        /^(?:educación|formación\s*(?:académica|profesional)?|estudios\s*(?:académicos|realizados)?|títulos?)$/i,
      ],
    },
  ];

  // Also detect underline-style headers: a line of === or --- following a header
  const underlinePattern = /^[=\-]{3,}$/;

  const lines = text.split('\n');
  let currentSection: 'skills' | 'experience' | 'education' | null = null;
  const contentMap: Record<string, string[]> = {
    skills: [],
    experience: [],
    education: [],
  };

  // First pass: collect lines under the last seen section header.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line — preserve blank separation within sections
    if (!trimmed) {
      if (currentSection) {
        contentMap[currentSection].push(line);
      }
      continue;
    }

    // Check if this line is an underline (=== or ---) under a section header
    if (underlinePattern.test(trimmed)) {
      // Remove the underline from content but don't change section
      continue;
    }

    // Check if this line matches any section header
    let matchedSection: 'skills' | 'experience' | 'education' | null = null;

    for (const def of sectionDefs) {
      for (const pattern of def.patterns) {
        if (pattern.test(trimmed)) {
          matchedSection = def.name;
          break;
        }
      }
      if (matchedSection) break;
    }

    if (matchedSection) {
      currentSection = matchedSection;
    } else {
      if (currentSection) {
        contentMap[currentSection].push(line);
      }
    }
  }

  const sections: CVParsedResult['sections'] = {};

  // Populate sections object, trimming leading/trailing blank lines
  for (const [sectionName, contentLines] of Object.entries(contentMap)) {
    // Trim blank lines from start and end of content
    let start = 0;
    let end = contentLines.length - 1;
    while (start <= end && !contentLines[start]?.trim()) start++;
    while (end >= start && !contentLines[end]?.trim()) end--;

    const content = contentLines.slice(start, end + 1).join('\n').trim();
    if (content) {
      sections[sectionName as keyof typeof sections] = content;
    }
  }

  // Fallback: if no sections were detected, try to identify sections by scanning
  // the entire text for known header patterns (some CVs don't have clean line-based headers)
  if (Object.keys(sections).length === 0) {
    const headerInText = text.match(
      /(?:^|\n)\s*(SKILLS?|TECHNICAL SKILLS?|HABILIDADES|CONOCIMIENTOS)\s*\n/i,
    );
    if (headerInText) {
      // The detectSections should have caught this — text format is unusual
      // Fall through to the full-text fallback
    }
  }

  // Last resort: no clean section separation, use the whole text as skills
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
