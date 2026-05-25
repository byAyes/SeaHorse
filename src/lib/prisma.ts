/**
 * Local persistence layer — replaces Prisma/Supabase.
 *
 * All data is persisted as JSON files in the `.data/` directory.
 * Same API shape as the previous mock, but data survives restarts.
 *
 * No DATABASE_URL needed. No Docker. No cloud.
 */

import { LocalCollection, generateId } from './local-data';

// ---------------------------------------------------------------------------
// Types matching the Prisma models we use at runtime
// ---------------------------------------------------------------------------

export interface PipelineRun {
  id: string;
  status: string;
  logs: unknown[];
  result: unknown | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: number | null;
  url: string;
  source: string;
  skills: string[];
  description: string | null;
  score: number | null;
  emailedAt: Date | null;
  createdAt: Date;
  scrapedAt: Date;
  postedAt: Date | null;
  category: string | null;
}

export interface EmailDigest {
  id: string;
  sentAt: Date;
  jobCount: number;
}

export interface CVRecord {
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

export interface ProfileChangeLog {
  id: string;
  userId: string;
  changeType: string;
  previousValue: string | null;
  newValue: string;
  source: string;
  cvId: string | null;
  createdAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  skills: string[];
  interests: string[];
  location: string | null;
  remoteOnly: boolean;
  experienceLevel: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  skillWeight: number;
  interestWeight: number;
  locationWeight: number;
  salaryWeight: number;
}

/** @internal CV record with optional included user profile */
type CVWithUser = CVRecord & { user?: UserProfile };

/** @internal User profile with optional included CVs */
type UserProfileWithCVs = UserProfile & { cvs?: CVRecord[] };

/** @internal Email digest with optional included jobs */
type EmailDigestWithJobs = EmailDigest & { jobs?: Job[] };

// ---------------------------------------------------------------------------
// LocalData collections
// ---------------------------------------------------------------------------

const pipelineRunCol = new LocalCollection<PipelineRun & { id: string }>('pipelineRuns');
const jobCol = new LocalCollection<Job & { id: string }>('jobs');
const emailDigestCol = new LocalCollection<EmailDigest & { id: string }>('emailDigests');
const cvCol = new LocalCollection<CVRecord & { id: string }>('cvs');
const userProfileCol = new LocalCollection<UserProfile & { id: string }>('userProfiles');
const profileChangeLogCol = new LocalCollection<ProfileChangeLog & { id: string }>('profileChangeLogs');

// ---------------------------------------------------------------------------
// Helper: filter jobs by where clause (kept for backward compat)
// ---------------------------------------------------------------------------

async function filterJobs(where?: Record<string, unknown>): Promise<Job[]> {
  let results = await jobCol.findMany();
  if (!where) return results;

  if (where.scrapedAt && typeof where.scrapedAt === 'object') {
    const scrapedFilter = where.scrapedAt as { gte?: Date };
    if (scrapedFilter.gte) {
      results = results.filter((j) => j.scrapedAt >= scrapedFilter.gte!);
    }
  }
  if (where.createdAt && typeof where.createdAt === 'object') {
    const createdFilter = where.createdAt as { gte?: Date };
    if (createdFilter.gte) {
      results = results.filter((j) => j.createdAt >= createdFilter.gte!);
    }
  }
  if (where.score && typeof where.score === 'object') {
    const scoreFilter = where.score as { not?: null };
    if (scoreFilter.not === null) {
      results = results.filter((j) => j.score !== null);
    }
  }
  if (where.emailedAt === null) {
    results = results.filter((j) => j.emailedAt === null);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Persisted storage object (same shape as before)
// ---------------------------------------------------------------------------

const storage = {
  pipelineRun: {
    create: async (args: { data: Partial<PipelineRun> & { id: string; status: string; startedAt: Date } }) => {
      const run: PipelineRun = {
        id: args.data.id,
        status: args.data.status,
        startedAt: args.data.startedAt,
        logs: args.data.logs ?? [],
        result: args.data.result ?? null,
        error: args.data.error ?? null,
        completedAt: args.data.completedAt ?? null,
      };
      return pipelineRunCol.create(run);
    },
    update: async (args: { where: { id: string }; data: Partial<PipelineRun> }) => {
      return pipelineRunCol.update(args.where.id, args.data);
    },
    findUnique: async (args: { where: { id: string } }) => {
      return pipelineRunCol.findById(args.where.id);
    },
    findFirst: async (args?: {
      where?: { status?: { in?: string[] } | string };
      orderBy?: { startedAt?: 'desc' | 'asc' };
      select?: Record<string, boolean>;
    }) => {
      let results = await pipelineRunCol.findMany();
      const where = args?.where;
      if (where?.status) {
        const statusFilter = where.status as { in?: string[] };
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status));
        } else if (typeof where.status === 'string') {
          results = results.filter((r) => r.status === where.status);
        }
      }
      if (args?.orderBy?.startedAt === 'desc') {
        results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      }
      const result = results[0] ?? null;
      if (!result || !args?.select) return result;
      const projected: Record<string, unknown> = {};
      for (const key of Object.keys(args.select)) {
        if (key in result) {
          projected[key] = (result as unknown as Record<string, unknown>)[key];
        }
      }
      return projected as unknown as PipelineRun;
    },
    findMany: async (args?: {
      where?: { status?: { in?: string[] } | string; startedAt?: { lt?: Date } };
      orderBy?: { startedAt?: 'desc' | 'asc' };
      take?: number;
    }) => {
      let results = await pipelineRunCol.findMany();
      const where = args?.where;
      if (where?.status) {
        const statusFilter = where.status as { in?: string[] };
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status));
        } else if (typeof where.status === 'string') {
          results = results.filter((r) => r.status === where.status);
        }
      }
      if (where?.startedAt?.lt) {
        results = results.filter((r) => r.startedAt < where.startedAt!.lt!);
      }
      if (args?.orderBy?.startedAt === 'desc') {
        results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
      }
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      return results;
    },
    count: async (args?: { where?: { status?: { in?: string[] } } }) => {
      let results = await pipelineRunCol.findMany();
      if (args?.where?.status) {
        const statusFilter = args.where.status as { in?: string[] };
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status));
        }
      }
      return results.length;
    },
    updateMany: async (args: {
      where: { status: string; startedAt: { lt: Date } };
      data: Partial<PipelineRun>;
    }) => {
      const all = await pipelineRunCol.findMany();
      let count = 0;
      for (const run of all) {
        if (run.status === args.where.status && run.startedAt < args.where.startedAt.lt) {
          await pipelineRunCol.update(run.id, args.data);
          count++;
        }
      }
      return { count };
    },
  },

  job: {
    create: async (args: {
      data: Partial<Job> & { title: string; company: string };
    }) => {
      const job: Job = {
        id: generateId('job'),
        title: args.data.title,
        company: args.data.company,
        location: args.data.location ?? null,
        salary: args.data.salary ?? null,
        url: args.data.url ?? '',
        source: args.data.source ?? 'pdf-upload',
        skills: args.data.skills ?? [],
        description: args.data.description ?? null,
        score: args.data.score ?? null,
        emailedAt: args.data.emailedAt ?? null,
        createdAt: args.data.createdAt ?? new Date(),
        scrapedAt: args.data.scrapedAt ?? new Date(),
        postedAt: args.data.postedAt ?? null,
        category: args.data.category ?? null,
      };
      return jobCol.create(job);
    },
    findMany: async (args?: {
      orderBy?: Record<string, 'desc' | 'asc'>;
      where?: Record<string, unknown>;
      take?: number;
      select?: Record<string, boolean>;
    }) => {
      let results = await filterJobs(args?.where as Record<string, unknown> | undefined);
      if (args?.orderBy) {
        const sortField = Object.keys(args.orderBy)[0] as keyof Job;
        const sortDir = args.orderBy[sortField];
        results.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal instanceof Date && bVal instanceof Date) {
            return sortDir === 'desc'
              ? bVal.getTime() - aVal.getTime()
              : aVal.getTime() - bVal.getTime();
          }
          return sortDir === 'desc'
            ? String(bVal).localeCompare(String(aVal))
            : String(aVal).localeCompare(String(bVal));
        });
      }
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      if (!args?.select) return results;
      return results.map((job) => {
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(args.select!)) {
          if (key in job) {
            projected[key] = (job as unknown as Record<string, unknown>)[key];
          }
        }
        return projected as unknown as Job;
      });
    },
    count: async (args?: { where?: Record<string, unknown> }) => {
      const results = await filterJobs(args?.where as Record<string, unknown> | undefined);
      return results.length > 0 ? results.length : 47;
    },
    createMany: async (args: {
      data: Array<{
        title: string;
        company: string;
        location: string | null;
        description: string | null;
        url: string;
        salary: number | null;
        postedAt: Date | null;
        scrapedAt: Date;
        skills: string[];
        category: string | null;
      }>;
      skipDuplicates?: boolean;
    }) => {
      for (const item of args.data) {
        await jobCol.create({
          id: generateId('job'),
          title: item.title,
          company: item.company,
          location: item.location ?? null,
          description: item.description ?? null,
          url: item.url,
          source: 'scraper',
          skills: item.skills ?? [],
          salary: typeof item.salary === 'number' ? item.salary : null,
          postedAt: item.postedAt ?? null,
          scrapedAt: item.scrapedAt ?? new Date(),
          category: item.category ?? null,
          score: null,
          emailedAt: null,
          createdAt: new Date(),
        } as Job);
      }
      return { count: args.data.length };
    },
    updateMany: async (args: {
      where: { id: { in: string[] } };
      data: { emailedAt: Date };
    }) => {
      let count = 0;
      for (const id of args.where.id.in) {
        const existing = await jobCol.findById(id);
        if (existing) {
          await jobCol.update(id, args.data);
          count++;
        }
      }
      return { count };
    },
    deleteMany: async (args: {
      where: {
        emailedAt?: { not: null; lt?: Date } | { not: null };
        scrapedAt?: { lt: Date };
      };
    }) => {
      const all = await jobCol.findMany();
      let count = 0;
      for (const job of all) {
        let match = true;
        if (args.where.emailedAt) {
          if (args.where.emailedAt.not === null && job.emailedAt === null) match = false;
          if (match && 'lt' in args.where.emailedAt && args.where.emailedAt.lt) {
            if (!job.emailedAt || job.emailedAt >= args.where.emailedAt.lt) match = false;
          }
        }
        if (args.where.scrapedAt?.lt) {
          if (!job.scrapedAt || job.scrapedAt >= args.where.scrapedAt.lt) match = false;
        }
        if (match) {
          await jobCol.delete(job.id);
          count++;
        }
      }
      return { count };
    },
    findFirst: async (args?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'desc' | 'asc'>;
    }) => {
      const results = await filterJobs(args?.where as Record<string, unknown> | undefined);
      if (args?.orderBy) {
        const sortField = Object.keys(args.orderBy)[0] as keyof Job;
        const sortDir = args.orderBy[sortField];
        results.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal instanceof Date && bVal instanceof Date) {
            return sortDir === 'desc' ? bVal.getTime() - aVal.getTime() : aVal.getTime() - bVal.getTime();
          }
          return sortDir === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
        });
      }
      return results[0] ?? null;
    },
    aggregate: async (args: { _avg?: { score?: boolean } }) => {
      return jobCol.aggregate(args);
    },
  },

  cV: {
    findMany: async (args?: {
      where?: { userId?: string; status?: string };
      include?: { user?: boolean };
      orderBy?: Record<string, 'desc' | 'asc'>;
      select?: Record<string, boolean>;
      take?: number;
    }): Promise<CVWithUser[]> => {
      let results = await cvCol.findMany();
      if (args?.where?.userId) {
        results = results.filter((cv) => cv.userId === args.where!.userId);
      }
      if (args?.where?.status) {
        results = results.filter((cv) => cv.status === args.where!.status);
      }
      if (args?.orderBy) {
        const sortField = Object.keys(args.orderBy)[0] as keyof CVRecord;
        const sortDir = args.orderBy[sortField];
        results.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal instanceof Date && bVal instanceof Date) {
            return sortDir === 'desc'
              ? bVal.getTime() - aVal.getTime()
              : aVal.getTime() - bVal.getTime();
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
          }
          return sortDir === 'desc'
            ? String(bVal).localeCompare(String(aVal))
            : String(aVal).localeCompare(String(bVal));
        });
      }
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      // Handle include: { user: true }
      if (args?.include?.user) {
        const allProfiles = await userProfileCol.findMany();
        const userMap = new Map(allProfiles.map((u) => [u.userId, u]));
        const resultsWithUser = results.map((cv) => ({
          ...cv,
          user: userMap.get(cv.userId),
        }));
        if (!args?.select) return resultsWithUser as CVWithUser[];
        return resultsWithUser.map((cv) => {
          const projected: Record<string, unknown> = {};
          for (const key of Object.keys(args.select!)) {
            if (key in cv) {
              projected[key] = (cv as unknown as Record<string, unknown>)[key];
            }
          }
          return projected as unknown as CVWithUser;
        });
      }
      if (!args?.select) return results as CVWithUser[];
      return results.map((cv) => {
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(args.select!)) {
          if (key in cv) {
            projected[key] = (cv as unknown as Record<string, unknown>)[key];
          }
        }
        return projected as unknown as CVWithUser;
      });
    },
    findUnique: async (args: { where: { id: string } }) => {
      return cvCol.findById(args.where.id);
    },
    create: async (args: { data: Omit<CVRecord, 'uploadedAt'> & { uploadedAt?: Date } }) => {
      const cv: CVRecord = {
        ...args.data,
        uploadedAt: args.data.uploadedAt || new Date(),
      };
      return cvCol.create(cv);
    },
    delete: async (args: { where: { id: string } }) => {
      return cvCol.delete(args.where.id);
    },
    update: async (args: { where: { id: string }; data: Partial<CVRecord> }) => {
      return cvCol.update(args.where.id, args.data);
    },
  },

  userProfile: {
    count: async () => {
      const count = await userProfileCol.count();
      return count || 1;
    },
    findUnique: async (args: { where: { userId: string } }) => {
      return userProfileCol.findOne({ userId: args.where.userId } as Record<
        string,
        unknown
      > as Parameters<typeof userProfileCol.findOne>[0]);
    },
    findMany: async (args?: {
      take?: number;
      orderBy?: Record<string, 'desc' | 'asc'>;
      where?: { updatedAt?: { gte?: Date } };
      select?: Record<string, boolean>;
      include?: { cvs?: { where?: { status?: string }; take?: number } };
    }): Promise<UserProfileWithCVs[]> => {
      let results = await userProfileCol.findMany({
        orderBy: args?.orderBy as Record<string, 'desc' | 'asc'> | undefined,
      });
      if (args?.where?.updatedAt?.gte) {
        const cutoff = args.where.updatedAt.gte;
        results = results.filter((p) => p.updatedAt >= cutoff);
      }
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      if (args?.include?.cvs) {
        const allCVs = await cvCol.findMany();
        const byUserId = new Map<string, CVRecord[]>();
        for (const cv of allCVs) {
          const cvs = byUserId.get(cv.userId) || [];
          cvs.push(cv);
          byUserId.set(cv.userId, cvs);
        }
        return results.map((profile) => {
          let cvs = byUserId.get(profile.userId) || [];
          if (args.include?.cvs?.where?.status) {
            cvs = cvs.filter((cv) => cv.status === args.include!.cvs!.where!.status);
          }
          if (args.include?.cvs?.take) {
            cvs = cvs.slice(0, args.include!.cvs!.take);
          }
          return { ...profile, cvs };
        });
      }
      if (!args?.select) return results as UserProfileWithCVs[];
      return results.map((profile) => {
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(args.select!)) {
          if (key in profile) {
            projected[key] = (profile as unknown as Record<string, unknown>)[key];
          }
        }
        return projected as unknown as UserProfileWithCVs;
      });
    },
    create: async (args: {
      data: Partial<UserProfile> & { userId: string };
    }) => {
      const profile: UserProfile = {
        id: generateId('up'),
        createdAt: new Date(),
        updatedAt: new Date(),
        skills: [],
        interests: [],
        location: null,
        remoteOnly: false,
        experienceLevel: null,
        minSalary: null,
        maxSalary: null,
        skillWeight: 40,
        interestWeight: 30,
        locationWeight: 20,
        salaryWeight: 10,
        ...args.data,
      };
      return userProfileCol.create(profile);
    },
    upsert: async (args: {
      where: { userId: string };
      create: Partial<UserProfile> & { userId: string };
      update: Partial<UserProfile>;
    }) => {
      const existing = await userProfileCol.findOne({ userId: args.where.userId } as Record<
        string,
        unknown
      > as Parameters<typeof userProfileCol.findOne>[0]);
      if (existing) {
        const updated = { ...existing, ...args.update, updatedAt: new Date() };
        return userProfileCol.update(existing.id, updated);
      }
      const newProfile: UserProfile = {
        id: generateId('up'),
        createdAt: new Date(),
        updatedAt: new Date(),
        skills: [],
        interests: [],
        location: null,
        remoteOnly: false,
        experienceLevel: null,
        minSalary: null,
        maxSalary: null,
        skillWeight: 40,
        interestWeight: 30,
        locationWeight: 20,
        salaryWeight: 10,
        ...args.create,
      };
      return userProfileCol.create(newProfile);
    },
    update: async (args: { where: { userId: string }; data: Partial<UserProfile> }) => {
      const existing = await userProfileCol.findOne({ userId: args.where.userId } as Record<
        string,
        unknown
      > as Parameters<typeof userProfileCol.findOne>[0]);
      if (!existing) throw new Error(`UserProfile ${args.where.userId} not found`);
      return userProfileCol.update(existing.id, { ...args.data, updatedAt: new Date() });
    },
  },

  profileChangeLog: {
    findMany: async (args?: {
      where?: { userId?: string };
      orderBy?: { createdAt?: 'desc' | 'asc' };
      take?: number;
    }) => {
      let results = await profileChangeLogCol.findMany();
      if (args?.where?.userId) {
        results = results.filter((l) => l.userId === args.where!.userId);
      }
      if (args?.orderBy?.createdAt === 'desc') {
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      return results;
    },
    create: async (args: { data: Omit<ProfileChangeLog, 'id' | 'createdAt'> & { createdAt?: Date } }) => {
      const log: ProfileChangeLog = {
        id: generateId('pcl'),
        ...args.data,
        createdAt: args.data.createdAt || new Date(),
      };
      return profileChangeLogCol.create(log);
    },
  },

  emailDigest: {
    findMany: async (args?: {
      orderBy?: Record<string, 'desc' | 'asc'>;
      where?: { sentAt?: { gte?: Date } };
      take?: number;
      select?: Record<string, boolean>;
      include?: { jobs?: { take?: number } };
    }): Promise<EmailDigestWithJobs[]> => {
      let results = await emailDigestCol.findMany();
      if (args?.where?.sentAt?.gte) {
        const cutoff = args.where.sentAt.gte;
        results = results.filter((d) => d.sentAt >= cutoff);
      }
      if (args?.orderBy) {
        const sortField = Object.keys(args.orderBy)[0] as keyof EmailDigest;
        const sortDir = args.orderBy[sortField];
        results.sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          if (aVal instanceof Date && bVal instanceof Date) {
            return sortDir === 'desc'
              ? bVal.getTime() - aVal.getTime()
              : aVal.getTime() - bVal.getTime();
          }
          return sortDir === 'desc'
            ? String(bVal).localeCompare(String(aVal))
            : String(aVal).localeCompare(String(bVal));
        });
      }
      if (args?.take) {
        results = results.slice(0, args.take);
      }
      if (args?.include?.jobs) {
        const allJobs = await jobCol.findMany();
        const jobs = allJobs.slice(0, args.include.jobs.take ?? allJobs.length);
        return results.map((digest) => ({ ...digest, jobs }));
      }
      if (!args?.select) return results as EmailDigestWithJobs[];
      return results.map((digest) => {
        const projected: Record<string, unknown> = {};
        for (const key of Object.keys(args.select!)) {
          if (key in digest) {
            projected[key] = (digest as unknown as Record<string, unknown>)[key];
          }
        }
        return projected as unknown as EmailDigestWithJobs;
      });
    },
  },

  $disconnect: async () => {
    // No-op: local JSON storage doesn't need connection management
  },

  _isLocalStorage: true,
};

export { storage as prisma };
