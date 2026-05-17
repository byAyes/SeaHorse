/**
 * API route for PDF CV profile extraction
 * POST /api/profile/extract
 *
 * Accepts a PDF file and returns structured profile data extracted via AI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractProfileFromPDF, extractProfileFromText } from '@/lib/ai';

/**
 * GET /api/profile/extract?userId=xxx
 * Returns the user profile for the dashboard settings page.
 * In mock mode, returns default empty profile data.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default-user';

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
      createdAt: new Date().toISOString(),
      weightings: {
        skills: 0.4,
        interests: 0.3,
        location: 0.2,
        salary: 0.1,
      },
    });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // ── Multipart form upload (PDF file) ─────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        );
      }

      // Validate file type
      if (!file.type || (!file.type.includes('pdf') && !file.type.includes('octet-stream'))) {
        return NextResponse.json(
          { success: false, error: 'Only PDF files are accepted' },
          { status: 400 }
        );
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { success: false, error: 'File exceeds 10MB limit' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await extractProfileFromPDF(buffer);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to extract profile' },
          { status: 422 }
        );
      }

      return NextResponse.json(result, { status: 200 });
    }

    // ── JSON body with raw text ──────────────────────────────────────────
    if (contentType.includes('application/json')) {
      const body = await request.json() as { text?: string };
      const text = body?.text;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'No text provided in request body' },
          { status: 400 }
        );
      }

      const result = await extractProfileFromText(text);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to extract profile' },
          { status: 422 }
        );
      }

      return NextResponse.json(result, { status: 200 });
    }

    // ── Binary PDF upload ────────────────────────────────────────────────
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      const buffer = Buffer.from(await request.arrayBuffer());

      if (buffer.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Empty file' },
          { status: 400 }
        );
      }

      const result = await extractProfileFromPDF(buffer);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to extract profile' },
          { status: 422 }
        );
      }

      return NextResponse.json(result, { status: 200 });
    }

    // ── Unsupported content type ─────────────────────────────────────────
    return NextResponse.json(
      {
        success: false,
        error: 'Unsupported content type. Use multipart/form-data with a PDF file, application/json with text field, or application/pdf binary.',
      },
      { status: 415 }
    );
  } catch (error) {
    console.error('Profile extraction error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during profile extraction' },
      { status: 500 }
    );
  }
}
