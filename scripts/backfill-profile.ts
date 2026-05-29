/**
 * Backfill script: extract summary, languages, jobTitles, industries, education
 * from CV records (both aiProfile string and top-level fields) and update the UserProfile.
 *
 * Usage: npx tsx scripts/backfill-profile.ts
 */

import { prisma } from '../src/lib/prisma';

interface EducationEntry {
  degree: string;
  institution: string;
  graduationYear?: string;
}

interface LanguageEntry {
  language: string;
  level?: string;
}

function parseAiProfile(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function parseEducationFromCV(education: string[] | unknown): EducationEntry[] {
  const entries: EducationEntry[] = [];
  if (!Array.isArray(education)) return entries;
  for (const edu of education) {
    if (typeof edu === 'string') {
      try {
        const parsed = JSON.parse(edu);
        if (parsed.degree) {
          entries.push({
            degree: String(parsed.degree || '').trim(),
            institution: String(parsed.institution || '').trim(),
            graduationYear: parsed.graduationYear ? String(parsed.graduationYear).trim() : undefined,
          });
        }
      } catch {
        // Skip malformed entries
      }
    } else if (typeof edu === 'object' && edu !== null) {
      const e = edu as Record<string, unknown>;
      if (e.degree) {
        entries.push({
          degree: String(e.degree || '').trim(),
          institution: String(e.institution || '').trim(),
          graduationYear: e.graduationYear ? String(e.graduationYear).trim() : undefined,
        });
      }
    }
  }
  return entries;
}

async function main() {
  console.log('🔍 Scanning processed CVs for profile data...\n');

  // Get all CVs
  const cvs = await prisma.cV.findMany({
    orderBy: { uploadedAt: 'desc' },
  });

  const processedCVs = cvs.filter((cv) => cv.status === 'processed');
  console.log(`Found ${processedCVs.length} processed CVs out of ${cvs.length} total\n`);

  if (processedCVs.length === 0) {
    console.log('❌ No processed CVs found. Nothing to backfill.');
    return;
  }

  // Collect data from all CVs
  const allEducation: EducationEntry[] = [];
  const allLanguages: LanguageEntry[] = [];
  const allJobTitles: string[] = [];
  const allIndustries: string[] = [];
  let bestSummary: string | null = null;

  for (const cv of processedCVs) {
    // --- Parse aiProfile (stored as JSON string, not in type) ---
    const profile = parseAiProfile((cv as unknown as Record<string, unknown>).aiProfile);

    // Summary from aiProfile
    if (profile?.summary && typeof profile.summary === 'string' && profile.summary.length > 20 && !bestSummary) {
      bestSummary = profile.summary;
    }

    // Job Titles from aiProfile
    if (profile?.jobTitles && Array.isArray(profile.jobTitles)) {
      for (const title of profile.jobTitles) {
        const t = String(title).trim();
        if (t && t.length > 1 && !allJobTitles.includes(t)) {
          allJobTitles.push(t);
        }
      }
    }

    // Industries from aiProfile
    if (profile?.industries && Array.isArray(profile.industries)) {
      for (const ind of profile.industries) {
        const i = String(ind).trim();
        if (i && !allIndustries.includes(i)) {
          allIndustries.push(i);
        }
      }
    }

    // Languages from aiProfile
    if (profile?.languages && Array.isArray(profile.languages)) {
      for (const lang of profile.languages) {
        if (typeof lang === 'string') {
          const l = lang.trim();
          if (l && !allLanguages.some((x) => x.language.toLowerCase() === l.toLowerCase())) {
            allLanguages.push({ language: l });
          }
        } else if (typeof lang === 'object' && lang !== null) {
          const l = lang as Record<string, unknown>;
          const name = String(l.language || l.name || '').trim();
          if (name && !allLanguages.some((x) => x.language.toLowerCase() === name.toLowerCase())) {
            allLanguages.push({ language: name, level: String(l.level || '') || undefined });
          }
        }
      }
    }

    // Education from cv.education (top-level field)
    const educationEntries = parseEducationFromCV(cv.education);
    for (const edu of educationEntries) {
      const isDuplicate = allEducation.some(
        (e) =>
          e.degree.toLowerCase() === edu.degree.toLowerCase() &&
          e.institution.toLowerCase() === edu.institution.toLowerCase(),
      );
      if (!isDuplicate) {
        allEducation.push(edu);
      }
    }
  }

  console.log('📊 Extracted data:');
  console.log(`   Summary: ${bestSummary ? bestSummary.slice(0, 80) + '...' : '❌ Not found'}`);
  console.log(`   Languages: ${allLanguages.length > 0 ? allLanguages.map((l) => `${l.language}${l.level ? ` (${l.level})` : ''}`).join(', ') : '❌ Not found'}`);
  console.log(`   Job Titles: ${allJobTitles.length > 0 ? allJobTitles.join(', ') : '❌ Not found'}`);
  console.log(`   Industries: ${allIndustries.length > 0 ? allIndustries.join(', ') : '❌ Not found'}`);
  console.log(`   Education: ${allEducation.length > 0 ? allEducation.map((e) => `${e.degree} @ ${e.institution}`).join(' | ') : '❌ Not found'}`);
  console.log('');

  // Update UserProfile
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId: 'default-user' },
  });

  if (!userProfile) {
    console.log('❌ No UserProfile found for default-user');
    return;
  }

  const updates: Record<string, unknown> = {};

  if (bestSummary && !userProfile.summary) {
    updates.summary = bestSummary;
  }
  if (allLanguages.length > 0 && (!userProfile.languages || userProfile.languages.length === 0)) {
    updates.languages = allLanguages;
  }
  if (allJobTitles.length > 0 && (!userProfile.jobTitles || userProfile.jobTitles.length === 0)) {
    updates.jobTitles = allJobTitles;
  }
  if (allIndustries.length > 0 && (!userProfile.industries || userProfile.industries.length === 0)) {
    updates.industries = allIndustries;
  }
  if (allEducation.length > 0 && (!userProfile.education || userProfile.education.length === 0)) {
    updates.education = allEducation;
  }

  if (Object.keys(updates).length === 0) {
    console.log('✅ UserProfile already has all the data. Nothing to backfill.');
    return;
  }

  console.log('🔄 Updating UserProfile with:');
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'summary') {
      console.log(`   ${key}: ${(value as string).slice(0, 80)}...`);
    } else if (Array.isArray(value)) {
      console.log(`   ${key}: ${value.length} entries`);
    }
  }
  console.log('');

  await prisma.userProfile.update({
    where: { userId: 'default-user' },
    data: updates as Partial<typeof userProfile>,
  });

  const updated = await prisma.userProfile.findUnique({
    where: { userId: 'default-user' },
  });

  console.log('✅ ✅ ✅ Backfill complete!');
  console.log('📋 Updated UserProfile:');
  console.log(`   summary: ${updated?.summary ? '✅ ' + updated.summary.slice(0, 60) + '...' : '❌'}`);
  console.log(`   languages: ${updated?.languages?.length ? `✅ ${updated.languages.length} entries` : '❌'}`);
  console.log(`   jobTitles: ${updated?.jobTitles?.length ? `✅ ${updated.jobTitles.length} entries` : '❌'}`);
  console.log(`   industries: ${updated?.industries?.length ? `✅ ${updated.industries.length} entries` : '❌'}`);
  console.log(`   education: ${updated?.education?.length ? `✅ ${updated.education.length} entries` : '❌'}`);
}

main().catch(console.error);
