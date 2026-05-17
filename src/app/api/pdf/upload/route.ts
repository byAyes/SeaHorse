/**
 * PDF Upload API Endpoint
 * Handles multipart/form-data or binary PDF uploads
 * Extracts jobs from PDF, checks for duplicates, and saves non-duplicates
 */

import { NextRequest, NextResponse } from 'next/server';
import { parsePDF } from '@/lib/pdf/pdfParser';
import { extractJobsFromText } from '@/lib/pdf/jobExtractor';
import { isDuplicate } from '@/lib/pdf/duplicateDetector';
import { prisma } from '@/lib/prisma';
import { ExtractedJob } from '@/types/pdf';
import { authenticate } from '@/lib/auth/middleware';

/**
 * POST handler for PDF upload
 * Accepts PDF file, extracts jobs, checks duplicates, saves non-duplicates
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Get the request body as buffer
    const contentType = request.headers.get('content-type') || '';
    let pdfBuffer: Buffer;
    
    // Handle different content types
    if (contentType.includes('multipart/form-data')) {
      // Parse multipart form data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No PDF file provided' },
          { status: 400 }
        );
      }
      
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes('application/octet-stream') || contentType.includes('application/pdf')) {
      // Binary PDF upload
      const arrayBuffer = await request.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid content type. Expected multipart/form-data or application/pdf' },
        { status: 400 }
      );
    }
    
    // Parse PDF to extract text
    const parseResult = await parsePDF(pdfBuffer);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error || 'Failed to parse PDF' },
        { status: 400 }
      );
    }
    
    // Extract jobs from text
    const extractedJobs = await extractJobsFromText(parseResult.text);
    
    if (extractedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        jobsAdded: 0,
        duplicates: 0,
        message: 'No jobs found in PDF'
      });
    }
    
    // Process each extracted job
    let jobsAdded = 0;
    let duplicates = 0;
    
    for (const job of extractedJobs) {
      // Check for duplicates
      const duplicate = await isDuplicate(job);
      
      if (duplicate) {
        duplicates++;
        continue;
      }
      
      // Save non-duplicate job to database
      await saveJob(job);
      jobsAdded++;
    }
    
    return NextResponse.json({
      success: true,
      jobsAdded,
      duplicates,
      total: extractedJobs.length
    });
    
  } catch (error) {
    console.error('Error processing PDF upload:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Convert ExtractedJob to Prisma Job format and save to database
 */
async function saveJob(job: ExtractedJob): Promise<void> {
  try {
    await prisma.job.create({
      data: {
        title: job.title,
        company: job.company,
        location: job.location || null,
        description: job.description || null,
        url: job.url || '',
        skills: job.requirements || [],
        scrapedAt: new Date()
      }
    });
  } catch (error) {
    // If URL uniqueness constraint fails, it's a duplicate
    if (error instanceof Error && error.name === 'PrismaClientKnownRequestError') {
      throw error;
    }
    throw error;
  }
}
