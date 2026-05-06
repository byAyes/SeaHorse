import { MatchResult, Matcher } from './types';
import { Job } from '../../../types/job';

let matcherInstance: Matcher | null = null;
let matcherInit: Promise<Matcher> | null = null;

function getMatcher(): Promise<Matcher> {
  if (matcherInstance) return Promise.resolve(matcherInstance);
  if (matcherInit) return matcherInit;

  matcherInit = initMatcher();
  return matcherInit;
}

async function initMatcher(): Promise<Matcher> {
  const provider = process.env.MATCHING_PROVIDER || 'keyword';

  switch (provider) {
    case 'keyword': {
      console.log('Using Keyword Matcher (no AI, free)');
      const m = await import('./keyword');
      matcherInstance = m.default;
      return matcherInstance;
    }

    case 'ollama': {
      console.log('Using Ollama Matcher (local, free)');
      const m = await import('./ollama');
      matcherInstance = m.default;
      return matcherInstance;
    }

    case 'gemini': {
      console.log('Using Gemini Matcher (free API)');
      const m = await import('./gemini');
      matcherInstance = m.default;
      return matcherInstance;
    }

    case 'openai': {
      if (process.env.OPENAI_API_KEY) {
        console.log('Using OpenAI Matcher');
        const m = await import('./openai');
        matcherInstance = m.default;
        return matcherInstance;
      }
      console.log('OpenAI key not found → Using Keyword Matcher (free)');
      const m = await import('./keyword');
      matcherInstance = m.default;
      return matcherInstance;
    }

    default: {
      if (process.env.OPENAI_API_KEY) {
        console.log('Using OpenAI Matcher');
        const m = await import('./openai');
        matcherInstance = m.default;
        return matcherInstance;
      }
      console.log('Using Keyword Matcher (no AI, free)');
      const m = await import('./keyword');
      matcherInstance = m.default;
      return matcherInstance;
    }
  }
}

export async function calculateMatchScore(job: Job, userInterests: string[]): Promise<MatchResult> {
  const matcher = await getMatcher();
  return matcher.calculateMatchScore(job, userInterests);
}

export { MatchResult } from './types';
