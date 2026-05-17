import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scoreAndSortJobs } from '@/matching/scorer';
import { Job } from '@/types/job';
import { UserProfile } from '@/types/user-profile';

/**
 * GET handler for matching jobs
 * Query params:
 * - userId: string (required) - User ID to get profile for
 * - threshold: number (optional, default 70) - Minimum match score
 * - limit: number (optional, default 100) - Maximum results to return
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const threshold = parseInt(searchParams.get('threshold') || '70');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Validate required params
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Fetch user profile
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Fetch jobs (only recent ones from last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const jobs = await prisma.job.findMany({
      where: {
        scrapedAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    // Convert Prisma jobs to Job type
    const jobList: Job[] = jobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      url: job.url,
      salary: job.salary ? Number(job.salary) : null,
      postedAt: job.postedAt,
      scrapedAt: job.scrapedAt,
      skills: job.skills,
      category: job.category
    }));

    // Convert Prisma user profile to UserProfile type
    const profile: UserProfile = {
      id: userProfile.id,
      userId: userProfile.userId,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
      skills: userProfile.skills,
      interests: userProfile.interests,
      location: userProfile.location,
      remoteOnly: userProfile.remoteOnly,
      experienceLevel: userProfile.experienceLevel as any,
      minSalary: userProfile.minSalary,
      maxSalary: userProfile.maxSalary,
      skillWeight: userProfile.skillWeight,
      interestWeight: userProfile.interestWeight,
      locationWeight: userProfile.locationWeight,
      salaryWeight: userProfile.salaryWeight
    };

    // Score and sort jobs
    const matchedJobs = scoreAndSortJobs(jobList, profile, threshold);

    // Limit results
    const limitedMatches = matchedJobs.slice(0, limit);

    return NextResponse.json({
      matches: limitedMatches,
      total: limitedMatches.length,
      threshold,
      userId
    });

  } catch (error) {
    console.error('Error matching jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
