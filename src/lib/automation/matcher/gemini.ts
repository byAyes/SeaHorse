import { Matcher, MatchResult } from './types';
import { Job } from '../../../types/job';

async function queryGemini(job: Job, interests: string[]): Promise<MatchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Rate how well this job matches the user's interests on a 0-100 scale. Job: "${job.title}" at ${job.company}. Skills: ${job.skills.join(', ')}. User interests: ${interests.join(', ')}. Reply with only a JSON object: {"score": number, "reason": "brief explanation"}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
        reason: parsed.reason || 'Gemini match',
      };
    }
  } catch {
    // Gemini unavailable
  }

  return null;
}

const geminiMatcher: Matcher = {
  async calculateMatchScore(job: Job, interests: string[]): Promise<MatchResult> {
    const aiResult = await queryGemini(job, interests);
    if (aiResult) return aiResult;

    const { default: keywordMatcher } = await import('./keyword');
    return keywordMatcher.calculateMatchScore(job, interests);
  },
};

export default geminiMatcher;
