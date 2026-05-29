/**
 * User profile types for job matching system
 * These types mirror the Prisma schema for UserProfile model
 */

/**
 * Experience level enum type
 */
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead';

/**
 * User profile interface - matches Prisma UserProfile model
 */
export interface UserProfile {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  skills: string[];
  interests: string[];
  location: string | null;
  remoteOnly: boolean;
  experienceLevel: ExperienceLevel | null;
  minSalary: number | null;
  maxSalary: number | null;
  skillWeight: number;
  interestWeight: number;
  locationWeight: number;
  salaryWeight: number;
  /** Professional summary / objective statement */
  summary: string | null;
  /** Languages with proficiency levels */
  languages: Array<{ language: string; level?: string }>;
  /** Target job titles / roles */
  jobTitles: string[];
  /** Industries the candidate has experience in */
  industries: string[];
  /** Education entries */
  education: Array<{
    degree: string;
    institution: string;
    graduationYear?: string;
  }>;
}

/**
 * User preferences interface - for API requests and form inputs
 */
export interface UserPreferences {
  skills: string[];
  interests: string[];
  location: string | null;
  remoteOnly: boolean;
  experienceLevel: ExperienceLevel;
  minSalary?: number;
  maxSalary?: number;
}
