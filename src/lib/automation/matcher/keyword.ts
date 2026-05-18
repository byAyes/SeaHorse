import { Matcher, MatchResult } from './types';
import { Job } from '../../../types/job';
import { calculateSkillOverlap } from '../../../matching/skill-matcher';

const keywordMatcher: Matcher = {
  async calculateMatchScore(job: Job, interests: string[]): Promise<MatchResult> {
    const skillResult = calculateSkillOverlap(interests, job.skills);

    const matchedInterests = interests.filter((interest) => {
      const lower = interest.toLowerCase();
      return (
        job.title.toLowerCase().includes(lower) ||
        (job.description?.toLowerCase().includes(lower) ?? false) ||
        (job.category?.toLowerCase().includes(lower) ?? false)
      );
    });

    const missingSkills = job.skills.filter((skill) => !skillResult.matchedSkills.includes(skill));

    const score = Math.min(
      100,
      Math.round(
        skillResult.score * 0.7 +
          (matchedInterests.length / Math.max(interests.length, 1)) * 100 * 0.3,
      ),
    );

    return {
      score,
      matchedSkills: skillResult.matchedSkills,
      matchedInterests,
      missingSkills,
      reason: `Keyword match: ${skillResult.matchedSkills.length}/${job.skills.length} skills, ${matchedInterests.length}/${interests.length} interests`,
    };
  },
};

export default keywordMatcher;
