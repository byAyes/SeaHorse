import { prisma } from '../src/lib/prisma';
import { calculateMatchScore } from '../src/lib/automation/matcher';

async function matchJobs() {
  try {
    const users = await prisma.userProfile.findMany({
      include: { cvs: { where: { status: 'applied' }, take: 1 } }
    });

    console.log(`Matching jobs for ${users.length} users`);

    const recentJobs = await prisma.job.findMany({
      where: {
        scrapedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      take: 100,
      orderBy: { scrapedAt: 'desc' }
    });

    console.log(`Found ${recentJobs.length} recent jobs to match`);

    let totalMatches = 0;

    for (const user of users) {
      const interests = [...(user.interests || [])];
      const cv = user.cvs[0];
      if (cv) {
        interests.push(...(cv.skills || []));
      }

      if (interests.length === 0) continue;

      for (const job of recentJobs) {
        try {
          const result = await calculateMatchScore(job, interests);
          if (result.score >= 70) {
            totalMatches++;
          }
        } catch {
          // Skip individual match failures
        }
      }
    }

    console.log(`Matching complete: ${totalMatches} high-quality matches found`);
  } catch (error) {
    console.error('Error in job matching:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

matchJobs();
