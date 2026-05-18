import { prisma } from '../src/lib/prisma';
import { sendEmail } from '../src/lib/email';
import { formatJobDigest } from '../src/lib/email/template';

async function sendEmailDigest() {
  try {
    const RECIPIENT_EMAIL = process.env.DIGEST_RECIPIENT_EMAIL || process.env.GMAIL_RECIPIENT;
    if (!RECIPIENT_EMAIL) {
      throw new Error(
        'No recipient email configured. Set DIGEST_RECIPIENT_EMAIL or GMAIL_RECIPIENT env var',
      );
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const digests = await prisma.emailDigest.findMany({
      where: {
        sentAt: { gte: sevenDaysAgo },
      },
      include: {
        jobs: { take: 10 },
      },
    });

    console.log(`Found ${digests.length} digests from the past week`);

    const allJobs = digests.flatMap((d) => d.jobs);

    if (allJobs.length === 0) {
      console.log('No jobs found in recent digests');
      return;
    }

    const jobEntries = allJobs.map((j) => ({
      job: {
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
      },
      score: 80,
      matchedSkills: j.skills,
    }));

    const { text, html } = formatJobDigest(jobEntries);

    const result = await sendEmail(
      RECIPIENT_EMAIL,
      `Weekly Job Digest - ${allJobs.length} new matches`,
      text,
      undefined,
      html,
    );

    if (result.success) {
      console.log(`Digest sent to ${RECIPIENT_EMAIL} (${allJobs.length} jobs)`);
    } else {
      console.error(`Failed to send digest: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending email digests:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendEmailDigest();
