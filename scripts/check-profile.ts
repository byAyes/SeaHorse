import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Querying user profiles...');
  const profiles = await prisma.userProfile.findMany();
  console.log('Profiles found:', profiles.length);

  if (profiles.length === 0) {
    console.log('No profiles. Creating default...');
    const profile = await prisma.userProfile.create({
      data: {
        userId: 'default',
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL'],
        interests: ['Full Stack Development', 'Cloud Computing', 'DevOps'],
        location: 'Remote',
        remoteOnly: true,
        experienceLevel: 'mid',
        minSalary: 80000,
        maxSalary: 150000,
        skillWeight: 40,
        interestWeight: 30,
        locationWeight: 20,
        salaryWeight: 10,
      },
    });
    console.log('Created profile:', profile.id);
  } else {
    console.log('Existing profile:', JSON.stringify(profiles[0], null, 2));
  }

  console.log('\n✅ Profile check complete!');
}

main()
  .catch((e) => {
    console.error('Error name:', e.name);
    console.error('Error code:', e.code);
    console.error('Error message start:', JSON.stringify((e.message || '').substring(0, 100)));
    console.error('Error meta:', JSON.stringify(e.meta));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
