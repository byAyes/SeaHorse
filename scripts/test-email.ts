import 'dotenv/config';
import { sendEmail } from '../src/lib/email';
import { formatJobDigest } from '../src/lib/email/template';

async function testEmail() {
  console.log('=== Testing Email Configuration ===\n');

  const mockJobs = [
    {
      job: {
        id: 'test-job-1',
        title: 'Senior Software Engineer',
        company: 'Test Company',
        location: 'Remote',
        description: null,
        url: 'https://example.com/job/1',
        salary: null,
        postedAt: null,
        scrapedAt: new Date(),
        skills: ['JavaScript', 'React', 'Node.js'],
        category: null,
      },
      score: 85,
      matchedSkills: ['JavaScript', 'React', 'Node.js'],
    }
  ];

  const emailBody = formatJobDigest(mockJobs);

  console.log('Attempting to send test email...\n');

  const result = await sendEmail(
    process.env.GMAIL_RECIPIENT || 'test@example.com',
    'Test Job Digest - Software Engineer Jobs',
    emailBody.text,
    undefined,
    emailBody.html
  );

  if (result.success) {
    console.log('\n✅ SUCCESS! Email sent successfully!');
    console.log('Message ID: ' + result.messageId);
  } else {
    console.log('\n❌ FAILED to send email');
    console.log('Error: ' + result.error);
  }

  console.log('\n=== Test Complete ===');
}

testEmail().catch(console.error);
