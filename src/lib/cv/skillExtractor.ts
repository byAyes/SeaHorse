/**
 * Skill Extractor Module
 * Extracts skills, experience, and education from CV text sections
 */

import type { ExperienceEntry, EducationEntry } from '../../types/cv';

/**
 * Extract skills from CV skills section text
 * @param text - Skills section text
 * @returns Array of extracted skills
 */
export function extractSkills(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const skills = new Set<string>();

  // Split by common delimiters
  const delimiters = /[,\n•\-*▪▸→◆|;]/;
  const tokens = text.split(delimiters);

  for (const token of tokens) {
    const skill = normalizeSkill(token);

    // Skip empty or too short/long strings
    if (skill.length < 2 || skill.length > 50) {
      continue;
    }

    // Skip common false positives
    if (isFalsePositive(skill)) {
      continue;
    }

    skills.add(skill);
  }

  return Array.from(skills);
}

/**
 * Normalize skill string
 * - Lowercase
 * - Trim whitespace
 * - Remove special characters
 */
function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .trim()
    .replace(/[•\-*▪▸→◆]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if token is a false positive (not a real skill)
 */
function isFalsePositive(token: string): boolean {
  const falsePositives = [
    'and',
    'the',
    'with',
    'from',
    'that',
    'this',
    'for',
    'are',
    'was',
    'were',
    'been',
    'have',
    'has',
    'had',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'to',
    'of',
    'in',
    'on',
    'at',
    'by',
    'an',
    'as',
    'or',
    'is',
    'it',
    'proficient',
    'familiar',
    'experience',
    'working',
    'knowledge',
    'skill',
    'skills',
    'technical',
    'experience:',
    'skills:',
    'technical skills',
  ];

  return falsePositives.includes(token.toLowerCase());
}

/**
 * Extract work experience entries from CV experience section
 * @param text - Experience section text
 * @returns Array of experience entries
 */
export function extractExperience(text: string): ExperienceEntry[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const experiences: ExperienceEntry[] = [];

  // Pattern to match experience entries
  // Matches patterns like: "Job Title at Company (2020-2023)" or "Job Title - Company | Duration"
  const entryPatterns = [
    // Pattern 1: "Job Title at Company (Date Range)"
    /(.+?)\s+at\s+(.+?)\s+\(([\d–\-–\s,]+?)\)/gi,
    // Pattern 2: "Job Title - Company | Duration"
    /(.+?)\s*-\s*(.+?)\s*\|\s*([\d–\-–\s,]+?)/gi,
    // Pattern 3: "Job Title @ Company"
    /(.+?)\s*@\s*(.+?)\s*\n/gi,
  ];

  // Try to extract using patterns
  for (const pattern of entryPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        const experience: ExperienceEntry = {
          jobTitle: match[1]?.trim(),
          company: match[2]?.trim(),
          duration: match[3]?.trim() || undefined,
        };
        experiences.push(experience);
      }
    }
  }

  // If no structured entries found, try line-by-line extraction
  if (experiences.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 200) {
        // Try to extract job title and company from line
        const parts = trimmed.split(/[-–—|@]/);
        if (parts.length >= 2) {
          experiences.push({
            jobTitle: parts[0]?.trim(),
            company: parts[1]?.trim(),
          });
        } else if (trimmed.length > 15) {
          // Assume it's a job description
          experiences.push({
            description: trimmed,
          });
        }
      }
    }
  }

  return experiences;
}

/**
 * Extract education entries from CV education section
 * @param text - Education section text
 * @returns Array of education entries
 */
export function extractEducation(text: string): EducationEntry[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const education: EducationEntry[] = [];

  // Pattern to match education entries
  // Matches patterns like: "Degree in Field, University, Year" or "University - Degree (Year)"
  const eduPatterns = [
    // Pattern 1: "Degree, University, Year"
    /(.+?)(?:,|at)\s*(.+?)(?:,|\n)\s*(\d{4})/gi,
    // Pattern 2: "University - Degree (Year)"
    /(.+?)\s*-\s*(.+?)\s*\((\d{4})\)/gi,
  ];

  // Try to extract using patterns
  for (const pattern of eduPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[2]) {
        const edu: EducationEntry = {
          degree: match[1]?.trim(),
          institution: match[2]?.trim(),
          graduationYear: match[3]?.trim(),
        };
        education.push(edu);
      }
    }
  }

  // If no structured entries found, try line-by-line extraction
  if (education.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines with years (likely graduation years)
      const yearMatch = trimmed.match(/\b(19|20)\d{2}\b/);
      if (yearMatch && trimmed.length > 10) {
        education.push({
          degree: trimmed.replace(yearMatch[0], '').trim(),
          graduationYear: yearMatch[0],
        });
      } else if (trimmed.length > 15 && trimmed.length < 150) {
        // Assume it's an education entry
        education.push({
          degree: trimmed,
        });
      }
    }
  }

  return education;
}

/**
 * Calculate years of experience from experience entries
 * @param experiences - Array of experience entries
 * @returns Estimated years of experience
 */
export function calculateYearsOfExperience(experiences: ExperienceEntry[]): number {
  let totalYears = 0;

  for (const exp of experiences) {
    if (exp.duration) {
      // Try to extract years from duration string
      const yearMatch = exp.duration.match(/\d{4}/g);
      if (yearMatch && yearMatch.length >= 2) {
        const startYear = parseInt(yearMatch[0]);
        const endYear = parseInt(yearMatch[1]);
        if (!isNaN(startYear) && !isNaN(endYear)) {
          totalYears += Math.max(0, endYear - startYear);
        }
      }
    }
  }

  return totalYears;
}

/**
 * Infer experience level from years of experience
 * @param years - Years of experience
 * @returns Experience level string
 */
export function inferExperienceLevel(years: number): string {
  if (years < 2) {
    return 'junior';
  } else if (years < 5) {
    return 'mid';
  } else if (years < 10) {
    return 'senior';
  } else {
    return 'lead';
  }
}
