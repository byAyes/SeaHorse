import { describe, expect, it } from '@jest/globals';
import { extractSkills } from '../src/lib/cv/skillExtractor';

describe('extractSkills', () => {
  it('keeps technical skills and filters personal/contact details', () => {
    const text = `
      Juan Esteban Serna Buitrago
      +57 319 567 9905
      juanesteban2045@gmail.com
      linkedin.com/in/juan-serna-ba19b6258

      Professional Summary
      High performance web developer expanding rapidly into React, Next.js and AI API integrations.
      Frontend: React, Angular, JavaScript (ES2022+), HTML5, CSS3, Bootstrap, RxJS.
      AI & Automation: OpenAI API, Anthropic Claude API, Make (Integromat), n8n, prompt engineering.
      Testing: Cypress (E2E), Karma, Jest.
      Tools & Methods: Git, GitHub, Figma, Agile/Scrum, performance optimization.
    `;

    const skills = extractSkills(text);

    expect(skills).toEqual(
      expect.arrayContaining([
        'react',
        'next.js',
        'angular',
        'javascript',
        'html5',
        'css3',
        'bootstrap',
        'rxjs',
        'openai api',
        'anthropic claude api',
        'make',
        'n8n',
        'prompt engineering',
        'cypress',
        'karma',
        'jest',
        'git',
        'github',
        'figma',
      ]),
    );
    expect(skills).not.toEqual(expect.arrayContaining(['juanesteban2045@gmail.com']));
    expect(skills.some((skill) => skill.includes('linkedin'))).toBe(false);
    expect(skills.some((skill) => skill.includes('319 567'))).toBe(false);
    expect(skills.some((skill) => skill.split(' ').length > 3)).toBe(false);
  });
});
