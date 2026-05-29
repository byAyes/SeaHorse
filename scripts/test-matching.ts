import { prisma } from '../src/lib/prisma';
import { scoreAndSortJobs } from '../src/matching/scorer';
import type { UserProfile } from '../src/types/user-profile';
import type { Job } from '../src/types/job';

async function testMatching() {
  try {
    let dbProfile = await prisma.userProfile.findUnique({
      where: { userId: 'test-user' },
    });

    if (!dbProfile) {
      console.log('Creating test user profile...');
      dbProfile = await prisma.userProfile.create({
        data: {
          userId: 'test-user',
          skills: ['JavaScript', 'React', 'Node.js'],
          interests: ['Frontend', 'Web Development'],
          location: null,
          remoteOnly: true,
          experienceLevel: 'mid',
          skillWeight: 0.4,
          interestWeight: 0.3,
          locationWeight: 0.2,
          salaryWeight: 0.1,
        },
      });
    }

    const userProfile: UserProfile = {
      id: dbProfile.id,
      userId: dbProfile.userId,
      createdAt: dbProfile.createdAt,
      updatedAt: dbProfile.updatedAt,
      skills: dbProfile.skills,
      interests: dbProfile.interests,
      location: dbProfile.location,
      remoteOnly: dbProfile.remoteOnly,
      experienceLevel: dbProfile.experienceLevel as UserProfile['experienceLevel'],
      minSalary: dbProfile.minSalary,
      maxSalary: dbProfile.maxSalary,
      skillWeight: dbProfile.skillWeight,
      interestWeight: dbProfile.interestWeight,
      locationWeight: dbProfile.locationWeight,
      salaryWeight: dbProfile.salaryWeight,
      summary: dbProfile.summary || null,
      languages: dbProfile.languages || [],
      jobTitles: dbProfile.jobTitles || [],
      industries: dbProfile.industries || [],
      education: dbProfile.education || [],
    };

    const dbJobs = await prisma.job.findMany({ take: 10 });

    const jobs: Job[] = dbJobs.map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description,
      url: j.url,
      salary: j.salary,
      postedAt: j.postedAt,
      scrapedAt: j.scrapedAt,
      skills: j.skills,
      category: j.category,
    }));

    console.log(`Testing matching with ${jobs.length} jobs...`);
    console.log(`User profile: ${userProfile.skills.join(', ')}`);

    const matches = scoreAndSortJobs(jobs, userProfile, 50);

    console.log(`\nFound ${matches.length} matches (threshold: 50%):`);
    matches.slice(0, 5).forEach((match, i) => {
      console.log(`${i + 1}. ${match.job.title} at ${match.job.company}`);
      console.log(`  Score: ${match.score.overall}%`);
      console.log(`  Skills: ${match.score.skillMatch}%, Interests: ${match.score.interestMatch}%`);
    });
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMatching().catch(console.error);
