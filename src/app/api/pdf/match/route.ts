/**
 * PDF Job Matching API Endpoint
 * Handles matching PDF-extracted jobs against user profiles
 * Supports both GET (retrieve matches) and POST (upload + match)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { scoreAndSortJobs } from '../../../../matching/scorer';
import { Job } from '../../../../types/job';
import { UserProfile, ExperienceLevel } from '../../../../types/user-profile';
import { MatchedJob } from '../../../../types/job-match';
import { ExtractedJob } from '../../../../types/pdf';
import { authenticate } from '../../../../lib/auth/middleware';
import { matchPDFJobs, savePDFMatches } from '../../../../lib/pdf/pdfIntegration';
import { parsePDF } from '../../../../lib/pdf/pdfParser';
import { extractJobsFromText } from '../../../../lib/pdf/jobExtractor';

/**
 * GET handler for matching PDF jobs
 * Query params:
 * - userId: string (required) - User ID to get profile for
 * - threshold: number (optional, default 70) - Minimum match score
 * - limit: number (optional, default 100) - Maximum results to return
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const threshold = parseInt(searchParams.get('threshold') || '70');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Validate required params
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Fetch user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Fetch PDF-sourced jobs from database
    // Filter by jobs that have PDF marker in description
    const pdfJobsRaw = await prisma.job.findMany({
      where: {
        description: {
          contains: 'PDF-extracted',
        },
      },
      orderBy: {
        scrapedAt: 'desc',
      },
      take: limit,
    });

    // Convert Prisma jobs to Job type
    const pdfJobs: Job[] = pdfJobsRaw.map((job: Record<string, unknown>) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      url: job.url,
      salary: job.salary,
      postedAt: job.postedAt,
      scrapedAt: job.scrapedAt,
      skills: job.skills,
      category: job.category,
    }));

    // Convert user profile to UserProfile type
    const profile: UserProfile = {
      id: userProfile.id,
      userId: userProfile.userId,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
      skills: userProfile.skills,
      interests: userProfile.interests,
      location: userProfile.location,
      remoteOnly: userProfile.remoteOnly,
      experienceLevel: userProfile.experienceLevel as ExperienceLevel | null,
      minSalary: userProfile.minSalary,
      maxSalary: userProfile.maxSalary,
      skillWeight: userProfile.skillWeight,
      interestWeight: userProfile.interestWeight,
      locationWeight: userProfile.locationWeight,
      salaryWeight: userProfile.salaryWeight,
    };

    // Score and sort PDF jobs
    const matchedJobs = scoreAndSortJobs(pdfJobs, profile, threshold);

    // Limit results
    const limitedMatches = matchedJobs.slice(0, limit);

    return NextResponse.json({
      matches: limitedMatches,
      total: limitedMatches.length,
      threshold,
      userId,
      source: 'pdf',
    });
  } catch (error) {
    console.error('Error matching PDF jobs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST handler for on-demand PDF upload and matching
 * Accepts PDF file upload, extracts jobs, scores them, returns matches
 * Does not save to database unless explicitly requested
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Parse request body
    const formData = await request.formData();
    const pdfFile = formData.get('pdf') as File | null;
    const userId = formData.get('userId')?.toString();
    const thresholdParam = formData.get('threshold')?.toString() || '70';
    const threshold = parseInt(thresholdParam);
    const saveToDb = formData.get('saveToDb')?.toString() === 'true';

    // Validate required fields
    if (!pdfFile) {
      // Check if it's a JSON body instead
      const jsonBody = await request.json().catch(() => null);
      if (!jsonBody || !jsonBody.pdfText || !userId) {
        return NextResponse.json(
          { error: 'PDF file or pdfText and userId are required' },
          { status: 400 },
        );
      }

      // Process text directly (async)
      const extractedJobs = await extractJobsFromText(jsonBody.pdfText);
      return await processExtractedJobs(extractedJobs, userId, threshold, saveToDb);
    }

    // Validate userId
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Read PDF file
    const pdfBytes = await pdfFile.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfBytes);

    // Parse PDF to extract text
    const { text, pageCount } = await parsePDF(pdfBuffer);

    // Extract jobs from text (async)
    const extractedJobs = await extractJobsFromText(text);

    if (extractedJobs.length === 0) {
      return NextResponse.json({ error: 'No jobs found in PDF', pageCount }, { status: 404 });
    }

    return await processExtractedJobs(extractedJobs, userId, threshold, saveToDb);
  } catch (error) {
    console.error('Error processing PDF upload:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Process extracted jobs: score, optionally save, and return results
 */
async function processExtractedJobs(
  extractedJobs: ExtractedJob[],
  userId: string,
  threshold: number,
  saveToDb: boolean,
): Promise<
  NextResponse<{
    matches?: MatchedJob[];
    total?: number;
    threshold?: number;
    userId?: string;
    extracted?: number;
    error?: string;
  }>
> {
  // Match jobs against user profile
  const matchedJobs = await matchPDFJobs(extractedJobs, userId, threshold);

  // Optionally save to database
  if (saveToDb && matchedJobs.length > 0) {
    await savePDFMatches(matchedJobs, userId);
  }

  return NextResponse.json({
    matches: matchedJobs,
    total: matchedJobs.length,
    threshold,
    userId,
    extracted: extractedJobs.length,
  });
}
