/**
 * API route for PDF CV profile extraction
 * GET  /api/profile/extract?userId=xxx  — returns stored user profile
 * POST /api/profile/extract              — accepts PDF/text, extracts profile via AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractProfileFromPDF, extractProfileFromText } from '@/lib/ai';
import { authenticate } from '@/lib/auth/middleware';

/**
 * GET /api/profile/extract?userId=xxx
 * Returns the stored user profile from the local data store.
 * Previously returned hardcoded empty data — now queries the actual store.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

    // Query the actual local store (`.data/userProfiles.json`)
    const stored = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (stored) {
      return NextResponse.json({
        id: stored.id,
        userId: stored.userId,
        skills: stored.skills || [],
        interests: stored.interests || [],
        location: stored.location || null,
        remoteOnly: stored.remoteOnly ?? false,
        minSalary: stored.minSalary ?? null,
        maxSalary: stored.maxSalary ?? null,
        experienceLevel: stored.experienceLevel || null,
        skillWeight: stored.skillWeight ?? 40,
        interestWeight: stored.interestWeight ?? 30,
        locationWeight: stored.locationWeight ?? 20,
        salaryWeight: stored.salaryWeight ?? 10,
        summary: stored.summary || null,
        languages: stored.languages || [],
        jobTitles: stored.jobTitles || [],
        industries: stored.industries || [],
        education: stored.education || [],
        createdAt: stored.createdAt.toISOString(),
        updatedAt: stored.updatedAt.toISOString(),
      });
    }

    // No profile stored yet — return empty defaults
    return NextResponse.json({
      id: userId,
      userId,
      skills: [],
      interests: [],
      location: null,
      remoteOnly: false,
      minSalary: null,
      maxSalary: null,
      experienceLevel: null,
      skillWeight: 40,
      interestWeight: 30,
      locationWeight: 20,
      salaryWeight: 10,
      summary: null,
      languages: [],
      jobTitles: [],
      industries: [],
      education: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const contentType = request.headers.get('content-type') || '';

    // ── Multipart form upload (PDF file) ─────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
      }

      // Validate file type
      if (!file.type || (!file.type.includes('pdf') && !file.type.includes('octet-stream'))) {
        return NextResponse.json(
          { success: false, error: 'Only PDF files are accepted' },
          { status: 400 },
        );
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { success: false, error: 'File exceeds 10MB limit' },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await extractProfileFromPDF(buffer);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to extract profile' },
          { status: 422 },
        );
      }

      return NextResponse.json(result, { status: 200 });
    }

    // ── JSON body with raw text ──────────────────────────────────────────
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { text?: string };
      const text = body?.text;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'No text provided in request body' },
          { status: 400 },
        );
      }

      const result = await extractProfileFromText(text);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to extract profile' },
          { status: 422 },
        );
      }

      return NextResponse.json(result, { status: 200 });
    }

    // ── Binary PDF upload ────────────────────────────────────────────────
    if (
      contentType.includes('application/pdf') ||
      contentType.includes('application/octet-stream')
    ) {
      const buffer = Buffer.from(await request.arrayBuffer());

      if (buffer.length === 0) {
        return NextResponse.json({ success: false, error: 'Empty file' }, { status: 400 });
      }

      const result = await extractProfileFromPDF(buffer);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to extract profile' },
          { status: 422 },
        );
      }

      return NextResponse.json(result, { status: 200 });
    }

    // ── Unsupported content type ─────────────────────────────────────────
    return NextResponse.json(
      {
        success: false,
        error:
          'Unsupported content type. Use multipart/form-data with a PDF file, application/json with text field, or application/pdf binary.',
      },
      { status: 415 },
    );
  } catch (error) {
    console.error('Profile extraction error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during profile extraction' },
      { status: 500 },
    );
  }
}
