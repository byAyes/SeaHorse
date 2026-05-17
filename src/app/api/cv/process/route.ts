import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { promises as fs } from 'fs';
import { join } from 'path';
import { parseCV } from '../../../../lib/cv/cvParser';
import { extractSkills, extractExperience, extractEducation } from '../../../../lib/cv/skillExtractor';
import { extractProfileFromText } from '../../../../lib/ai/pdfProfileExtractor';

/**
 * POST /api/cv/process
 * Process a CV PDF and extract skills, experience, education
 *
 * Accepts optional provider + apiKey to use a specific AI provider
 * for intelligent profile extraction alongside the local CV parsing.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cvId, provider, apiKey } = body;

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
    await prisma.cV.update({
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

    // Use AI profile extraction to get a rich profile for the upload preview
    let profile: Record<string, unknown> | null = null;
    if (parsed.rawText && parsed.rawText.length > 50) {
      try {
        const aiResult = await extractProfileFromText(parsed.rawText, {
          aiProvider: provider,
          aiApiKey: apiKey,
        });
        if (aiResult.success && aiResult.profile) {
          profile = {
            skills: aiResult.profile.skills,
            jobTitles: aiResult.profile.jobTitles,
            locations: aiResult.profile.locations,
            experienceLevel: aiResult.profile.experienceLevel,
            industries: aiResult.profile.industries,
            languages: aiResult.profile.languages,
            summary: aiResult.profile.summary,
            salaryRange: aiResult.profile.salaryRange,
            experience: experienceEntries.map((e) => ({
              role: e.jobTitle,
              company: e.company,
              duration: e.duration,
            })),
            education: educationEntries.map((e) => ({
              degree: e.degree,
              institution: e.institution,
              graduationYear: e.graduationYear,
            })),
            remoteOnly: false,
            location: (aiResult.profile.locations && aiResult.profile.locations.length > 0)
              ? aiResult.profile.locations[0]
              : null,
          };
        }
      } catch (err) {
        // AI extraction failed — provide partial profile with CV-parsed data
        console.warn('[CV Process] AI extraction optional, using partial profile:', err instanceof Error ? err.message : String(err));
      }
    }

    // Build response with profile for upload preview
    return NextResponse.json({
      success: true,
      skills,
      experience: experienceEntries.length,
      education: educationEntries.length,
      rawText: parsed.rawText,
      profile,
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
