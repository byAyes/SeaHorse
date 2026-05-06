import { Job } from '../../../types/job';

export interface MatchResult {
  score: number;
  matchedSkills: string[];
  matchedInterests: string[];
  missingSkills: string[];
  reason: string;
}

export interface Matcher {
  calculateMatchScore(job: Job, interests: string[]): Promise<MatchResult>;
}
