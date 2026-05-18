import { prisma } from '../src/lib/prisma';
import { ScraperRunner } from '../src/scrapers';

async function scrapeJobs() {
  const query = process.env.SCRAPE_QUERY || 'software developer';
  const maxJobs = parseInt(process.env.SCRAPE_MAX_JOBS || '20', 10);

  try {
    const users = await prisma.userProfile.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: { userId: true, skills: true, interests: true },
    });

    console.log(`Found ${users.length} users with updated profiles`);

    const queries = [query];

    for (const interest of users.flatMap((u) => u.interests || []).slice(0, 5)) {
      if (!queries.includes(interest)) queries.push(interest);
    }

    let totalScraped = 0;

    for (const q of queries.slice(0, 3)) {
      console.log(`Scraping query: "${q}" (max ${maxJobs})`);
      try {
        const runner = new ScraperRunner({ query: q, maxJobs });
        const jobs = await runner.runAllScrapers();
        totalScraped += jobs.length;
        console.log(`Scraped ${jobs.length} jobs for "${q}"`);
      } catch (error) {
        console.error(`Failed to scrape "${q}":`, error);
      }
    }

    console.log(`Scraping complete: ${totalScraped} total jobs`);
  } catch (error) {
    console.error('Error in job scraping:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

scrapeJobs();
