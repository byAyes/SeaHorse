import { Matcher, MatchResult } from './types';
import { Job } from '../../../types/job';

async function queryOpenAI(job: Job, interests: string[]): Promise<MatchResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Rate how well this job matches the user's interests on a 0-100 scale. Job: "${job.title}" at ${job.company}. Skills: ${job.skills.join(', ')}. User interests: ${interests.join(', ')}. Reply with only a JSON object: {"score": number, "reason": "brief explanation"}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { score: number; reason: string };

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
        reason: parsed.reason || 'OpenAI match',
      };
    }
  } catch {
    // OpenAI unavailable
  }

  return null;
}

const openaiMatcher: Matcher = {
  async calculateMatchScore(job: Job, interests: string[]): Promise<MatchResult> {
    const aiResult = await queryOpenAI(job, interests);
    if (aiResult) return aiResult;

    const { default: keywordMatcher } = await import('./keyword');
    return keywordMatcher.calculateMatchScore(job, interests);
  },
};

export default openaiMatcher;
