import { Matcher, MatchResult } from './types';
import { Job } from '../../../types/job';

async function queryOllama(job: Job, interests: string[]): Promise<MatchResult | null> {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        prompt: `Rate how well this job matches the user's interests on a 0-100 scale. Job: "${job.title}" at ${job.company}. Skills: ${job.skills.join(', ')}. User interests: ${interests.join(', ')}. Reply with only a JSON object: {"score": number, "reason": "brief explanation"}`,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response: string };
    const parsed = JSON.parse(data.response) as { score: number; reason: string };

    if (typeof parsed.score === 'number') {
      return {
        score: Math.min(100, Math.max(0, Math.round(parsed.score))),
        matchedSkills: job.skills.filter((s) =>
          interests.some((i) => i.toLowerCase() === s.toLowerCase()),
        ),
        matchedInterests: interests.filter(
          (i) =>
            job.skills.some((s) => s.toLowerCase() === i.toLowerCase()) ||
            job.title.toLowerCase().includes(i.toLowerCase()),
        ),
        missingSkills: job.skills.filter(
          (s) => !interests.some((i) => i.toLowerCase() === s.toLowerCase()),
        ),
        reason: parsed.reason || 'Ollama match',
      };
    }
  } catch {
    // Ollama unavailable
  }

  return null;
}

const ollamaMatcher: Matcher = {
  async calculateMatchScore(job: Job, interests: string[]): Promise<MatchResult> {
    const aiResult = await queryOllama(job, interests);
    if (aiResult) return aiResult;

    const { default: keywordMatcher } = await import('./keyword');
    return keywordMatcher.calculateMatchScore(job, interests);
  },
};

export default ollamaMatcher;
