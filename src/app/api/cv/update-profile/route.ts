import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { calculateYearsOfExperience, inferExperienceLevel } from '../../../../lib/cv/skillExtractor';
import { trackProfileChange } from '../../../../lib/cv/profileHistory';
import { authenticate } from '../../../../lib/auth/middleware';

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

    if (!userId || !cvId) {
      return NextResponse.json(
        { success: false, error: 'userId and cvId are required' },
        { status: 400 }
      );
    }

    // Fetch processed CV data
    const cv = await prisma.cV.findUnique({
      where: { id: cvId },
    });

    if (!cv) {
      return NextResponse.json(
        { success: false, error: 'CV not found' },
        { status: 404 }
      );
    }

    if (cv.status !== 'processed') {
      return NextResponse.json(
        { success: false, error: 'CV must be processed before updating profile' },
        { status: 400 }
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
        (skill) => !existingSkillsLower.includes(skill.toLowerCase())
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
    const experienceEntries = cv.experience.map((exp) => {
      try {
        return JSON.parse(exp);
      } catch {
        return null;
      }
    }).filter(Boolean);

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
      { status: 500 }
    );
  }
}
