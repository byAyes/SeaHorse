import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import { join } from 'path';
import { parsePDF } from '@/lib/pdf/pdfParser';
import type { CVUploadResult } from '@/types/cv';

/**
 * POST /api/cv/upload
 * Upload a CV PDF and store with versioning
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'file is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (<10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}-${file.name}`;
    const fileUrl = `/cvs/${userId}/${fileName}`;

    // Create storage directory if it doesn't exist
    const storageDir = join(process.cwd(), 'public', 'cvs', userId);
    await fs.mkdir(storageDir, { recursive: true });

    // Save file
    const filePath = join(storageDir, fileName);
    await fs.writeFile(filePath, fileBuffer);

    // Calculate next version number
    const existingCVs = await prisma.cV.findMany({
      where: { userId },
      select: { version: true },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const nextVersion = existingCVs.length > 0 ? existingCVs[0].version + 1 : 1;

    // Extract raw text from PDF
    let rawText = '';
    try {
      const parseResult = await parsePDF(fileBuffer);
      rawText = parseResult.text;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      // Continue even if text extraction fails
    }

    // Create CV record
    const cvId = `cv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const cv = await prisma.cV.create({
      data: {
        id: cvId,
        userId,
        version: nextVersion,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        rawText,
        status: 'pending',
        skills: [],
        experience: [],
        education: [],
      },
    });

    const result: CVUploadResult = {
      success: true,
      cvId: cv.id,
      version: cv.version,
      fileUrl: cv.fileUrl,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error uploading CV:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload CV' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cv/versions
 * Get all CV versions for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const cvs = await prisma.cV.findMany({
      where: { userId },
      select: {
        version: true,
        uploadedAt: true,
        fileName: true,
        fileSize: true,
        status: true,
        skills: true,
      },
      orderBy: { version: 'desc' },
    });

    const versions = cvs.map((cv) => ({
      version: cv.version,
      uploadedAt: cv.uploadedAt,
      fileName: cv.fileName,
      fileSize: cv.fileSize,
      status: cv.status,
      skillsCount: cv.skills.length,
    }));

    return NextResponse.json({ versions, total: versions.length });
  } catch (error) {
    console.error('Error fetching CV versions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CV versions' },
      { status: 500 }
    );
  }
}
