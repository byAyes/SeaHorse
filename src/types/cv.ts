/**
 * CV model — matches the CVRecord shape from prisma.ts
 */
export interface CV {
  id: string;
  userId: string;
  version: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  rawText: string;
  status: string;
  skills: string[];
  experience: string[];
  education: string[];
  uploadedAt: Date;
}

/**
 * CV upload result returned by API
 */
export interface CVUploadResult {
  success: boolean;
  cvId?: string;
  version?: number;
  fileUrl?: string;
  error?: string;
}

/**
 * CV version info for history display
 */
export interface CVVersion {
  version: number;
  uploadedAt: Date;
  fileName: string;
  fileSize: number;
  status: string;
  skillsCount: number;
}

/**
 * CV upload input for API requests
 */
export interface CVUploadInput {
  userId: string;
  file: Buffer;
  fileName: string;
}

/**
 * Parsed CV result from PDF extraction
 */
export interface CVParsedResult {
  rawText: string;
  sections: {
    skills?: string;
    experience?: string;
    education?: string;
  };
}

/**
 * Experience entry extracted from CV
 */
export interface ExperienceEntry {
  jobTitle?: string;
  company?: string;
  duration?: string;
  description?: string;
}

/**
 * Education entry extracted from CV
 */
export interface EducationEntry {
  degree?: string;
  institution?: string;
  graduationYear?: string;
}
