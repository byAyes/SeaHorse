import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { promises as fs } from 'fs';
import { join } from 'path';
import { parseCV } from '../../../../lib/cv/cvParser';
import { extractSkills, extractExperience, extractEducation } from '../../../../lib/cv/skillExtractor';

/**
 * POST /api/cv/process
 * Process a CV PDF and extract skills, experience, education
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId } = body;

    if (!cvId) {
      return NextResponse.json(
        { success: false, error: 'cvId is required' },
        { status: 400 }
      );
    }

    // Fetch CV record
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    if (cv.status === 'processed') {
      return NextResponse.json({
        success: true,
        message: 'CV already processed',
        skills: cv.skills,
        experience: cv.experience,
        education: cv.education,
      });
    }

    // Read PDF file
    const filePath = join(process.cwd(), 'public', cv.fileUrl.replace(/^\//, ''));
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (error) {
      // If file not found in public, try alternate path
      const altPath = join(process.cwd(), 'public', 'cvs', cv.userId, cv.fileName);
      fileBuffer = await fs.readFile(altPath);
    }

    // Parse CV to extract sections
    const parsed = await parseCV(fileBuffer);

    // Extract skills from skills section
    const skills = parsed.sections.skills
      ? extractSkills(parsed.sections.skills)
      : [];

    // Extract experience from experience section
    const experienceEntries = parsed.sections.experience
      ? extractExperience(parsed.sections.experience)
      : [];

    // Extract education from education section
    const educationEntries = parsed.sections.education
      ? extractEducation(parsed.sections.education)
      : [];

    // Update CV record with extracted data
    const updatedCV = await prisma.cV.update({
      where: { id: cvId },
      data: {
        skills,
        experience: experienceEntries.map((e) =>
          JSON.stringify({
            jobTitle: e.jobTitle,
            company: e.company,
            duration: e.duration,
            description: e.description,
          })
        ),
        education: educationEntries.map((e) =>
          JSON.stringify({
            degree: e.degree,
            institution: e.institution,
            graduationYear: e.graduationYear,
          })
        ),
        status: 'processed',
      },
    });

    return NextResponse.json({
      success: true,
      skills,
      experience: experienceEntries.length,
      education: educationEntries.length,
      rawText: parsed.rawText,
    });
  } catch (error) {
    console.error('Error processing CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process CV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
