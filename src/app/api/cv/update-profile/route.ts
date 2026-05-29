import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { UserProfile } from '@/lib/prisma';
import {
  calculateYearsOfExperience,
  inferExperienceLevel,
} from '@/lib/cv/skillExtractor';
import { trackProfileChange } from '@/lib/cv/profileHistory';
import { authenticate } from '@/lib/auth/middleware';

/**
 * POST /api/cv/update-profile
 * Update UserProfile with extracted CV data
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { userId, cvId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 },
      );
    }

    // ── Direct profile update (from settings page) ────────────────────────
    if (!cvId) {
      // User is manually editing profile fields — no CV involved
      const updateData: Record<string, unknown> = {};
      if (body.skills !== undefined) updateData.skills = body.skills;
      if (body.location !== undefined) updateData.location = body.location;
      if (body.remoteOnly !== undefined) updateData.remoteOnly = body.remoteOnly;
      if (body.minSalary !== undefined) updateData.minSalary = body.minSalary;
      if (body.maxSalary !== undefined) updateData.maxSalary = body.maxSalary;
      if (body.experienceLevel !== undefined) updateData.experienceLevel = body.experienceLevel;
      if (body.interests !== undefined) updateData.interests = body.interests;
      if (body.summary !== undefined) updateData.summary = body.summary;
      if (body.languages !== undefined) updateData.languages = body.languages;
      if (body.jobTitles !== undefined) updateData.jobTitles = body.jobTitles;
      if (body.industries !== undefined) updateData.industries = body.industries;
      if (body.education !== undefined) updateData.education = body.education;

      const profile = await prisma.userProfile.upsert({
        where: { userId },
        update: updateData as Partial<UserProfile>,
        create: {
          userId,
          skills: body.skills || [],
          interests: body.interests || [],
          location: body.location || null,
          remoteOnly: body.remoteOnly ?? false,
          minSalary: body.minSalary ?? null,
          maxSalary: body.maxSalary ?? null,
          experienceLevel: body.experienceLevel || null,
          summary: body.summary || null,
          languages: body.languages || [],
          jobTitles: body.jobTitles || [],
          industries: body.industries || [],
          education: body.education || [],
          skillWeight: 40,
          interestWeight: 30,
          locationWeight: 20,
          salaryWeight: 10,
        },
      });

      return NextResponse.json({
        success: true,
        updatedFields: Object.keys(updateData),
        profile: {
          skills: profile.skills,
          location: profile.location,
          remoteOnly: profile.remoteOnly,
          minSalary: profile.minSalary,
          maxSalary: profile.maxSalary,
          experienceLevel: profile.experienceLevel,
        },
      });
    }

    // ── CV-based profile update (from CV upload) ──────────────────────────
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return NextResponse.json({ success: false, error: 'CV not found' }, { status: 404 });
    }

    if (cv.status !== 'processed') {
      return NextResponse.json(
        { success: false, error: 'CV must be processed before updating profile' },
        { status: 400 },
      );
    }

    // Fetch current UserProfile
    let profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    const updatedFields: string[] = [];

    // Merge skills: combine existing with new, remove duplicates
    if (cv.skills.length > 0) {
      const existingSkills = profile?.skills || [];
      // Case-insensitive deduplication
      const existingSkillsLower = existingSkills.map((s) => s.toLowerCase());
      const newSkills = cv.skills.filter(
        (skill) => !existingSkillsLower.includes(skill.toLowerCase()),
      );
      const mergedSkills = [...existingSkills, ...newSkills];

      if (mergedSkills.length !== existingSkills.length) {
        updatedFields.push('skills');
      }

      // Store in profile
      profile = await prisma.userProfile.upsert({
        where: { userId },
        update: { skills: mergedSkills },
        create: {
          userId,
          skills: mergedSkills,
          interests: [],
          remoteOnly: false,
          skillWeight: 0.4,
          interestWeight: 0.3,
          locationWeight: 0.2,
          salaryWeight: 0.1,
        },
      });
    } else {
      // Just fetch or create profile
      profile = await prisma.userProfile.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          skills: [],
          interests: [],
          remoteOnly: false,
          skillWeight: 0.4,
          interestWeight: 0.3,
          locationWeight: 0.2,
          salaryWeight: 0.1,
        },
      });
    }

    // Parse experience entries and calculate years
    const experienceEntries = cv.experience
      .map((exp) => {
        try {
          return JSON.parse(exp);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const yearsOfExperience = calculateYearsOfExperience(experienceEntries);
    const experienceLevel = inferExperienceLevel(yearsOfExperience);

    // Update experience level if different
    if (profile.experienceLevel !== experienceLevel) {
      updatedFields.push('experienceLevel');
      profile = await prisma.userProfile.update({
        where: { userId },
        data: { experienceLevel },
      });

      // Track experience level change
      await trackProfileChange({
        userId,
        changeType: 'experience_level_updated',
        previousValue: profile.experienceLevel,
        newValue: experienceLevel,
        source: 'cv_upload',
        cvId,
      });
    }

    // Track skills change
    if (cv.skills.length > 0 && updatedFields.includes('skills')) {
      await trackProfileChange({
        userId,
        changeType: 'skills_added',
        previousValue: profile.skills,
        newValue: cv.skills,
        source: 'cv_upload',
        cvId,
      });
    }

    // Extract location from most recent experience if available
    // (This would require more sophisticated parsing - simplified for now)

    return NextResponse.json({
      success: true,
      updatedFields,
      profile: {
        skills: profile.skills,
        experienceLevel: profile.experienceLevel,
        location: profile.location,
      },
      skillsAdded: cv.skills.length,
      experienceYears: yearsOfExperience,
    });
  } catch (error) {
    console.error('Error updating profile from CV:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update profile',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
