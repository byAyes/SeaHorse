import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import { join } from 'path';
import { parseCV } from '@/lib/cv/cvParser';
import {
  extractSkills,
  extractExperience,
  extractEducation,
} from '@/lib/cv/skillExtractor';
import { extractProfileFromText } from '@/lib/ai/pdfProfileExtractor';
import { authenticate } from '@/lib/auth/middleware';

/**
 * POST /api/cv/process
 * Process a CV PDF and extract skills, experience, education
 *
 * Accepts optional provider + apiKey to use a specific AI provider
 * for intelligent profile extraction alongside the local CV parsing.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { cvId, provider, apiKey } = body;

    if (!cvId) {
      return NextResponse.json({ success: false, error: 'cvId is required' }, { status: 400 });
    }

    // Fetch CV record
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return NextResponse.json({ success: false, error: 'CV not found' }, { status: 404 });
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
    } catch {
      // If file not found in public, try alternate path
      const altPath = join(process.cwd(), 'public', 'cvs', cv.userId, cv.fileName);
      fileBuffer = await fs.readFile(altPath);
    }

    // Parse CV to extract sections
    const parsed = await parseCV(fileBuffer);

    // Extract skills from skills section
    const skills = parsed.sections.skills ? extractSkills(parsed.sections.skills) : [];

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
          }),
        ),
        education: educationEntries.map((e) =>
          JSON.stringify({
            degree: e.degree,
            institution: e.institution,
            graduationYear: e.graduationYear,
          }),
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
          // Use AI-extracted skills directly — DO NOT re-filter through extractSkills()
          // which would strip non-technical skills (writing, marketing, sales, etc.)
          const aiSkills = aiResult.profile.skills.filter((s: string) => typeof s === 'string' && s.length > 1);
          profile = {
            skills: aiSkills.length > 0 ? aiSkills : skills,
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
            education: (aiResult.profile.education && aiResult.profile.education.length > 0)
              ? aiResult.profile.education.map((e) => ({
                  degree: e.degree || '',
                  institution: e.institution || '',
                  graduationYear: e.graduationYear || undefined,
                }))
              : educationEntries.map((e) => ({
                  degree: e.degree || '',
                  institution: e.institution || '',
                  graduationYear: e.graduationYear || undefined,
                })),
            remoteOnly: false,
            location:
              aiResult.profile.locations && aiResult.profile.locations.length > 0
                ? aiResult.profile.locations[0]
                : null,
          };
        }
      } catch {
        // AI extraction failed — provide partial profile with CV-parsed data
      }
    }

    // Save to userProfiles store so the Profile page shows data
    // Wrapped in try/catch so a persistence failure doesn't break the upload flow
    try {
      // Determine what skills to save:
      //   AI profile skills > CV-parsed skills > empty
      const skillsToSave =
        profile && (profile.skills as string[])?.length > 0
          ? (profile.skills as string[])
          : skills.length > 0
            ? skills
            : [];

      if (skillsToSave.length > 0 || profile) {
        const existingProfile = await prisma.userProfile.findUnique({
          where: { userId: cv.userId },
        });

        const existingSkills = existingProfile?.skills || [];
        const existingSkillsLower = existingSkills.map((s: string) => s.toLowerCase());
        const addedSkills = skillsToSave.filter(
          (s: string) => !existingSkillsLower.includes(s.toLowerCase()),
        );
        const mergedSkills = [...existingSkills, ...addedSkills];

        const experienceLevel =
          (profile?.experienceLevel as string) || existingProfile?.experienceLevel || null;
        const location =
          (profile?.location as string) || existingProfile?.location || null;

        // Parse and store education — prefer AI-extracted, fallback to keyword parsing
        const profileEducation = profile?.education as
          | Array<{ degree?: string; institution?: string; graduationYear?: string }>
          | undefined;
        const educationToSave = profileEducation && profileEducation.length > 0
          ? profileEducation.map((e) => ({
              degree: e.degree || '',
              institution: e.institution || '',
              graduationYear: e.graduationYear || undefined,
            }))
          : (educationEntries.length > 0
              ? educationEntries.map((e) => ({
                  degree: e.degree || '',
                  institution: e.institution || '',
                  graduationYear: e.graduationYear || undefined,
                }))
              : []);

        await prisma.userProfile.upsert({
          where: { userId: cv.userId },
          update: {
            skills: mergedSkills,
            experienceLevel,
            location,
            summary: (profile?.summary as string) || existingProfile?.summary || null,
            jobTitles: (profile?.jobTitles as string[]) || existingProfile?.jobTitles || [],
            industries: (profile?.industries as string[]) || existingProfile?.industries || [],
            languages: (profile?.languages as Array<{ language: string; level?: string }>) || existingProfile?.languages || [],
            education: educationToSave.length > 0 ? educationToSave : (existingProfile?.education || []),
          },
          create: {
            userId: cv.userId,
            skills: skillsToSave,
            interests: [],
            location,
            remoteOnly: (profile?.remoteOnly as boolean) || false,
            experienceLevel,
            skillWeight: 40,
            interestWeight: 30,
            locationWeight: 20,
            salaryWeight: 10,
            summary: (profile?.summary as string) || null,
            jobTitles: (profile?.jobTitles as string[]) || [],
            industries: (profile?.industries as string[]) || [],
            languages: (profile?.languages as Array<{ language: string; level?: string }>) || [],
            education: educationToSave,
          },
        });
      }
    } catch (saveError) {
      // Profile persistence error is non-fatal — CV processing already succeeded
      console.error('Failed to save profile (non-fatal):', saveError);
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
      { status: 500 },
    );
  }
}
