import { prisma } from '../src/lib/prisma';
import { scoreAndSortJobs } from '../src/matching/scorer';

async function testMatching() {
  try {
    // Get or create test user profile
    let userProfile = await prisma.userProfile.findUnique({
      where: { userId: 'test-user' }
    });

    if (!userProfile) {
      console.log('Creating test user profile...');
      userProfile = await prisma.userProfile.create({
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
          salaryWeight: 0.1
        }
      });
    }

    // Get jobs
    const jobs = await prisma.job.findMany({
      take: 10
    });

    console.log(`Testing matching with ${jobs.length} jobs...`);
    console.log(`User profile: ${userProfile.skills.join(', ')}`);

    // Score jobs
    const matches = scoreAndSortJobs(jobs, userProfile, 50);

    console.log(`\nFound ${matches.length} matches (threshold: 50%):`);
    matches.slice(0, 5).forEach((match, i) => {
      console.log(`${i + 1}. ${match.job.title} at ${match.job.company}`);
      console.log(`   Score: ${match.score.overall}%`);
      console.log(`   Skills: ${match.score.skillMatch}%, Interests: ${match.score.interestMatch}%`);
    });

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMatching().catch(console.error);
