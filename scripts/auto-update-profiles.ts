/**
 * Auto-Update Profiles Script
 * Updates user profiles based on extracted CV data
 */

import { prisma } from '../src/lib/prisma';
import { parseCV } from '../src/lib/cv/cvParser';
import { extractSkills } from '../src/lib/cv/skillExtractor';
import { trackProfileChange } from '../src/lib/cv/profileHistory';
import * as fs from 'fs';
import * as path from 'path';

async function autoUpdateProfiles() {
  console.log('🔄 Auto-updating profiles from CVs...');
  
  try {
  // Buscar CVs procesados pero no aplicados al perfil
  const processedCVs = await prisma.cV.findMany({
    where: {
      status: 'processed'
    },
    include: {
      user: true
    },
    orderBy: {
      uploadedAt: 'asc'
    }
  });

    if (processedCVs.length === 0) {
      console.log('✅ No CVs to apply to profiles');
      return;
    }

    console.log(`📄 Found ${processedCVs.length} CV(s) to apply`);

    for (const cv of processedCVs) {
      try {
        console.log(`⏳ Applying CV version ${cv.version} for user ${cv.userId}...`);

        // Leer el archivo PDF
        const pdfPath = path.join(process.cwd(), cv.fileUrl);
        if (!fs.existsSync(pdfPath)) {
          console.error(`❌ PDF file not found: ${pdfPath}`);
          continue;
        }

        const pdfBuffer = fs.readFileSync(pdfPath);
        
        // Parsear CV
        const cvData = await parseCV(pdfBuffer);
        
        if (!cvData) {
          console.error(`❌ Failed to parse CV ${cv.id}`);
          continue;
        }

        // Extraer skills
        const skills = extractSkills(cvData.text || '');
        
        // Actualizar perfil del usuario
        const updateData: any = {};
        
        // Agregar skills (sin duplicados)
        if (skills.length > 0 && cv.user.skills) {
          const existingSkills = cv.user.skills || [];
          const newSkills = skills.filter(
            skill => !existingSkills.some(
              existing => existing.toLowerCase() === skill.toLowerCase()
            )
          );
          
          if (newSkills.length > 0) {
            updateData.skills = [...existingSkills, ...newSkills];
            console.log(`✅ Added ${newSkills.length} new skills: ${newSkills.join(', ')}`);
            
            // Track change
            await trackProfileChange(
              cv.userId,
              'skills',
              existingSkills,
              updateData.skills,
              'cv_upload',
              cv.id
            );
          }
        }

        // Inferir experiencia
        if (cvData.experience && cvData.experience.length > 0) {
          const yearsOfExperience = calculateYearsOfExperience(cvData.experience);
          if (yearsOfExperience > 0) {
            updateData.experienceLevel = inferExperienceLevel(yearsOfExperience);
            console.log(`✅ Inferred experience level: ${updateData.experienceLevel}`);
            
            await trackProfileChange(
              cv.userId,
              'experienceLevel',
              cv.user.experienceLevel,
              updateData.experienceLevel,
              'cv_upload',
              cv.id
            );
          }
        }

        // Actualizar intereses si se extrajo información relevante
        if (cvData.skills && cvData.skills.length > 0 && !updateData.interests) {
          // Usar skills como intereses si no hay intereses
          updateData.interests = cvData.skills.slice(0, 5);
          console.log(`✅ Updated interests from CV skills`);
        }

        // Aplicar actualizaciones
        if (Object.keys(updateData).length > 0) {
          await prisma.userProfile.update({
            where: { id: cv.userId },
            data: updateData
          });
          
        // Marcar CV como aplicado al perfil
        await prisma.cV.update({
          where: { id: cv.id },
          data: { status: 'applied' }
        });
          
          console.log(`✅ Profile updated for user ${cv.userId}`);
        } else {
          console.log(`ℹ️ No changes needed for user ${cv.userId}`);
        }
      } catch (error) {
        console.error(`❌ Error updating profile for CV ${cv.id}:`, error);
      }
    }

    console.log('✅ Profile auto-update complete');
  } catch (error) {
    console.error('❌ Error in profile auto-update:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function calculateYearsOfExperience(experiences: any[]): number {
  let totalYears = 0;
  
  experiences.forEach(exp => {
    const duration = exp.duration || '';
    const match = duration.match(/(\d+)\s*(year|año)/i);
    if (match) {
      totalYears += parseInt(match[1]);
    }
  });
  
  return totalYears;
}

function inferExperienceLevel(years: number): string {
  if (years < 2) return 'Entry';
  if (years < 5) return 'Mid';
  if (years < 10) return 'Senior';
  return 'Lead';
}

autoUpdateProfiles();
