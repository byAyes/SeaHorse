/**
 * Skill Extractor Module
 * Extracts skills, experience, and education from CV text sections
 */

import type { ExperienceEntry, EducationEntry } from '../../types/cv';

/**
 * Canonical skills dictionary for pre-check matching.
 * Covers both technical and non-technical domains so ANY profile gets extracted.
 */
const CANONICAL_SKILLS = [
  // Technical
  'angular', 'anthropic claude api', 'api integration', 'aws', 'azure', 'bootstrap',
  'css', 'css3', 'cypress', 'docker', 'figma', 'gcp', 'git', 'github',
  'google sheets', 'html', 'html5', 'javascript', 'jest', 'karma',
  'kubernetes', 'make', 'n8n', 'next.js', 'node.js', 'openai api',
  'prompt engineering', 'python', 'react', 'recharts', 'rest api',
  'rxjs', 'terraform', 'typescript', 'webhook', 'webhooks',
  // Writing & Content
  'content writing', 'content writer', 'copywriting', 'copywriter',
  'technical writing', 'technical writer', 'editorial', 'editing',
  'journalism', 'journalist', 'proofreading', 'translation',
  'creative writing', 'storytelling', 'ux writing', 'grant writing',
  'scriptwriting', 'ghostwriting', 'blogging',
  // Marketing
  'seo', 'sem', 'ppc', 'social media', 'email marketing',
  'content marketing', 'content strategy', 'brand strategy', 'branding',
  'digital marketing', 'growth hacking', 'marketing automation',
  'market research', 'community management', 'influencer marketing',
  'product marketing', 'demand generation', 'lead generation',
  'media buying', 'media planning', 'public relations', 'communications',
  // Sales
  'sales', 'business development', 'account management',
  'salesforce', 'hubspot', 'crm', 'negotiation', 'sales operations',
  'customer success', 'customer acquisition', 'revenue operations',
  'b2b sales', 'b2c sales', 'enterprise sales', 'cold calling',
  // Management & Leadership
  'project management', 'program management', 'product management',
  'scrum', 'agile', 'kanban', 'leadership', 'people management',
  'stakeholder management', 'risk management', 'change management',
  'strategic planning', 'business strategy', 'executive leadership',
  // HR & Talent
  'recruiting', 'talent acquisition', 'human resources',
  'talent management', 'employee relations', 'payroll',
  'performance management', 'learning and development',
  'diversity and inclusion', 'people operations',
  // Finance
  'accounting', 'financial analysis', 'financial planning',
  'budgeting', 'audit', 'tax', 'bookkeeping', 'quickbooks',
  'financial modeling', 'valuation', 'corporate finance',
  // Legal
  'legal', 'compliance', 'regulatory', 'contract management',
  'corporate law', 'intellectual property', 'data privacy',
  'litigation', 'employment law',
  // Operations
  'operations', 'supply chain', 'logistics', 'procurement',
  'inventory management', 'warehouse management', 'six sigma',
  'process improvement', 'continuous improvement', 'vendor management',
  // Design & Creative
  'graphic design', 'visual design', 'ui design', 'ux design',
  'product design', 'motion design', 'animation', 'illustration',
  'video editing', 'video production', 'photography',
  'adobe creative suite', 'photoshop', 'illustrator', 'indesign',
  'after effects', 'premiere pro',
  // Customer Service
  'customer support', 'customer service', 'help desk',
  'zendesk', 'intercom', 'customer experience',
  'call center', 'customer retention', 'client relations',
  // Healthcare
  'nursing', 'clinical', 'medical', 'pharmacy',
  'healthcare administration', 'public health',
  // Education
  'teaching', 'education', 'curriculum', 'training',
];

const SKILL_ALIASES = new Map<string, string>([
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['node', 'node.js'],
  ['nodejs', 'node.js'],
  ['next', 'next.js'],
  ['nextjs', 'next.js'],
  ['reactjs', 'react'],
  ['rest apis', 'rest api'],
  ['openai', 'openai api'],
  ['anthropic', 'anthropic claude api'],
  ['claude api', 'anthropic claude api'],
  ['make integromat', 'make'],
  ['integromat', 'make'],
  ['ui/ux', 'ui design'],
  ['ux/ui', 'ux design'],
  ['content writer', 'content writing'],
  ['copy writer', 'copywriting'],
  ['editor', 'editorial'],
  ['recruiter', 'recruiting'],
  ['talent partner', 'talent acquisition'],
  ['hrbp', 'human resources'],
  ['csm', 'customer success'],
  ['biz dev', 'business development'],
  ['ppc', 'sem'],
  ['crm', 'salesforce'],
  ['fp&a', 'financial planning'],
  ['pe', 'private equity'],
  ['vc', 'venture capital'],
]);

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

  for (const skill of CANONICAL_SKILLS) {
    if (containsSkill(text, skill)) {
      skills.add(skill);
    }
  }

  // Split by common delimiters
  const delimiters = /[,\n•\-*▪▸→◆|;]/;
  const tokens = text.split(delimiters);

  for (const token of tokens) {
    const skill = normalizeSkill(token);

    // Skip empty or too short/long strings
    if (skill.length < 2 || skill.length > 32) {
      continue;
    }

    // Skip common false positives
    if (isFalsePositive(skill) || !looksLikeSkill(skill)) {
      continue;
    }

    skills.add(SKILL_ALIASES.get(skill) ?? skill);
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
    // Strip only bullet decorations, NOT # (for C#) or + (for C++)
    .replace(/[•▪▸→◆]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[.:]+|[.:]+$/g, '')
    .trim();
}

function containsSkill(text: string, skill: string): boolean {
  const normalized = normalizeSkill(text);
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, 'i').test(normalized);
}

/**
 * Check if token looks like a genuine skill.
 *
 * CRITICAL: This is the main guard against random words being extracted as skills.
 * A token must match at least one "skill signature" to pass — we do NOT accept
 * arbitrary words just because they pass basic filters.
 */
function looksLikeSkill(token: string): boolean {
  // Quick check: known aliases or canonical skills
  if (SKILL_ALIASES.has(token) || CANONICAL_SKILLS.includes(token)) return true;

  // Reject obvious non-skills
  if (/[.@]/.test(token)) return false;                // emails, file extensions
  if (/\b\d{3,}\b/.test(token)) return false;          // pure numbers
  if (/https?:|linkedin|gmail|hotmail|outlook|\.com\b/.test(token)) return false; // URLs, emails
  if (token.split(' ').length > 3) return false;        // too long to be a single skill

  // REJECT common noise words
  const stopwords = new Set([
    'and', 'the', 'for', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'cannot',
    'to', 'of', 'in', 'on', 'at', 'by', 'an', 'as', 'or', 'is', 'it', 'its',
    'but', 'not', 'nor', 'yet', 'so', 'if', 'then', 'than', 'that', 'this',
    'with', 'without', 'within', 'from', 'into', 'onto', 'upon',
    'our', 'their', 'your', 'his', 'her', 'its', 'our', 'their',
    'some', 'each', 'every', 'all', 'both', 'few', 'more', 'most',
    'other', 'another', 'such', 'only', 'very', 'just', 'also',
    'dear', 'sir', 'madam', 'attn', 'subject', 'regarding',
    'page', 'date', 'name', 'address', 'phone', 'email',
    'summary', 'profile', 'objective', 'professional',
    'experience', 'education', 'skills', 'languages',
    'certifications', 'references', 'publications',
    'volunteer', 'leadership', 'activities', 'interests',
    'first', 'second', 'third', 'last', 'next', 'previous',
    'above', 'below', 'here', 'there', 'where', 'when', 'what', 'which', 'who', 'whom',
    'about', 'between', 'under', 'over', 'before', 'after', 'during', 'through',
    'because', 'therefore', 'however', 'although', 'though', 'while', 'since',
    'until', 'unless', 'except', 'besides', 'despite', 'regardless',
    'thank', 'thanks', 'best', 'regards', 'sincerely', 'appendix',
  ]);
  if (stopwords.has(token)) return false;

  // Must be at least 3 chars and contain a letter
  if (token.length < 3) return false;
  if (!/[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(token)) return false;

  // ── SKILL SIGNATURE CHECK ────────────────────────────────────────
  // A token MUST match at least one of these patterns to be considered a skill:

  // 1. Words ending in -ing that are known skill activities
  const ingSkills = new Set([
    'coding', 'programming', 'marketing', 'accounting', 'engineering',
    'consulting', 'training', 'teaching', 'coaching', 'editing',
    'writing', 'testing', 'designing', 'modeling', 'planning',
    'budgeting', 'scheduling', 'negotiating', 'selling', 'trading',
    'investing', 'auditing', 'reporting', 'procuring', 'sourcing',
    'recruiting', 'mentoring', 'leading', 'managing', 'coordinating',
    'facilitating', 'supervising', 'troubleshooting', 'proofreading',
    'copywriting', 'storytelling', 'blogging', 'networking',
  ]);
  if (ingSkills.has(token)) return true;

  // 2. Common professional/business skill nouns (not -ing)
  const skillNouns = new Set([
    'analysis', 'analytics', 'management', 'leadership', 'strategy',
    'development', 'implementation', 'integration', 'optimization',
    'automation', 'visualization', 'architecture', 'engineering',
    'operations', 'administration', 'coordination', 'facilitation',
    'supervision', 'compliance', 'regulatory', 'acquisition',
    'retention', 'engagement', 'satisfaction', 'support', 'service',
    'maintenance', 'troubleshooting', 'research', 'innovation',
    'negotiation', 'communication', 'presentation', 'collaboration',
    'organization', 'prioritization', 'documentation', 'translation',
    'animation', 'illustration', 'photography', 'journalism',
    'curriculum', 'pedagogy', 'instruction', 'assessment',
    'diagnosis', 'treatment', 'therapy', 'surgery', 'pharmacy',
    'screening', 'prevention', 'rehabilitation',
    'recruitment', 'onboarding', 'evaluation', 'compensation',
    'payroll', 'benefits', 'compliance', 'labor', 'employee',
    'litigation', 'arbitration', 'mediation', 'contract',
    'underwriting', 'claims', 'brokerage', 'portfolio',
  ]);
  if (skillNouns.has(token)) return true;

  // 3. Technical domain keywords (programming languages, tools, frameworks)
  const techKeywords = new Set([
    'api', 'sdk', 'cli', 'gui', 'ui', 'ux', 'css', 'html', 'sql',
    'nosql', 'orm', 'ide', 'os', 'ci', 'cd', 'devops', 'seo',
    'crm', 'erp', 'lms', 'cms', 'hrms', 'scm', 'dwh', 'etl',
    'rest', 'graphql', 'grpc', 'soap', 'oauth', 'jwt', 'saml',
    'ldap', 'smtp', 'imap', 'pop3', 'ftp', 'sftp', 'ssh',
    'dns', 'dhcp', 'tcp', 'udp', 'http', 'https', 'ssl', 'tls',
    'json', 'xml', 'yaml', 'toml', 'csv', 'pdf', 'png', 'svg',
    'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins',
    'nginx', 'apache', 'redis', 'mongo', 'kafka', 'rabbitmq',
    'linux', 'unix', 'bash', 'zsh', 'powershell', 'vscode',
    'webpack', 'vite', 'babel', 'eslint', 'prettier',
    'node', 'deno', 'bun', 'rust', 'goland', 'intellij',
    'jira', 'confluence', 'slack', 'notion', 'asana', 'trello',
    'figma', 'sketch', 'xd', 'photoshop', 'illustrator', 'indesign',
    'wordpress', 'shopify', 'drupal', 'salesforce', 'hubspot',
    'tableau', 'powerbi', 'looker', 'datastudio',
  ]);
  if (techKeywords.has(token)) return true;

  // 4. Known certification prefixes (e.g., "AWS Certified", "Certified Scrum")
  // The full cert name would be multiple words, but the prefix alone is a strong signal
  const certPrefixes = /^(certified|professional|expert|specialist|associate|practitioner)$/i;
  if (certPrefixes.test(token)) return true;

  // 5. Month names are NOT skills (common in CV date ranges)
  const monthNames = new Set([
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep',
    'sept', 'oct', 'nov', 'dec',
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]);
  if (monthNames.has(token)) return false;

  return false;
}

/**
 * Check if token is a false positive (not a real skill)
 */
function isFalsePositive(token: string): boolean {
  const falsePositives = new Set([
    'and', 'the', 'with', 'from', 'that', 'this', 'for',
    'are', 'was', 'were', 'been', 'have', 'has', 'had',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
    'to', 'of', 'in', 'on', 'at', 'by', 'an', 'as', 'or', 'is', 'it',
    'proficient', 'familiar', 'experience', 'working', 'knowledge',
    'skill', 'skills', 'technical',
    'professional summary', 'summary', 'projects', 'education',
    'certifications', 'work experience', 'frontend', 'backend',
    'languages', 'tools & methods',
    'senior', 'junior', 'mid-level', 'entry-level',
    'full-time', 'part-time', 'contract', 'internship', 'remote',
    'hybrid', 'on-site', 'bachelor', 'master', 'phd', 'doctorate',
    'certificate', 'diploma', 'degree', 'university', 'college',
    'school', 'institute', 'academy',
    'english', 'spanish', 'french', 'portuguese', 'german',
  ]);

  return falsePositives.has(token.toLowerCase());
}

/**
 * Extract work experience entries from CV experience section
 *
 * Uses block-based parsing: splits the text into blocks separated by blank lines,
 * then tries to identify job title, company, dates, and description within each block.
 *
 * Handles common CV formats:
 *   - Title | Company | Dates
 *   - Company — Title (Dates)
 *   - Title at Company, Dates
 *   - Title (separate line), Company (separate line), Dates (separate line)
 *
 * @param text - Experience section text
 * @returns Array of experience entries
 */
export function extractExperience(text: string): ExperienceEntry[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // ── Block splitting ──────────────────────────────────────────────
  // Split text into job blocks separated by one or more blank lines.
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 10);

  const experiences: ExperienceEntry[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) continue;

    const entry = parseSingleExperienceBlock(lines);
    if (entry) {
      experiences.push(entry);
    }
  }

  return experiences;
}

/**
 * Score how much a text fragment looks like a company name.
 * Higher score = more likely to be a company.
 * Used by resolvePipeParts() to disambiguate pipe-separated role/company.
 */
function scoreCompanyPart(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Strong signals (legal entity suffixes, partnership indicators)
  if (/\b(?:inc|ltd|llc|corp|gmbh|ag|nv|bv|pty|plc|llp|pllc|spa|srl|sas|sa|sl|sc|co\b\.?|pte)\b/i.test(lower)) score += 4;
  if (/\b(?:corporation|incorporated|limited|partnership|company)\b/i.test(lower)) score += 3;
  if (/\b(?:associates|partners|group|ventures|capital|funds?|holdings?)\b/i.test(lower)) score += 2;
  // Business-type descriptive words (common in company names)
  if (/\b(?:technologies|solutions|consulting|services|systems|software|digital|media|network|industries|labs|studios|design|creative|agency|council|institute|academy|foundation|enterprise|global|international)\b/i.test(lower)) score += 1;

  // Location suffix (often follows company name: "Acme Corp, San Francisco")
  if (/,\s*[A-Z][A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s+(?:City|Area|Valley|Beach|Bay|Heights|Springs|Park))?$/.test(text)) score += 2;

  // Short capitalized single-word "brand" names (Apple, Google, Meta, Tesla, etc.)
  if (/^[A-Z][a-zA-Z]+$/.test(text) && text.length >= 3 && text.length <= 24) score += 1;

  // Starts with "The" + capitalized word (common company prefix: "The Coca-Cola Company")
  if (/^The\s+[A-Z]/i.test(text)) score += 1;

  // Lowercase start is a strong negative signal for company names
  if (/^[a-z]/.test(text)) score -= 2;

  return score;
}

/**
 * Score how much a text fragment looks like a job title / role.
 * Higher score = more likely to be a role.
 * Used by resolvePipeParts() to disambiguate pipe-separated role/company.
 */
function scoreRolePart(text: string): number {
  let score = 0;
  const lower = text.toLowerCase();

  // Core role title keywords (matches a wide range of professions)
  // Note: "engineer(?:ing)?" so both "Engineer" and "Engineering" match
  if (/\b(?:developer|engineer(?:ing)?|manager|designer|analyst|specialist|consultant|director|lead|head|chief|officer|assistant|associate|coordinator|supervisor|representative|agent|advisor|architect|scientist|administrator|operator|technician|instructor|trainer|writer|editor|producer|strategist|planner|intern|trainee|apprentice|freelancer|practitioner|executive|president|partner|owner|founder|attorney|paralegal|nurse|doctor|physician|surgeon|therapist|counselor|pharmacist|accountant|auditor|broker|underwriter|analyst|researcher|librarian|curator|technician|engineer|programmer|coder|architect|designer|artist|illustrator|animator|photographer|videographer|editor|writer|journalist|reporter|producer|director|manager|supervisor|coordinator|administrator|secretary|receptionist|clerk|assistant|aide|technician|specialist|consultant)/i.test(lower)) score += 2;

  // Level/seniority indicators (reinforces role context)
  if (/\b(senior|junior|mid|entry|sr\.?|jr\.?|lead|head|chief|principal|staff|associate|vp|vice\s*president|executive|intern|trainee|apprentice|freelancer|independent|director|manager|supervisor)\b/i.test(lower)) score += 1;

  // "of" preposition ("VP of Engineering", "Director of Sales")
  if (/\bof\b/i.test(lower)) score += 1;

  // Short single capitalized "brand-like" words — negative signal for role (company-like)
  if (/^[A-Z][a-zA-Z]+$/.test(text) && text.length >= 3 && text.length <= 24 && !roleKeywordRegex(lower)) score -= 1;

  return score;
}

/** Helper: quick check if text contains any role keyword */
function roleKeywordRegex(lower: string): boolean {
  return /\b(?:developer|engineer(?:ing)?|manager|designer|analyst|specialist|consultant|director|lead|head|chief|officer|assistant|associate|coordinator|supervisor|writer|editor|producer|planner|intern|trainee|executive|president|partner|owner|founder|attorney|nurse|doctor|accountant|auditor|broker|researcher|journalist|reporter|artist|designer|programmer|coder|architect|technician|instructor|trainer|therapist|counselor|pharmacist|photographer|editor|assistant|clerk|agent|representative)\b/i.test(lower);
}

/**
 * Resolve pipe/separator-separated parts into company, title, and extra info.
 *
 * Standard CV convention: A | B | C  →  Title | Company | Location
 *
 * Uses a scoring system with position bias:
 *   - Default bias: A is the job title, B is the company
 *   - Override when scores strongly contradict the default
 *   - For 3+ parts: A=title, B=company, rest=extra info
 */
function resolvePipeParts(
  parts: string[],
): { company?: string; title?: string; extra?: string } {
  // ── 3+ parts: "Title | Company | Location" ────────────────────────
  if (parts.length >= 3) {
    return {
      title: parts[0],
      company: parts[1],
      extra: parts.slice(2).join(' | '),
    };
  }

  // ── 2 parts: "Title | Company" (or reversed) ──────────────────────
  const [partA, partB] = parts;
  const csA = scoreCompanyPart(partA);
  const csB = scoreCompanyPart(partB);
  const rsA = scoreRolePart(partA);
  const rsB = scoreRolePart(partB);

  // Decision matrix — order matters (first match wins):

  // 1. Strong suffix on B, none on A → B is company (standard format)
  if (csB >= 4 && csA < 2) return { company: partB, title: partA };

  // 2. Strong suffix on A, none on B → A is company (unusual reversed format)
  if (csA >= 4 && csB < 2) return { company: partA, title: partB };

  // 3. Clear role on A, no role on B → A is title, B is company (standard format)
  if (rsA >= 2 && rsB < 2) return { company: partB, title: partA };

  // 4. Clear role on B, no role on A → B is title, A is company (reversed format)
  if (rsB >= 2 && rsA < 2) return { company: partA, title: partB };

  // 5. Medium company signal on B, A has none or less → B is company
  if (csB >= 1 && csA <= csB) return { company: partB, title: partA };

  // 6. Medium company signal on A, none on B → A is company
  if (csA >= 1 && csB < 1) return { company: partA, title: partB };

  // 7. Default position bias: A = title, B = company
  return { company: partB, title: partA };
}

/**
 * Parse a single experience block (one job) into an ExperienceEntry.
 *
 * Detection strategy:
 * 1. Scan every line for date patterns → extract duration, remove those lines from further analysis.
 * 2. Scan remaining lines for company signal (keywords like "at", Company-like patterns, line containing "Ltd" / "Inc" / "SAS" / "SRL").
 * 3. The first remaining meaningful line is the job title.
 * 4. Everything else is description.
 */
function parseSingleExperienceBlock(lines: string[]): ExperienceEntry | null {
  const dateRegex = /\b(?:\d{4})\s*(?:-|–|—|to|a|al?)\s*(?:\d{4}|present|actual(?:idad)?|now|current|hoy|today|date)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember|t)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\s+\d{4}|\b(?:19|20)\d{2}\s*-\s*(?:19|20)\d{2}\b/i;

  const remaining: string[] = [];
  let duration: string | undefined;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      duration = duration ? `${duration} / ${line}` : line;
    } else {
      remaining.push(line);
    }
  }

  if (remaining.length === 0) return null;

  // ── Detect company ────────────────────────────────────────────────
  const companyIndicators = /(?:^|\bat\b|^empresa|^compañía|^companía|inc\.?$|ltd\.?$|llc$|gmbh$|s\.?a\.?s?\.?$|s\.?r\.?l\.?$|corp\.?$|corporation$|limited$|plc$|s\.?p\.?a\.?$|s\.?l\.?$|s\.?c\.?o\.?$)/i;

  let company: string | undefined;
  const afterCompany: string[] = [];

  for (const line of remaining) {
    if (companyIndicators.test(line) || /\bat\b/i.test(line) || line.split(/\s*[|–—]\s*/).length > 1) {
      // Handle "at Company" pattern: "Developer at Acme Corp"
      const atMatch = line.match(/\bat\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ.\s&]+?)(?:$|[,\s]\d)/);
      if (atMatch) {
        company = atMatch[1].trim();
        // The part before "at" is likely the title — push it for title detection
        const beforeAt = line.replace(/\s+at\s+.*/, '').trim();
        if (beforeAt) afterCompany.push(beforeAt);
        continue;
      }

      // Handle pipe/em-dash separated formats:
      //   "Title | Company"              → A=title, B=company
      //   "Title | Company | Location"   → A=title, B=company, C=location
      //   "Company | Title" (uncommon)   → A=company, B=title
      if (line.includes('|') || line.includes('–') || line.includes('—')) {
        const parts = line.split(/\s*[|–—]\s*/).map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2 && !company) {
          const resolved = resolvePipeParts(parts);
          company = resolved.company;
          if (resolved.title) afterCompany.push(resolved.title);
          if (resolved.extra) afterCompany.push(resolved.extra);
          continue;
        }
      }
    }
    afterCompany.push(line);
  }

  // ── Detect job title ──────────────────────────────────────────────
  // The first non-contextual line often IS the job title.
  // Also handle "Title | Company" format where the first part is the title.
  let jobTitle: string | undefined;
  const descriptionLines: string[] = [];

  // Try to find title, company and description
  for (let i = 0; i < afterCompany.length; i++) {
    const line = afterCompany[i];

    // Skip lines that are clearly bullet points (start with •, -, *, →, etc.)
    if (/^[•\-*▪▸→◆]|^\d+\.\s/.test(line)) {
      descriptionLines.push(line.replace(/^[•\-*▪▸→◆]\s*/, '').trim());
      continue;
    }

    // Skip very short lines
    if (line.length < 4) continue;

    // If we haven't found a title yet, the first substantial line is likely the title
    if (!jobTitle) {
      jobTitle = line;
      continue;
    }

    // If we found a company but no title yet, first line might be company
    if (jobTitle && !company) {
      // Check if this line looks like a company name
      if (/^(?:[A-Z][a-z]+\s)*(?:Inc|Ltd|LLC|Corp|GmbH|S\.?A\.?)\.?$|\bcompany\b|\bcorporation\b|\benterprise\b/i.test(line)) {
        company = line;
        continue;
      }
    }

    descriptionLines.push(line);
  }

  // ── Edge case: one-liner like "Frontend Developer at Acme Corp (2020-2023)" ──
  if (!jobTitle && !company && lines.length === 1) {
    const singleLine = lines[0];
    const parts = singleLine.split(/\s+(?:at|@|en|for|–|—|-|\|)\s+/);
    if (parts.length >= 2) {
      jobTitle = parts[0].replace(dateRegex, '').trim();
      company = parts.slice(1).join(' ').replace(dateRegex, '').trim();
    }
  }

  const description =
    descriptionLines.length > 0 ? descriptionLines.join('\n').trim() : undefined;

  if (!jobTitle && !company && !description) return null;

  return {
    jobTitle: jobTitle?.replace(dateRegex, '').replace(/^[•\-*▪▸→◆]\s*/, '').trim() || undefined,
    company: company?.replace(dateRegex, '').replace(/^[•\-*▪▸→◆]\s*/, '').trim() || undefined,
    duration: duration || undefined,
    description,
  };
}

/**
 * Extract education entries from CV education section
 *
 * Uses block-based parsing: splits into blocks by blank lines,
 * then identifies degree type, institution name, and graduation year.
 *
 * @param text - Education section text
 * @returns Array of education entries
 */
export function extractEducation(text: string): EducationEntry[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // ── Block splitting ──────────────────────────────────────────────
  // Split into blocks separated by blank lines.
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 5);

  const education: EducationEntry[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) continue;

    const entry = parseSingleEducationBlock(lines);
    if (entry) {
      education.push(entry);
    }
  }

  return education;
}

/**
 * Degree-level keywords in multiple languages to detect education entries.
 */
const DEGREE_KEYWORDS = [
  // English
  /bachelor/i, /master/i, /ph\.?d/i, /doctorate/i, /associate/i,
  /diploma/i, /certificate/i, /certification/i, /degree/i, /b\.?s\.?c/i, /b\.?a\.?/i,
  /m\.?s\.?c/i, /m\.?a\.?/i, /m\.?b\.?a/i, /engineer(?:'s|ing)?/i,
  /licentiate/i, /baccalaureate/i, /technician/i,
  /training/i, /program/i, /course(?:s)?/i,
  // Spanish
  /licenciatura/i, /ingeniería/i, /ingenieria/i, /técnico/i,
  /tecnólogo/i, /tecnologo/i, /maestría/i, /maestria/i,
  /posgrado/i, /postgrado/i, /doctorado/i, /especialización/i,
  /especializacion/i, /bachiller/i, /pregrado/i,
  /diseño/i, /diseño\s+gráfico/i, /diseño\s+visual/i, /diseño\s+digital/i,
  /curso/i, /diplomado/i, /certificación/i, /certificado/i,
  /comunicación/i, /comunicacion/i, /publicidad/i,
  /mercadeo/i, /marketing/i, /arquitectura/i,
  /arte/i, /artes/i, /música/i, /musica/i,
  /administración/i, /administracion/i, /contaduría/i, /contaduria/i,
  /economía/i, /economia/i, /finanzas/i,
  /enfermería/i, /enfermeria/i, /medicina/i, /derecho/i, /psicología/i, /psicologia/i,
  /programa\s+de/i, /carrera\s+(?:de\s+)?profesional/i,
  // French
  /baccalauréat/i, /baccalaureat/i, /licence/i, /master/i,
  /doctorat/i, /diplôme/i, /diplome/i,
  // Portuguese
  /bacharel/i, /licenciatura/i, /mestrado/i, /doutorado/i,
  // Italian
  /laurea/i, /dottorato/i,
];

/**
 * Known institution keywords to identify the organization.
 */
const INSTITUTION_KEYWORDS = [
  /universidad/i, /universidade/i, /université/i, /university/i,
  /università/i, /universität/i, /univ\.?/i,
  /college/i, /institute/i, /instituto/i, /institut/i,
  /school/i, /escuela/i, /école/i, /écoles?/i, /schule/i,
  /academy/i, /academia/i, /académie/i, /akademie/i,
  /politecnico/i, /polytechnic/i, /politécnico/i,
  /facultad/i, /faculdade/i, /faculté/i, /faculty/i,
  /tecnológico/i, /tecnologico/i, /technological/i,
  /campus/i,
  /sena/i, /platzi/i, /domestika/i, /coursera/i, /udemy/i,
  /edx/i, /udacity/i, /linkedin\s*learning/i,
];

/**
 * Parse a single education block (one degree) into an EducationEntry.
 */
function parseSingleEducationBlock(lines: string[]): EducationEntry | null {
  let degree: string | undefined;
  let institution: string | undefined;
  let graduationYear: string | undefined;

  // ── 1. Find graduation year ──────────────────────────────────────
  // Prefer the LAST (most recent) year when a range is present.
  // E.g. "2017–2021" → graduationYear = "2021"
  const yearRegex = /\b((?:19|20)\d{2})\b/g;
  const allYears: string[] = [];
  for (const line of lines) {
    let m;
    while ((m = yearRegex.exec(line)) !== null) {
      allYears.push(m[1]);
    }
  }
  // Range like "2017–2021" → use the last year
  if (allYears.length >= 2) {
    graduationYear = allYears[allYears.length - 1];
  } else if (allYears.length === 1) {
    graduationYear = allYears[0];
  }

  // ── 2. Detect degree type ────────────────────────────────────────
  // The line containing a degree keyword is the degree line
  for (const line of lines) {
    for (const pattern of DEGREE_KEYWORDS) {
      if (pattern.test(line)) {
        degree = line;
        break;
      }
    }
    if (degree) break;
  }

  // ── 3. Detect institution ────────────────────────────────────────
  // Lines containing institution keywords
  for (const line of lines) {
    for (const pattern of INSTITUTION_KEYWORDS) {
      if (pattern.test(line)) {
        institution = line;
        break;
      }
    }
    if (institution) break;
  }

  // ── 4. Combined line format ───────────────────────────────────────
  // Handle "Degree, Institution" or "Institution - Degree" formats
  if (!degree && !institution && lines.length === 1) {
    const line = lines[0];

    // Try "Degree, Institution (Year)" or "Degree — Institution (Year)"
    // Handles both en-dash (U+2013) and em-dash (U+2014)
    const combinedDegreeMatch = line.match(
      /^(.+?)(?:,|\s+at\s+|\s+[–—]\s+|\s+-\s+|\s+en\s+|\s+@\s+)(.+?)(?:\s*[,–]\s*(\d{4}))?$/,
    );
    if (combinedDegreeMatch) {
      const first = combinedDegreeMatch[1].trim();
      const second = combinedDegreeMatch[2].trim();

      // Heuristic: if one contains degree keywords, it's the degree
      const firstIsDegree = DEGREE_KEYWORDS.some((p) => p.test(first));
      const secondIsInstitution =
        INSTITUTION_KEYWORDS.some((p) => p.test(second)) ||
        /^(?:universidad|universidade|university|college|institute|school)/i.test(second);

      if (firstIsDegree || secondIsInstitution) {
        degree = first;
        institution = second;
      } else {
        institution = first;
        degree = second;
      }

      if (combinedDegreeMatch[3]) {
        graduationYear = graduationYear || combinedDegreeMatch[3];
      }
    }
  }

  // ── 5. Split institution on dash if degree is missing ────────────
  // When institution was found (via keyword) but no degree was matched,
  // the line might be "Degree — Institution". Try splitting on common dashes.
  if (!degree && institution) {
    const dashSplit = institution.split(/\s*[–—]\s*/);
    if (dashSplit.length >= 2) {
      const first = dashSplit[0].trim();
      const second = dashSplit.slice(1).join(' — ').trim();
      // Determine which part is the degree (no institution keywords)
      const secondIsInstitution = INSTITUTION_KEYWORDS.some((p) => p.test(second));
      if (secondIsInstitution || !DEGREE_KEYWORDS.some((p) => p.test(second))) {
        degree = first;
        institution = second;
      }
    }
  }

  // ── 6. Fallback: grab the most meaningful line ───────────────────
  if (!degree && !institution) {
    // Return the longest line (most informative)
    const meaningful = [...lines]
      .filter((l) => l.length > 10)
      .sort((a, b) => b.length - a.length);
    if (meaningful.length > 0) {
      degree = meaningful[0];
    }
  }

  if (!degree && !institution) return null;

  return {
    degree: degree?.trim() || undefined,
    institution: institution?.trim() || undefined,
    graduationYear: graduationYear?.trim() || undefined,
  };
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
