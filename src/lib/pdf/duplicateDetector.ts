/**
 * Duplicate Detection Module
 * Prevents the same job from being added multiple times from different sources
 */

import { prisma } from '../prisma';
import { ExtractedJob } from '../../types/pdf';

/**
 * Normalize text for comparison
 * - Convert to lowercase
 * - Remove special characters
 * - Remove extra whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity score between two strings
 * Uses simple word overlap ratio
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeText(str1);
  const normalized2 = normalizeText(str2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) {
    return 1.0;
  }
  
  const words1 = new Set(normalized1.split(' '));
  const words2 = new Set(normalized2.split(' '));
  
  // Calculate intersection
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  
  // Calculate union
  const union = new Set([...words1, ...words2]);
  
  // Jaccard similarity coefficient
  return intersection.size / union.size;
}

/**
 * Check if a job is a duplicate based on multiple strategies
 * @param job - The extracted job to check
 * @returns Promise resolving to true if duplicate exists, false otherwise
 */
export async function isDuplicate(job: ExtractedJob): Promise<boolean> {
  try {
    // Strategy 1: URL exact match
    if (job.url) {
      const existingByUrl = await prisma.job.findFirst({
        where: {
          url: job.url
        }
      });
      
      if (existingByUrl) {
        return true;
      }
    }
    
    // Strategy 2: Title + Company similarity
    // Check if a job with similar title and company already exists
    const similarJobs = await prisma.job.findMany({
      where: {
        // Get jobs with similar company name
        company: {
          contains: normalizeText(job.company).split(' ')[0] || '',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        title: true,
        company: true
      }
    });
    
    // Check each candidate for title similarity
    for (const existingJob of similarJobs) {
      const titleSimilarity = calculateSimilarity(job.title, existingJob.title);
      const companySimilarity = calculateSimilarity(job.company, existingJob.company);
      
      // High threshold for title match (0.8) with decent company match (0.5)
      if (titleSimilarity >= 0.8 && companySimilarity >= 0.5) {
        return true;
      }
      
      // Very high company match (0.9) with good title match (0.6)
      if (titleSimilarity >= 0.6 && companySimilarity >= 0.9) {
        return true;
      }
    }
    
    // Strategy 3: Check for exact title + company combination
    const normalizedTitle = normalizeText(job.title);
    const normalizedCompany = normalizeText(job.company);
    
    const exactMatch = await prisma.job.findFirst({
      where: {
        AND: [
          {
            title: {
              contains: normalizedTitle.split(' ').slice(0, 3).join(' '),
              mode: 'insensitive'
            }
          },
          {
            company: {
              contains: normalizedCompany.split(' ')[0] || '',
              mode: 'insensitive'
            }
          }
        ]
      }
    });
    
    if (exactMatch) {
      // Double-check with similarity to avoid false positives
      const titleSim = calculateSimilarity(job.title, exactMatch.title);
      const companySim = calculateSimilarity(job.company, exactMatch.company);
      
      if (titleSim >= 0.7 && companySim >= 0.7) {
        return true;
      }
    }
    
    // No duplicates found
    return false;
  } catch (error) {
    // On error, assume not duplicate to avoid losing jobs
    console.error('Error checking for duplicates:', error);
    return false;
  }
}

/**
 * Check multiple jobs for duplicates in batch
 * @param jobs - Array of extracted jobs to check
 * @returns Promise resolving to array of non-duplicate jobs
 */
export async function filterDuplicates(jobs: ExtractedJob[]): Promise<ExtractedJob[]> {
  const nonDuplicates: ExtractedJob[] = [];
  
  for (const job of jobs) {
    const duplicate = await isDuplicate(job);
    if (!duplicate) {
      nonDuplicates.push(job);
    }
  }
  
  return nonDuplicates;
}
