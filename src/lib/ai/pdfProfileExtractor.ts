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
import {
  extractSkills,
  extractExperience,
  extractEducation,
  inferExperienceLevel,
  calculateYearsOfExperience,
} from '../cv/skillExtractor';
import { detectProvider, callAI, type AIProvider } from './provider';

/**
 * Comprehensive AI extraction prompt.
 * Returns ALL fields needed for dashboard, matching, scraping, email, and future auto-apply.
 */
const EXTRACTION_PROMPT = `You are a CV/resume parser. Extract structured information from the following CV text.
The CV may be in English, Spanish, Portuguese, French, or German.

Return ONLY a valid JSON object with this exact structure (no markdown, no code fences):
{
  "personalInfo": {
    "fullName": "string or null (candidate's full name)",
    "email": "string or null",
    "phone": "string or null",
    "linkedin": "string or null (LinkedIn URL)",
    "portfolio": "string or null (portfolio/website URL)",
    "github": "string or null (GitHub URL)"
  },
  "jobTitles": ["string array of current and previous job titles (specific, e.g. \"Senior Frontend Engineer\")"],
  "skills": ["string array of technical/hard skills: programming languages, frameworks, tools, methodologies"],
  "softSkills": ["string array of soft/personal skills: leadership, communication, teamwork, etc."],
  "industries": ["string array of industries/sectors the person has worked in (e.g., technology, healthcare, finance, education)"],
  "interests": ["string array of professional interests or topics the candidate cares about"],
  "locations": ["string array of locations mentioned (cities, countries, or 'Remote')"],
  "remoteOnly": boolean (true if the candidate explicitly prefers remote work, false otherwise. Default: false),
  "experienceLevel": "junior|mid|senior|lead",
  "salaryRange": { "min": number or null, "max": number or null, "currency": "string or null" },
  "languages": [{"language": "string", "level": "string or null"}],
  "education": [{"degree": "string or null (degree name)", "institution": "string or null (school/university name)", "graduationYear": "string or null"}],
  "certifications": ["string array of professional certifications (AWS, Google, PMP, etc.)"],
  "experience": [
    {
      "jobTitle": "string or null",
      "company": "string or null",
      "duration": "string or null (e.g. 'Jan 2020 - Dec 2022' or '2020-2022' or '3 years')",
      "description": "string or null (responsibilities and achievements)"
    }
  ],
  "objective": "string or null (career objective / professional goal statement)",
  "summary": "string (one paragraph summary of the candidate's profile)"
}

Rules:
- jobTitles must be specific (e.g., "Senior Frontend Engineer", not just "Engineer")
- skills include: programming languages, frameworks, libraries, tools, platforms, databases, APIs, cloud services, design tools, CRM, analytics, etc.
- softSkills include: leadership, communication, teamwork, problem-solving, adaptability, creativity, time management, conflict resolution, etc.
- interests include: topics, causes, methodologies, or domains the candidate explicitly mentions interest in (e.g., "artificial intelligence", "sustainable design", "agile development")
- Infer experienceLevel from years of experience: <2 years = junior, 2-5 = mid, 5-10 = senior, 10+ = lead
- If salary is not mentioned, omit salaryRange entirely (set to null)
- Extract education entries thoroughly: degree name, institution name, and graduation year (if available)
- For languages, extract the language name and proficiency level (Native, Fluent, Advanced, Intermediate, Basic, C2, C1, B2, B1, A2, A1, etc.)
- For experience, extract each job entry with title, company, duration, and description
- remoteOnly should be true ONLY if the CV explicitly states remote-only, fully remote, or similar
- Be thorough but accurate - don't invent information
- If a section/field is not present in the CV, use empty array [] for array fields, null for object fields, false for boolean fields
- The JSON must be valid and parseable`;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract profile from a PDF buffer by:
 * 1. Parsing the PDF to extract text
 * 2. Sending the text to Gemini AI for structured extraction
 * 3. Falling back to keyword extraction if AI fails
 */
export async function extractProfileFromPDF(
  buffer: Buffer,
  options?: ProfileExtractionOptions,
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
  startTime?: number,
): Promise<ProfileExtractionResult> {
  const start = startTime ?? Date.now();

  // Detect AI provider: explicit config from request → env vars
  const aiConfig = await detectProvider(
    options?.aiProvider
      ? { provider: options.aiProvider, apiKey: options.aiApiKey || '' }
      : undefined,
  );

  // Try AI extraction first (if we have a configured provider)
  if (aiConfig) {
    try {
      const aiProfile = await queryAIForProfile(text, aiConfig.provider, aiConfig.apiKey);
      if (aiProfile) {
        return {
          success: true,
          profile: aiProfile,
          processingTimeMs: Date.now() - start,
        };
      }
    } catch (err) {
      console.warn(
        '[ProfileExtractor] AI extraction threw unexpected error:',
        err instanceof Error ? err.message : String(err),
      );
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

// ─── AI Provider Extraction ────────────────────────────────────────────

/**
 * Send CV text to the configured AI provider and parse structured profile.
 * Returns null if the provider is unavailable or the request fails.
 */
async function queryAIForProfile(
  text: string,
  provider: AIProvider,
  apiKey: string,
): Promise<ExtractedProfile | null> {
  // Truncate text to avoid hitting token limits
  const truncatedText = text.length > 15000 ? text.slice(0, 15000) + '...' : text;

  try {
    const fullPrompt = `${EXTRACTION_PROMPT}\n\nCV TEXT:\n${truncatedText}`;
    const rawText = await callAI(fullPrompt, { provider, apiKey });

    if (!rawText) {
      console.warn(
        `[ProfileExtractor] ${provider} response missing text content — falling back to keyword extraction`,
      );
      return null;
    }

    return parseAIResponse(rawText);
  } catch (err) {
    console.warn(
      `[ProfileExtractor] ${provider} request failed:`,
      err instanceof Error ? err.message : String(err),
    );
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
    const experienceLevel = validLevels.includes(level)
      ? (level as ExtractedProfile['experienceLevel'])
      : 'mid';

    return {
      jobTitles: parsed.jobTitles as string[],
      skills: parsed.skills as string[],
      softSkills: Array.isArray(parsed.softSkills) ? (parsed.softSkills as string[]) : undefined,
      industries: Array.isArray(parsed.industries) ? (parsed.industries as string[]) : [],
      interests: Array.isArray(parsed.interests) ? (parsed.interests as string[]) : undefined,
      locations: Array.isArray(parsed.locations) ? (parsed.locations as string[]) : [],
      remoteOnly: typeof parsed.remoteOnly === 'boolean' ? parsed.remoteOnly : undefined,
      experienceLevel,
      salaryRange:
        parsed.salaryRange && typeof parsed.salaryRange === 'object'
          ? (parsed.salaryRange as ExtractedProfile['salaryRange'])
          : undefined,
      languages: Array.isArray(parsed.languages)
        ? (parsed.languages as ExtractedProfile['languages'])
        : [],
      education: Array.isArray(parsed.education)
        ? (parsed.education as ExtractedProfile['education'])
        : [],
      certifications: Array.isArray(parsed.certifications) ? (parsed.certifications as string[]) : undefined,
      experience: Array.isArray(parsed.experience)
        ? (parsed.experience as ExtractedProfile['experience'])
        : undefined,
      objective: typeof parsed.objective === 'string' && parsed.objective ? parsed.objective : undefined,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      personalInfo:
        parsed.personalInfo && typeof parsed.personalInfo === 'object'
          ? (parsed.personalInfo as ExtractedProfile['personalInfo'])
          : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a section of text from a CV by finding the section header
 * and capturing content until the next section header or end of text.
 *
 * Handles English, Spanish, French, Portuguese section headers.
 */
function extractSectionFromText(
  text: string,
  section: 'education' | 'experience' | 'skills',
): string | null {
  const sectionHeaders: Record<string, RegExp[]> = {
    education: [
      /^\s*education(?:\s*[&+]\s*(?:training|certifications?))?\s*$/im,
      /^\s*(?:academic\s+)?(?:background|qualifications?)\s*$/im,
      /^\s*(?:educación|educacion|formación|formacion(?:\s*académica|\s*academica|\s*profesional)?|estudios(?:\s*académicos|\s*academicos|\s*realizados)?|títulos?|titulos?)\s*$/im,
    ],
    experience: [
      /^\s*(?:(?:work|professional|employment|relevant)\s+)?experience\s*$/im,
      /^\s*(?:experiencia(?:\s*laboral|\s*profesional)?|trayectoria(?:\s*laboral|\s*profesional)?)\s*$/im,
    ],
    skills: [
      /^\s*(?:technical\s+)?(?:skills?|competenc(?:ies|y)|expertise)\s*$/im,
      /^\s*(?:habilidades|conocimientos?\s*(?:técnicos?)?|tecnologías?|herramientas|competencias)\s*$/im,
    ],
  };

  // Shared headers that mark the END of the current section
  const nextSectionHeaders = [
    /^\s*(?:education|experience|skills?|projects?|certifications?|languages?|interests?|references?|idiomas|habilidades|intereses|experiencia)/im,
  ];

  const lines = text.split('\n');
  let sectionStart = -1;

  // Find the section header (strip "# " prefix — PDF rendering artifact)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().replace(/^#\s*/i, '').trim();
    const patterns = sectionHeaders[section];
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        sectionStart = i + 1;
        break;
      }
    }
    if (sectionStart > -1) break;
  }

  if (sectionStart === -1) return null;

  // Collect lines until next section header
  const sectionLines: string[] = [];
  for (let i = sectionStart; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line is a new section header
    if (i > sectionStart) {
      let isNextHeader = false;
      for (const pattern of nextSectionHeaders) {
        if (pattern.test(trimmed)) {
          isNextHeader = true;
          break;
        }
      }
      if (isNextHeader) break;
    }

    sectionLines.push(line);
  }

  const result = sectionLines.join('\n').trim();
  return result.length > 0 ? result : null;
}

// ─── Keyword Fallback ───────────────────────────────────────────────────────

/**
 * Fallback extraction using existing CV parsing utilities (no AI).
 * This is always available and provides reasonable baseline extraction.
 */
function keywordFallback(text: string): ExtractedProfile {
  const skills = extractSkills(text);
  const experiences = extractExperience(text);
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
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    // First pass: look near EXPERIENCE sections for job titles
    const expSection = text.match(
      /EXPERIENCE[\s\S]*?(?=\n\s*\n(?:EDUCATION|SKILLS|CERTIFICATION|$))/i,
    );
    if (expSection) {
      const expLines = expSection[0]
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of expLines) {
        // Skip section headers, empty bullet points, and description-only lines
        if (/^EXPERIENCE|^EDUCATION|^SKILLS|^CERTIFICATION$/i.test(line)) continue;
        if (/^[•\-*•]\s/.test(line) && line.length < 150) continue; // Skip bullet points
        if (line.length > 150) continue; // Skip very long lines

        // Try to extract title from "Company — Job Title (Date)" format
        const companyTitleMatch = line.match(/[—\-–|@]\s*([A-Za-z][A-Za-z\s,.]+)/);
        if (companyTitleMatch) {
          const potentialTitle = companyTitleMatch[1].trim();
          // Verify it looks like a job title (covers tech + non-tech roles)
          if (
            /Engineer|Developer|Architect|Lead|Manager|Director|Head|Specialist|Analyst|Scientist|Consultant|Administrator|Officer|Intern|Writer|Editor|Rep|Coordinator|Associate|Strategist|Executive|Teacher|Nurse|Advocate|Planner|Buyer|Agent|Assistant|Representative|Supervisor|Coordinator|Advisor|Coach|Trainer|Specialist|Technician|Therapist|Counselor|Designer|Artist|Producer|Copywriter|Recruiter|Acquisition|Partner/i.test(
              potentialTitle,
            )
          ) {
            // Strip trailing date if present
            const cleanTitle = potentialTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (cleanTitle.length > 3 && !jobTitles.includes(cleanTitle)) {
              jobTitles.push(cleanTitle);
              if (jobTitles.length >= 5) break;
            }
          }
        }

        // Also try matching lines that start with a job title (tech + non-tech)
        const titleMatch = line.match(
          /^(?:Senior|Lead|Staff|Principal|Junior|Mid[-\s]*level|Head|Chief|Sr\.?|Associate|Executive)\s+(?:Full[\s-]Stack|Frontend|Front[-\s]End|Backend|Back[-\s]End|Software|DevOps|Data|Machine Learning|ML|AI|Cloud|QA|Mobile|Security|Platform|Site Reliability|SRE|Systems|Embedded|Engineering|Product|Design|Research|QA|Marketing|Sales|Content|Creative|Operations|Financial|Legal|Medical|Clinical|Product|Project|Program|Brand|Social|Digital|Strategic|Technical)?\s*(?:Engineer|Developer|Architect|Manager|Director|Lead|Specialist|Analyst|Scientist|Consultant|Administrator|Coordinator|Officer|Head|Intern|Writer|Editor|Rep|Representative|Associate|Strategist|Executive|Planner|Buyer|Agent|Assistant|Supervisor|Advisor|Coach|Trainer|Technician|Designer|Artist|Producer|Copywriter|Recruiter|Partner|Coordinator|Advocate|Therapist|Counselor|Nurse)/i,
        );
        if (titleMatch) {
          const cleanTitle = line
            .replace(/\s*\|.*$/, '')
            .replace(/\s*\([^)]*\)\s*$/, '')
            .trim();
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
        // Try matching common non-technical titles directly
        const nonTechTitle = line.match(
          /^(Senior|Lead|Head|Chief|Principal|Executive|Associate|Junior|Staff)?\s*(Content|Marketing|Sales|Account|Product|Project|Program|Brand|Social|Digital|Creative|Operations|Financial|Legal|Medical|Clinical|HR|People|Talent|Customer|Growth|Business|Strategic|Technical|Communications|Design|Editorial|Community|Revenue|Demand|Supply|Quality)\s+(Writer|Editor|Manager|Director|Specialist|Coordinator|Associate|Lead|Head|Representative|Analyst|Strategist|Planner|Executive|Partner|Recruiter|Designer|Producer|Consultant|Advisor|Coach|Trainer|Agent|Nurse|Therapist|Officer|Assistant|Supervisor|Technician|Copywriter|Partner|Advocate|Buyer)/i,
        );
        if (nonTechTitle) {
          const cleanTitle = line.replace(/\s*\|.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (cleanTitle.length > 3 && !jobTitles.includes(cleanTitle)) {
            jobTitles.push(cleanTitle);
            if (jobTitles.length >= 3) break;
          }
        }
        // Fallback: try technical title patterns
        const titleMatch = line.match(
          /^(Senior|Lead|Staff|Principal|Junior|Head|Chief|Sr\.?)\s+(?:Full[\s-]Stack|Frontend|Backend|Software|DevOps|Data|Machine Learning|AI|Cloud|QA|Mobile|Security|Platform|Systems|Embedded|Engineering|Research)\s+(Engineer|Developer|Architect|Manager|Lead|Specialist|Scientist|Analyst|Intern)/i,
        );
        if (titleMatch) {
          const cleanTitle = line
            .replace(/\s*\|.*$/, '')
            .replace(/\s*\([^)]*\)\s*$/, '')
            .trim();
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
  if (
    allTitleText &&
    /\b(lead|principal|staff|head|chief|sr\.?|senior|architect|director)\b/.test(allTitleText)
  ) {
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
      locText.split(/[,;\n]/).forEach((l) => {
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
  const techKeywords = [
    'javascript',
    'typescript',
    'python',
    'java',
    'react',
    'node',
    'aws',
    'docker',
    'sql',
    'api',
    'git',
    'css',
    'html',
    'cloud',
    'devops',
    'kubernetes',
    'agile',
    'scrum',
  ];
  const hasTechSkills = skills.some((s) => techKeywords.some((k) => s.toLowerCase().includes(k)));
  if (hasTechSkills) industries.push('technology');
  const nonTechKeywords = [
    'healthcare',
    'finance',
    'banking',
    'medical',
    'education',
    'marketing',
    'sales',
    'legal',
    'consulting',
  ];
  for (const kw of nonTechKeywords) {
    if (text.toLowerCase().includes(kw)) {
      industries.push(kw);
    }
  }

  // Extract education section from text first, then parse it
  // This avoids matching degree keywords in non-education parts of the CV
  const educationSection = extractSectionFromText(text, 'education');
  const educationEntries = extractEducation(educationSection || text).map((e) => ({
    degree: e.degree,
    institution: e.institution,
    graduationYear: e.graduationYear,
  }));

  // Use the first few lines as a rough summary
  const firstLines = text.split('\n').slice(0, 5).filter(Boolean).join(' ').trim();
  const summary = firstLines.length > 20 ? firstLines.slice(0, 200) : undefined;

  return {
    jobTitles,
    skills,
    softSkills: undefined,
    industries,
    interests: undefined,
    locations,
    remoteOnly: undefined,
    experienceLevel: (adjustedLevel || 'mid') as 'junior' | 'mid' | 'senior' | 'lead',
    salaryRange,
    languages,
    education: educationEntries,
    certifications: undefined,
    experience: undefined,
    objective: undefined,
    summary,
    personalInfo: undefined,
  };
}
