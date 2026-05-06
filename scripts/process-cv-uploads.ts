/**
 * Process CV Uploads Script
 * Processes pending CV uploads and extracts data
 */

import { prisma } from '../src/lib/prisma';
import { parsePDF } from '../src/lib/pdf/pdfParser';
import { extractJobsFromText } from '../src/lib/pdf/jobExtractor';
import * as fs from 'fs';
import * as path from 'path';

async function processCVUploads() {
  console.log('🔄 Processing CV uploads...');
  
  try {
    // Buscar CVs pendientes de procesar
  const pendingCVs = await prisma.cV.findMany({
    where: {
      status: 'pending'
    },
    include: {
      user: true
    }
  });

    if (pendingCVs.length === 0) {
      console.log('✅ No pending CVs to process');
      return;
    }

    console.log(`📄 Found ${pendingCVs.length} pending CV(s)`);

    for (const cv of pendingCVs) {
      try {
        console.log(`⏳ Processing CV version ${cv.version} for user ${cv.userId}...`);

        // Leer el archivo PDF
        const pdfPath = path.join(process.cwd(), cv.fileUrl);
        if (!fs.existsSync(pdfPath)) {
          console.error(`❌ PDF file not found: ${pdfPath}`);
          continue;
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        
        // Extraer texto del PDF
        const { text, success } = await parsePDF(pdfBuffer);
        if (!success || !text) {
          console.error(`❌ Failed to extract text from CV ${cv.id}`);
          continue;
        }

        console.log(`✅ Extracted ${text.length} characters from CV`);

      // Actualizar CV como procesado
      await prisma.cV.update({
        where: { id: cv.id },
        data: { status: 'processed' }
      });

      console.log(`✅ CV ${cv.id} marked as processed`);
      } catch (error) {
        console.error(`❌ Error processing CV ${cv.id}:`, error);
      }
    }

    console.log('✅ CV processing complete');
  } catch (error) {
    console.error('❌ Error in CV processing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

processCVUploads();
