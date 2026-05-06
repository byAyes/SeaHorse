/**
 * Skill matching utilities for job matching system
 * Handles fuzzy matching and skill normalization
 */

/**
 * Common skill name variations and synonyms
 */
const skillSynonyms: Record<string, string> = {
  'javascript': 'javascript',
  'js': 'javascript',
  'node': 'node.js',
  'reactjs': 'react',
  'react.js': 'react',
  'reactjavascript': 'react',
  'nodejs': 'node.js',
  'typescript': 'typescript',
  'ts': 'typescript',
};

/**
 * Normalize a skill name to a canonical form
 * @param skill - The skill name to normalize
 * @returns Normalized skill name in lowercase
 */
export function normalizeSkill(skill: string): string {
  const normalized = skill
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .trim();

  if (skillSynonyms[normalized]) {
    return skillSynonyms[normalized];
  }

  const withoutDotJs = normalized.replace(/\.js$/, 'js');
  if (skillSynonyms[withoutDotJs]) {
    return skillSynonyms[withoutDotJs];
  }

  return withoutDotJs;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of skills with typos
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Distance between 0 and max(s1.length, s2.length)
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  // Create matrix
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Check if two skills match (exact, substring, or fuzzy)
 * @param userSkill - Normalized user skill
 * @param jobSkill - Normalized job skill
 * @returns true if skills match
 */
function skillsMatch(userSkill: string, jobSkill: string): boolean {
  if (userSkill === jobSkill) {
    return true;
  }

  const minLen = Math.min(userSkill.length, jobSkill.length);
  const maxLen = Math.max(userSkill.length, jobSkill.length);

  if (minLen <= 2) {
    return false;
  }

  const isSubstring = userSkill.includes(jobSkill) || jobSkill.includes(userSkill);
  if (isSubstring && (maxLen - minLen) <= 2) {
    return true;
  }

  const distance = levenshteinDistance(userSkill, jobSkill);
  const maxDistance = Math.max(1, Math.floor(minLen / 3));
  return distance <= maxDistance;
}

/**
 * Calculate skill overlap between user skills and job requirements
 * @param userSkills - Array of user's skills
 * @param jobSkills - Array of job's required skills
 * @returns Object with score (0-100) and array of matched skills
 */
export function calculateSkillOverlap(
  userSkills: string[],
  jobSkills: string[]
): { score: number; matchedSkills: string[] } {
  if (userSkills.length === 0) {
    return { score: 100, matchedSkills: [] }; // No user skills = neutral
  }
  
  const normalizedUserSkills = userSkills.map(normalizeSkill);
  const normalizedJobSkills = jobSkills.map(normalizeSkill);
  
  const matchedSkills: string[] = [];
  
  for (const userSkill of normalizedUserSkills) {
    for (const jobSkill of normalizedJobSkills) {
      if (skillsMatch(userSkill, jobSkill)) {
        matchedSkills.push(userSkill);
        break;
      }
    }
  }
  
  // Calculate percentage: matchedSkills / totalUserSkills
  const score = (matchedSkills.length / userSkills.length) * 100;
  
  return {
    score: Math.round(score * 100) / 100,
    matchedSkills: [...new Set(matchedSkills)] // Remove duplicates
  };
}
