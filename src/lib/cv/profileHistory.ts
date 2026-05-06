/**
 * Profile Change Tracking Module
 * Tracks all changes to user profiles over time
 */

import { prisma } from '../prisma';

function safeJsonParse(value: string, context: string): any {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(`Failed to parse JSON for ${context}:`, error);
    return value;
  }
}

/**
 * Profile change input type
 */
export interface ProfileChangeInput {
  userId: string;
  changeType: string;
  previousValue?: any;
  newValue: any;
  source: 'cv_upload' | 'manual' | 'system';
  cvId?: string;
}

/**
 * Track a profile change
 * Saves change log entry to database
 */
export async function trackProfileChange(input: ProfileChangeInput): Promise<void> {
  try {
    await prisma.profileChangeLog.create({
      data: {
        userId: input.userId,
        changeType: input.changeType,
        previousValue: input.previousValue ? JSON.stringify(input.previousValue) : null,
        newValue: JSON.stringify(input.newValue),
        source: input.source,
        cvId: input.cvId,
      },
    });
  } catch (error) {
    console.error('Error tracking profile change:', error);
    // Don't throw - change tracking is secondary operation
  }
}

/**
 * Get profile change history for a user
 * Returns paginated list of changes
 */
export async function getProfileHistory(
  userId: string,
  limit: number = 50
): Promise<ProfileChangeLog[]> {
  try {
    const changes = await prisma.profileChangeLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

  return changes.map((change) => ({
    ...change,
    previousValue: change.previousValue
      ? safeJsonParse(change.previousValue, `profileChange:${change.id}:previousValue`)
      : null,
    newValue: safeJsonParse(change.newValue, `profileChange:${change.id}:newValue`),
  }));
  } catch (error) {
    console.error('Error fetching profile history:', error);
    return [];
  }
}

/**
 * ProfileChangeLog model type
 */
export interface ProfileChangeLog {
  id: string;
  userId: string;
  changeType: string;
  previousValue: any;
  newValue: any;
  source: string;
  cvId: string | null;
  createdAt: Date;
}
