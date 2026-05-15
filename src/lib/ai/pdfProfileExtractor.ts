/**
 * AI PDF Profile Extractor
 *
 * Reads a CV/resume PDF, extracts text, sends to Gemini AI for structured
 * profile extraction, and returns an ExtractedProfile.
 *
 * Falls back to keyword-based extraction from existing cvParser/skillExtractor
 * when the AI API is unavailable.
 */

import { parsePDF } from '../pdf/pdfParser';
import {
  ExtractedProfile,
  ProfileExtractionResult,
  ProfileExtractionOptions,
} from '../../types/ai-profile';
import { extractSkills, extractExperience, extractEducation, inferExperienceLevel, calculateYearsOfExperience } from '../cv/skillExtractor';

// ─── Gemini API Constants ───────────────────────────────────────────────────

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const EXTRACTION_PROMPT = `You are a CV/resume parser. Extract structured information from the following CV text.
Return ONLY a valid JSON object with this exact structure (no markdown, no code fences):
{
  "jobTitles": ["string array of current and previous job titles"],
  "skills": ["string array of all technical and soft skills mentioned"],
  "industries": ["string array of industries/sectors the person has worked in"],
  "locations": ["string array of locations mentioned (cities, countries, or 'Remote')"],
  "experienceLevel": "junior|mid|senior|lead",
  "salaryRange": { "min": number or null, "max": number or null, "currency": "string or null" },
  "languages": [{"language": "string", "level": "string or null"}],
  "summary": "one paragraph summary of the candidate's profile"
}

Rules:
- jobTitles must be specific (e.g., "Senior Frontend Engineer", not just "Engineer")
- skills include programming languages, frameworks, tools, methodologies, soft skills
- Infer experienceLevel from years of experience: <2 years = junior, 2-5 = mid, 5-10 = senior, 10+ = lead
- If salary is not mentioned, omit salaryRange entirely
- If no languages mentioned, use empty array
- Be thorough but accurate - don't invent information`;

const GEMINI_TEMPERATURE = 0.1;
const GEMINI_MAX_TOKENS = 4096;
const API_TIMEOUT_MS = 30000;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract profile from a PDF buffer by:
 * 1. Parsing the PDF to extract text
 * 2. Sending the text to Gemini AI for structured extraction
 * 3. Falling back to keyword extraction if AI fails
 */
export async function extractProfileFromPDF(
  buffer: Buffer,
  options?: ProfileExtractionOptions
): Promise<ProfileExtractionResult> {
  const startTime = Date.now();

  // Step 1: Parse PDF to text
  const parseResult = await parsePDF(buffer);
  if (!parseResult.success || !parseResult.text) {
    return {
      success: false,
      error: parseResult.error || 'Failed to extract text from PDF',
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Step 2: Extract profile from text
  return extractProfileFromText(parseResult.text, options, startTime);
}

/**
 * Extract profile directly from CV text (already parsed from PDF).
 * Used when text is already available, or by the API endpoint.
 */
export async function extractProfileFromText(
  text: string,
  options?: ProfileExtractionOptions,
  startTime?: number
): Promise<ProfileExtractionResult> {
  const start = startTime ?? Date.now();
  const provider = options?.provider || 'gemini';

  // Try AI extraction first (unless explicitly set to keyword)
  if (provider !== 'keyword') {
    try {
      const aiProfile = await queryGeminiForProfile(text);
      if (aiProfile) {
        return {
          success: true,
          profile: aiProfile,
          processingTimeMs: Date.now() - start,
        };
      }
    } catch (err) {
      console.warn('[ProfileExtractor] AI extraction threw unexpected error:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback: keyword-based extraction using existing CV utilities
  const fallbackProfile = keywordFallback(text);
  return {
    success: true,
    profile: fallbackProfile,
    processingTimeMs: Date.now() - start,
  };
}

// ─── Gemini AI Extraction ───────────────────────────────────────────────────

/**
 * Send CV text to Gemini and parse structured profile response.
 * Returns null if API key is missing or request fails.
 */
async function queryGeminiForProfile(text: string): Promise<ExtractedProfile | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[ProfileExtractor] GEMINI_API_KEY not set — falling back to keyword extraction');
    return null;
  }

  // Truncate text to avoid hitting token limits
  const truncatedText = text.length > 15000 ? text.slice(0, 15000) + '...' : text;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: EXTRACTION_PROMPT },
              { text: `\n\nCV TEXT:\n${truncatedText}` },
            ],
          },
        ],
        generationConfig: {
          temperature: GEMINI_TEMPERATURE,
          maxOutputTokens: GEMINI_MAX_TOKENS,
        },
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[ProfileExtractor] Gemini API returned HTTP ${response.status} — falling back to keyword extraction`);
      return null;
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.warn('[ProfileExtractor] Gemini response missing text content — falling back to keyword extraction');
      return null;
    }

    return parseAIResponse(rawText);
  } catch (err) {
    console.warn('[ProfileExtractor] Gemini request failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Parse the AI response text into an ExtractedProfile.
 * Handles JSON extraction from markdown code fences if present.
 * Exported for unit testing.
 */
export function parseAIResponse(response: string): ExtractedProfile | null {
  try {
    // Strip markdown code fences if present
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // Validate required fields
    if (!Array.isArray(parsed.jobTitles) || !Array.isArray(parsed.skills)) {
      return null;
    }

    // Validate experienceLevel
    const validLevels = ['junior', 'mid', 'senior', 'lead'];
    const level = String(parsed.experienceLevel || 'mid').toLowerCase();
    const experienceLevel = validLevels.includes(level) ? level as ExtractedProfile['experienceLevel'] : 'mid';

    return {
      jobTitles: parsed.jobTitles as string[],
      skills: parsed.skills as string[],
      industries: Array.isArray(parsed.industries) ? parsed.industries as string[] : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations as string[] : [],
      experienceLevel,
      salaryRange: parsed.salaryRange && typeof parsed.salaryRange === 'object'
        ? parsed.salaryRange as ExtractedProfile['salaryRange']
        : undefined,
      languages: Array.isArray(parsed.languages) ? parsed.languages as ExtractedProfile['languages'] : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Keyword Fallback ───────────────────────────────────────────────────────

/**
 * Fallback extraction using existing CV parsing utilities (no AI).
 * This is always available and provides reasonable baseline extraction.
 */
function keywordFallback(text: string): ExtractedProfile {
  const skills = extractSkills(text);
  const experiences = extractExperience(text);
  const education = extractEducation(text);
  const yearsOfExp = calculateYearsOfExperience(experiences);
  const experienceLevel = inferExperienceLevel(yearsOfExp);

  // Extract job titles from experience entries
  const jobTitles: string[] = [];
  for (const exp of experiences) {
    if (exp.jobTitle && exp.jobTitle.trim()) {
      jobTitles.push(exp.jobTitle.trim());
    }
  }

  // If no job titles from experiences, try extracting from text lines
  if (jobTitles.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    // First pass: look near EXPERIENCE sections for job titles
    const expSection = text.match(/EXPERIENCE[\s\S]*?(?=\n\s*\n(?:EDUCATION|SKILLS|CERTIFICATION|$))/i);
    if (expSection) {
      const expLines = expSection[0].split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of expLines) {
        // Skip section headers, empty bullet points, and description-only lines
        if (/^EXPERIENCE|^EDUCATION|^SKILLS|^CERTIFICATION$/i.test(line)) continue;
        if (/^[•\-*•]\s/.test(line) && line.length < 150) continue; // Skip bullet points
        if (line.length > 150) continue; // Skip very long lines

        // Try to extract title from "Company — Job Title (Date)" format
        const companyTitleMatch = line.match(/[—\-–|@]\s*([A-Za-z][A-Za-z\s,.]+)/);
        if (companyTitleMatch) {
          const potentialTitle = companyTitleMatch[1].trim();
          // Verify it looks like a job title
          if (/Engineer|Developer|Architect|Lead|Manager|Director|Head|Specialist|Analyst|Scientist|Consultant|Administrator|Officer|Intern/i.test(potentialTitle)) {
            // Strip trailing date if present
            const cleanTitle = potentialTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanTitle.length > 3 && !jobTitles.includes(cleanTitle)) {
              jobTitles.push(cleanTitle);
              if (jobTitles.length >= 5) break;
            }
          }
        }

        // Also try matching lines that start with a job title
        const titleMatch = line.match(/^(?:Senior|Lead|Staff|Principal|Junior|Mid[-\s]*level|Head|Chief|Sr\.?)\.?\s*(?:Full[\s-]Stack|Frontend|Front[-\s]End|Backend|Back[-\s]End|Software|DevOps|Data|Machine Learning|ML|AI|Cloud|QA|Mobile|Security|Platform|Site Reliability|SRE|Systems|Embedded|Engineering|Product|Design|Research|QA)\s*(?:Engineer|Developer|Architect|Manager|Director|Lead|Specialist|Analyst|Scientist|Consultant|Administrator|Coordinator|Officer|Head|Intern)/i);
        if (titleMatch) {
          const cleanTitle = line.replace(/\s*\|.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (cleanTitle.length > 3 && !jobTitles.includes(cleanTitle)) {
            jobTitles.push(cleanTitle);
            if (jobTitles.length >= 5) break;
          }
        }
      }
    }
    // Second pass: broader search in whole text
    if (jobTitles.length === 0) {
      for (const line of lines) {
        const titleMatch = line.match(/^(Senior|Lead|Staff|Principal|Junior|Head|Chief|Sr\.?)\s+(?:Full[\s-]Stack|Frontend|Backend|Software|DevOps|Data|Machine Learning|AI|Cloud|QA|Mobile|Security|Platform|Systems|Embedded|Engineering|Research)\s+(Engineer|Developer|Architect|Manager|Lead|Specialist|Scientist|Analyst|Intern)/i);
        if (titleMatch) {
          const cleanTitle = line.replace(/\s*\|.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (cleanTitle.length > 3 && !jobTitles.includes(cleanTitle)) {
            jobTitles.push(cleanTitle);
            if (jobTitles.length >= 3) break;
          }
        }
      }
    }
  }

  // Override experience level based on actual job title keywords
  let adjustedLevel = experienceLevel;
  const allTitleText = jobTitles.join(' ').toLowerCase();
  if (allTitleText && /\b(lead|principal|staff|head|chief|sr\.?|senior|architect|director)\b/.test(allTitleText)) {
    if (/\b(lead|principal|staff|head|chief|director|architect)\b/.test(allTitleText)) {
      adjustedLevel = 'lead';
    } else {
      adjustedLevel = 'senior';
    }
  }

  // Extract locations
  const locations: string[] = [];
  const locationSection = text.match(/(?:^|\n)LOCATION[\s\S]*?(?=\n\s*\n|$)/);
  if (locationSection) {
    const locText = locationSection[0].replace(/^\s*LOCATION[\s:]*/i, '').trim();
    if (locText) {
      // Split on common delimiters
      locText.split(/[,;\n]/).forEach(l => {
        const cleaned = l.replace(/^\(|\)$/g, '').trim();
        if (cleaned && cleaned.length > 2) locations.push(cleaned);
      });
    }
  }
  // Also check for common location patterns in text
  if (locations.length === 0) {
    const locPatterns = [
      /(?:located|based|location|relocate)\s*(?:in|to|:)?\s*([A-Z][a-zA-Z\s,]+?(?=\n|$|\(|\[|Remote))/i,
      /^([A-Z][a-zA-Z\u00C0-\u024F\s,]+)\s*(?:\(|\[)/m,
    ];
    for (const pattern of locPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim().length > 4) {
        locations.push(match[1].trim());
        break;
      }
    }
  }

  // Extract languages
  const languages: ExtractedProfile['languages'] = [];
  const langSection = text.match(/(?:^|\n)LANGUAGES[\s\S]*?(?=\n\s*\n|CERTIFICATION|LOCATION|$)/);
  if (langSection) {
    const langLines = langSection[0].split('\n');
    for (const line of langLines) {
      const trimmed = line.replace(/^[•\-*]\s*/, '').trim();
      const langMatch = trimmed.match(/^([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)\s*\(([^)]+)\)/);
      if (langMatch) {
        languages.push({ language: langMatch[1].trim(), level: langMatch[2].trim() });
      } else if (trimmed && !trimmed.match(/^LANGUAGES|^$/i) && trimmed.length < 30) {
        languages.push({ language: trimmed });
      }
    }
  }

  // Extract salary range
  let salaryRange: ExtractedProfile['salaryRange'] | undefined;
  const salarySection = text.match(/SALARY[\s\S]*?(?=\n\s*\n|$)/i);
  if (salarySection) {
    const salaryText = salarySection[0];
    // Try space-separated range first (common in PDF-extracted text)
    let salaryMatch = salaryText.match(/\$([\d,]+)\s+(?:to|[-–]|–)?\s*\$?([\d,]+)/);
    if (!salaryMatch) {
      salaryMatch = salaryText.match(/\$([\d,]+)\s*[-–to]+\s*\$?([\d,]+)/);
    }
    if (salaryMatch && salaryMatch[2]) {
      salaryRange = {
        min: parseInt(salaryMatch[1].replace(/,/g, '')),
        max: parseInt(salaryMatch[2].replace(/,/g, '')),
        currency: 'USD',
      };
    } else {
      const singleSalary = salaryText.match(/\$([\d,]+)/);
      if (singleSalary) {
        salaryRange = { min: parseInt(singleSalary[1].replace(/,/g, '')), currency: 'USD' };
      }
    }
  }

  // Infer industries from skills
  const industries: string[] = [];
  const techKeywords = ['javascript', 'typescript', 'python', 'java', 'react', 'node', 'aws', 'docker', 'sql', 'api', 'git', 'css', 'html', 'cloud', 'devops', 'kubernetes', 'agile', 'scrum'];
  const hasTechSkills = skills.some(s => techKeywords.some(k => s.toLowerCase().includes(k)));
  if (hasTechSkills) industries.push('technology');
  const nonTechKeywords = ['healthcare', 'finance', 'banking', 'medical', 'education', 'marketing', 'sales', 'legal', 'consulting'];
  for (const kw of nonTechKeywords) {
    if (text.toLowerCase().includes(kw)) {
      industries.push(kw);
    }
  }

  // Use the first few lines as a rough summary
  const firstLines = text.split('\n').slice(0, 5).filter(Boolean).join(' ').trim();
  const summary = firstLines.length > 20 ? firstLines.slice(0, 200) : undefined;

  return {
    jobTitles,
    skills,
    industries,
    locations,
    experienceLevel: adjustedLevel,
    salaryRange,
    languages,
    summary,
  };
}
