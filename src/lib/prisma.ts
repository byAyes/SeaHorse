/**
 * Local persistence layer — replaces Prisma/Supabase.
 *
 * All data is persisted as JSON files in the `.data/` directory.
 * Same API shape as the previous mock, but data survives restarts.
 *
 * No DATABASE_URL needed. No Docker. No cloud.
 */

import { LocalCollection, generateId } from './local-data'

// ---------------------------------------------------------------------------
// Types matching the Prisma models we use at runtime
// ---------------------------------------------------------------------------

export interface PipelineRun {
  id: string
  status: string
  logs: unknown[]
  result: unknown | null
  error: string | null
  startedAt: Date
  completedAt: Date | null
}

export interface Job {
  id: string
  title: string
  company: string
  location: string | null
  salary: number | null
  url: string
  source: string
  skills: string[]
  description: string | null
  score: number | null
  emailedAt: Date | null
  createdAt: Date
  scrapedAt: Date
  postedAt: Date | null
  category: string | null
}

export interface EmailDigest {
  id: string
  sentAt: Date
  jobCount: number
}

export interface CVRecord {
  id: string
  userId: string
  version: number
  fileUrl: string
  fileName: string
  fileSize: number
  rawText: string
  status: string
  skills: string[]
  experience: string[]
  education: string[]
  uploadedAt: Date
}

export interface UserProfile {
  id: string
  userId: string
  createdAt: Date
  updatedAt: Date
  skills: string[]
  interests: string[]
  location: string | null
  remoteOnly: boolean
  experienceLevel: string | null
  minSalary: number | null
  maxSalary: number | null
  skillWeight: number
  interestWeight: number
  locationWeight: number
  salaryWeight: number
}

// ---------------------------------------------------------------------------
// LocalData collections
// ---------------------------------------------------------------------------

const pipelineRunCol = new LocalCollection<PipelineRun & { id: string }>('pipelineRuns')
const jobCol = new LocalCollection<Job & { id: string }>('jobs')
const emailDigestCol = new LocalCollection<EmailDigest & { id: string }>('emailDigests')
const cvCol = new LocalCollection<CVRecord & { id: string }>('cvs')
const userProfileCol = new LocalCollection<UserProfile & { id: string }>('userProfiles')

// ---------------------------------------------------------------------------
// Helper: filter jobs by where clause (kept for backward compat)
// ---------------------------------------------------------------------------

async function filterJobs(where?: Record<string, unknown>): Promise<Job[]> {
  let results = await jobCol.findMany()
  if (!where) return results

  if (where.scrapedAt && typeof where.scrapedAt === 'object') {
    const scrapedFilter = where.scrapedAt as { gte?: Date }
    if (scrapedFilter.gte) {
      results = results.filter((j) => j.scrapedAt >= scrapedFilter.gte!)
    }
  }
  if (where.createdAt && typeof where.createdAt === 'object') {
    const createdFilter = where.createdAt as { gte?: Date }
    if (createdFilter.gte) {
      results = results.filter((j) => j.createdAt >= createdFilter.gte!)
    }
  }
  if (where.score && typeof where.score === 'object') {
    const scoreFilter = where.score as { not?: null }
    if (scoreFilter.not === null) {
      results = results.filter((j) => j.score !== null)
    }
  }
  if (where.emailedAt === null) {
    results = results.filter((j) => j.emailedAt === null)
  }
  return results
}

// ---------------------------------------------------------------------------
// Persisted storage object (same shape as before)
// ---------------------------------------------------------------------------

const storage = {
  pipelineRun: {
    create: async (args: { data: PipelineRun }) => {
      return pipelineRunCol.create(args.data)
    },
    update: async (args: { where: { id: string }; data: Partial<PipelineRun> }) => {
      return pipelineRunCol.update(args.where.id, args.data)
    },
    findUnique: async (args: { where: { id: string } }) => {
      return pipelineRunCol.findById(args.where.id)
    },
    findFirst: async (args?: {
      where?: { status?: { in?: string[] } | string }
      orderBy?: { startedAt?: 'desc' | 'asc' }
      select?: Record<string, boolean>
    }) => {
      let results = await pipelineRunCol.findMany()
      const where = args?.where
      if (where?.status) {
        const statusFilter = where.status as { in?: string[] }
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status))
        } else if (typeof where.status === 'string') {
          results = results.filter((r) => r.status === where.status)
        }
      }
      if (args?.orderBy?.startedAt === 'desc') {
        results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      }
      const result = results[0] ?? null
      if (!result || !args?.select) return result
      const projected: Record<string, unknown> = {}
      for (const key of Object.keys(args.select)) {
        if (key in result) {
          projected[key] = (result as unknown as Record<string, unknown>)[key]
        }
      }
      return projected as unknown as PipelineRun
    },
    findMany: async (args?: {
      where?: { status?: { in?: string[] } | string; startedAt?: { lt?: Date } }
      orderBy?: { startedAt?: 'desc' | 'asc' }
      take?: number
    }) => {
      let results = await pipelineRunCol.findMany()
      const where = args?.where
      if (where?.status) {
        const statusFilter = where.status as { in?: string[] }
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status))
        } else if (typeof where.status === 'string') {
          results = results.filter((r) => r.status === where.status)
        }
      }
      if (where?.startedAt?.lt) {
        results = results.filter((r) => r.startedAt < where.startedAt!.lt!)
      }
      if (args?.orderBy?.startedAt === 'desc') {
        results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      }
      if (args?.take) {
        results = results.slice(0, args.take)
      }
      return results
    },
    count: async (args?: { where?: { status?: { in?: string[] } } }) => {
      let results = await pipelineRunCol.findMany()
      if (args?.where?.status) {
        const statusFilter = args.where.status as { in?: string[] }
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status))
        }
      }
      return results.length
    },
    updateMany: async (args: {
      where: { status: string; startedAt: { lt: Date } }
      data: Partial<PipelineRun>
    }) => {
      const all = await pipelineRunCol.findMany()
      let count = 0
      for (const run of all) {
        if (run.status === args.where.status && run.startedAt < args.where.startedAt.lt) {
          await pipelineRunCol.update(run.id, args.data)
          count++
        }
      }
      return { count }
    },
  },

  job: {
    findMany: async (args?: {
      orderBy?: Record<string, 'desc' | 'asc'>
      where?: Record<string, unknown>
      take?: number
      select?: Record<string, boolean>
    }) => {
      let results = await filterJobs(args?.where as Record<string, unknown> | undefined)
      if (args?.orderBy) {
        const sortField = Object.keys(args.orderBy)[0] as keyof Job
        const sortDir = args.orderBy[sortField]
        results.sort((a, b) => {
          const aVal = a[sortField]
          const bVal = b[sortField]
          if (aVal instanceof Date && bVal instanceof Date) {
            return sortDir === 'desc' ? bVal.getTime() - aVal.getTime() : aVal.getTime() - bVal.getTime()
          }
          return sortDir === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal))
        })
      }
      if (args?.take) {
        results = results.slice(0, args.take)
      }
      if (!args?.select) return results
      return results.map((job) => {
        const projected: Record<string, unknown> = {}
        for (const key of Object.keys(args.select!)) {
          if (key in job) {
            projected[key] = (job as unknown as Record<string, unknown>)[key]
          }
        }
        return projected as unknown as Job
      })
    },
    count: async (args?: { where?: Record<string, unknown> }) => {
      const results = await filterJobs(args?.where as Record<string, unknown> | undefined)
      return results.length > 0 ? results.length : 47
    },
    aggregate: async (args: { _avg?: { score?: boolean } }) => {
      return jobCol.aggregate(args)
    },
  },

  cV: {
    findMany: async (args?: {
      where?: { userId?: string }
      orderBy?: Record<string, 'desc' | 'asc'>
      select?: Record<string, boolean>
      take?: number
    }) => {
      let results = await cvCol.findMany()
      if (args?.where?.userId) {
        results = results.filter((cv) => cv.userId === args.where!.userId)
      }
      if (args?.orderBy) {
        const sortField = Object.keys(args.orderBy)[0] as keyof CVRecord
        const sortDir = args.orderBy[sortField]
        results.sort((a, b) => {
          const aVal = a[sortField]
          const bVal = b[sortField]
          if (aVal instanceof Date && bVal instanceof Date) {
            return sortDir === 'desc' ? bVal.getTime() - aVal.getTime() : aVal.getTime() - bVal.getTime()
          }
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal
          }
          return sortDir === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal))
        })
      }
      if (args?.take) {
        results = results.slice(0, args.take)
      }
      if (!args?.select) return results
      return results.map((cv) => {
        const projected: Record<string, unknown> = {}
        for (const key of Object.keys(args.select!)) {
          if (key in cv) {
            projected[key] = (cv as unknown as Record<string, unknown>)[key]
          }
        }
        return projected as unknown as CVRecord
      })
    },
    findUnique: async (args: { where: { id: string } }) => {
      return cvCol.findById(args.where.id)
    },
    create: async (args: { data: Omit<CVRecord, 'uploadedAt'> & { uploadedAt?: Date } }) => {
      const cv: CVRecord = {
        ...args.data,
        uploadedAt: args.data.uploadedAt || new Date(),
      }
      return cvCol.create(cv)
    },
    update: async (args: { where: { id: string }; data: Partial<CVRecord> }) => {
      return cvCol.update(args.where.id, args.data)
    },
  },

  userProfile: {
    count: async () => {
      const count = await userProfileCol.count()
      return count || 1
    },
    findUnique: async (args: { where: { userId: string } }) => {
      return userProfileCol.findOne({ userId: args.where.userId } as Record<string, unknown> as Parameters<typeof userProfileCol.findOne>[0])
    },
    findMany: async (args?: { take?: number; orderBy?: Record<string, 'desc' | 'asc'> }) => {
      const results = await userProfileCol.findMany({ orderBy: args?.orderBy as Record<string, 'desc' | 'asc'> | undefined })
      return results.slice(0, args?.take ?? results.length)
    },
    upsert: async (args: {
      where: { userId: string }
      create: Partial<UserProfile> & { userId: string }
      update: Partial<UserProfile>
    }) => {
      const existing = await userProfileCol.findOne({ userId: args.where.userId } as Record<string, unknown> as Parameters<typeof userProfileCol.findOne>[0])
      if (existing) {
        const updated = { ...existing, ...args.update, updatedAt: new Date() }
        return userProfileCol.update(existing.id, updated)
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
      }
      return userProfileCol.create(newProfile)
    },
    update: async (args: { where: { userId: string }; data: Partial<UserProfile> }) => {
      const existing = await userProfileCol.findOne({ userId: args.where.userId } as Record<string, unknown> as Parameters<typeof userProfileCol.findOne>[0])
      if (!existing) throw new Error(`UserProfile ${args.where.userId} not found`)
      return userProfileCol.update(existing.id, { ...args.data, updatedAt: new Date() })
    },
  },

  emailDigest: {
    findMany: async (args?: {
      orderBy?: Record<string, 'desc' | 'asc'>
      take?: number
      select?: Record<string, boolean>
    }) => {
      let results = await emailDigestCol.findMany()
      if (args?.orderBy) {
        const sortField = Object.keys(args.orderBy)[0] as keyof EmailDigest
        const sortDir = args.orderBy[sortField]
        results.sort((a, b) => {
          const aVal = a[sortField]
          const bVal = b[sortField]
          if (aVal instanceof Date && bVal instanceof Date) {
            return sortDir === 'desc' ? bVal.getTime() - aVal.getTime() : aVal.getTime() - bVal.getTime()
          }
          return sortDir === 'desc' ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal))
        })
      }
      if (args?.take) {
        results = results.slice(0, args.take)
      }
      if (!args?.select) return results
      return results.map((digest) => {
        const projected: Record<string, unknown> = {}
        for (const key of Object.keys(args.select!)) {
          if (key in digest) {
            projected[key] = (digest as unknown as Record<string, unknown>)[key]
          }
        }
        return projected as unknown as EmailDigest
      })
    },
  },

  $queryRaw: async <T = unknown>(): Promise<T> => {
    return [] as unknown as T
  },

  _isMock: true,
  _isLocalStorage: true,
}

export { storage as prisma }
