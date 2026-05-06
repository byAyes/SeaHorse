import { prisma } from '../src/lib/prisma';
import { sendEmail } from '../src/lib/email';

async function sendEmailDigest() {
  try {
    const users = await prisma.userProfile.findMany({
      where: { email: { not: null } },
      include: {
        receivedDigests: {
          where: {
            sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          },
          include: { jobs: { take: 10 } }
        }
      }
    });

    console.log(`Sending digests to ${users.length} users`);

    let sent = 0;

    for (const user of users) {
      if (!user.email) continue;

      const recentDigests = user.receivedDigests;
      if (recentDigests.length === 0) continue;

      const allJobs = recentDigests.flatMap(d => d.jobs);
      if (allJobs.length === 0) continue;

      const digestHtml = allJobs.map(j =>
        `<li><strong>${j.title}</strong> at ${j.company}${j.location ? ` - ${j.location}` : ''}</li>`
      ).join('\n');

      const html = `<h2>Your Weekly Job Digest</h2><p>${allJobs.length} new jobs found:</p><ul>${digestHtml}</ul>`;

      try {
        await sendEmail({
          to: user.email,
          subject: `Weekly Job Digest - ${allJobs.length} new matches`,
          html,
        });
        sent++;
      } catch (error) {
        console.error(`Failed to send to ${user.email}:`, error);
      }
    }

    console.log(`Email digests complete: ${sent} sent`);
  } catch (error) {
    console.error('Error sending email digests:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

sendEmailDigest();
