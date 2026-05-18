/**
 * Cleanup Old CVs Script
 * Removes old CV versions, keeping only the latest N versions
 */

import { prisma } from '../src/lib/prisma';

async function cleanupOldCVs(keepVersions = 3) {
  console.log(`🧹 Cleaning up old CVs (keeping latest ${keepVersions})...`);

  try {
    // Obtener todos los usuarios
    const users = await prisma.userProfile.findMany();

    for (const user of users) {
      const cvs = await prisma.cV.findMany({
        where: { userId: user.userId },
        orderBy: { version: 'desc' },
      });

      if (cvs.length > keepVersions) {
        const toDelete = cvs.slice(keepVersions);

        for (const cv of toDelete) {
          console.log(`🗑️ Deleting old CV version ${cv.version} for user ${user.userId}`);
          await prisma.cV.delete({
            where: { id: cv.id },
          });
        }

        console.log(`✅ Deleted ${toDelete.length} old CVs for user ${user.userId}`);
      }
    }

    console.log('✅ CV cleanup complete');
  } catch (error) {
    console.error('❌ Error in CV cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOldCVs();
