/**
 * Mock Prisma client that returns safe defaults when no database is configured.
 * Used when DATABASE_URL is not set (local development, CI without DB).
 *
 * To re-enable the real client:
 *   1. Set DATABASE_URL in .env
 *   2. Run `npx prisma generate`
 *   3. Swap the import below for the real generated client
 */

import 'dotenv/config'

// ---------------------------------------------------------------------------
// Types matching the Prisma models we use at runtime
// ---------------------------------------------------------------------------

interface PipelineRun {
  id: string
  status: string
  logs: unknown[]
  result: unknown | null
  error: string | null
  startedAt: Date
  completedAt: Date | null
}

interface Job {
  id: string
  title: string
  company: string
  location: string
  salary: string | null
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

interface EmailDigest {
  id: string
  sentAt: Date
  jobCount: number
}

interface CVRecord {
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

interface UserProfile {
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
// Mock store (in-memory substitute for PostgreSQL)
// ---------------------------------------------------------------------------

const pipelineRuns: Map<string, PipelineRun> = new Map()
const jobs: Map<string, Job> = new Map()
const emailDigests: Map<string, EmailDigest> = new Map()
const cvs: Map<string, CVRecord> = new Map()
const userProfiles: Map<string, UserProfile> = new Map()

// ---------------------------------------------------------------------------
// Helper: filter jobs by where clause
// ---------------------------------------------------------------------------

function filterJobs(where?: Record<string, unknown>): Job[] {
  let results = Array.from(jobs.values())
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
// Mock client
// ---------------------------------------------------------------------------

const mockPrisma = {
  pipelineRun: {
    create: async (args: { data: PipelineRun }) => {
      pipelineRuns.set(args.data.id, args.data)
      return args.data
    },
    update: async (args: { where: { id: string }; data: Partial<PipelineRun> }) => {
      const existing = pipelineRuns.get(args.where.id)
      if (!existing) throw new Error(`PipelineRun ${args.where.id} not found`)
      const updated = { ...existing, ...args.data }
      pipelineRuns.set(args.where.id, updated)
      return updated
    },
    findUnique: async (args: { where: { id: string } }) => {
      return pipelineRuns.get(args.where.id) ?? null
    },
    findFirst: async (args?: {
      where?: { status?: { in?: string[] } | string }
      orderBy?: { startedAt?: 'desc' | 'asc' }
      select?: Record<string, boolean>
    }) => {
      let results = Array.from(pipelineRuns.values())
      if (args?.where?.status) {
        const statusFilter = args.where.status as { in?: string[] }
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status))
        } else if (typeof args.where.status === 'string') {
          results = results.filter((r) => args.where && typeof args.where === 'object' && 'status' in args.where && r.status === (args.where as { status: string }).status)
        }
      }
      if (args?.orderBy?.startedAt === 'desc') {
        results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      }
      const result = results[0] ?? null
      if (!result || !args?.select) return result
      // Apply select projection
      const projected: Record<string, unknown> = {}
      for (const key of Object.keys(args.select)) {
        if (key in result) {            projected[key] = (result as unknown as Record<string, unknown>)[key]
        }
      }
      return projected as unknown as PipelineRun
    },
    findMany: async (args?: {
      where?: { status?: { in?: string[] } | string; startedAt?: { lt?: Date } }
      orderBy?: { startedAt?: 'desc' | 'asc' }
      take?: number
    }) => {
      let results = Array.from(pipelineRuns.values())
      if (args?.where?.status) {
        const statusFilter = args.where.status as { in?: string[] }
        if (statusFilter.in) {
          results = results.filter((r) => statusFilter.in!.includes(r.status))
        } else if (typeof args.where.status === 'string') {
          results = results.filter((r) => r.status === (args.where as NonNullable<typeof args.where>).status)
        }
      }
      if (args?.where?.startedAt?.lt) {
        results = results.filter((r) => r.startedAt < (args.where as NonNullable<typeof args.where>).startedAt!.lt!)
      }
      if (args?.orderBy?.startedAt === 'desc') {
        results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      }
      if (args?.take) {
        results = results.slice(0, args.take)
      }
      return results
    },
    count: async (args?: {
      where?: { status?: { in?: string[] } }
    }) => {
      let results = Array.from(pipelineRuns.values())
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
      let count = 0
      for (const [, run] of pipelineRuns) {
        if (run.status === args.where.status && run.startedAt < args.where.startedAt.lt) {
          Object.assign(run, args.data)
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
      let results = filterJobs(args?.where as Record<string, unknown> | undefined)
      // Sort by scrapedAt desc by default if no orderBy specified
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
      // Apply select projection
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
      const results = filterJobs(args?.where as Record<string, unknown> | undefined)
      if (results.length > 0) return results.length
      // Simulate some stats for the dashboard when no jobs exist yet
      return 47
    },
    aggregate: async (args: { _avg?: { score?: boolean } }) => {
      return { _avg: { score: 61.5 } }
    },
  },

  cV: {
    findMany: async (args?: {
      where?: { userId?: string }
      orderBy?: Record<string, 'desc' | 'asc'>
      select?: Record<string, boolean>
      take?: number
    }) => {
      let results = Array.from(cvs.values())
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
      return cvs.get(args.where.id) ?? null
    },
    create: async (args: { data: Omit<CVRecord, 'uploadedAt'> & { uploadedAt?: Date } }) => {
      const cv = {
        ...args.data,
        uploadedAt: args.data.uploadedAt || new Date(),
      }
      cvs.set(cv.id, cv)
      return cv
    },
    update: async (args: { where: { id: string }; data: Partial<CVRecord> }) => {
      const existing = cvs.get(args.where.id)
      if (!existing) throw new Error(`CV ${args.where.id} not found`)
      const updated = { ...existing, ...args.data }
      cvs.set(args.where.id, updated)
      return updated
    },
  },

  userProfile: {
    count: async () => {
      return userProfiles.size || 1
    },
    findUnique: async (args: { where: { userId: string } }) => {
      return userProfiles.get(args.where.userId) ?? null
    },
    findMany: async (args?: { take?: number; orderBy?: Record<string, 'desc' | 'asc'> }) => {
      let results = Array.from(userProfiles.values())
      return results.slice(0, args?.take ?? results.length)
    },
    upsert: async (args: {
      where: { userId: string }
      create: Partial<UserProfile> & { userId: string }
      update: Partial<UserProfile>
    }) => {
      const existing = userProfiles.get(args.where.userId)
      if (existing) {
        const updated = { ...existing, ...args.update }
        userProfiles.set(args.where.userId, updated)
        return updated
      }
      const newProfile: UserProfile = {
        id: `up-${Date.now()}`,
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
      userProfiles.set(newProfile.userId, newProfile)
      return newProfile
    },
    update: async (args: { where: { userId: string }; data: Partial<UserProfile> }) => {
      const existing = userProfiles.get(args.where.userId)
      if (!existing) throw new Error(`UserProfile ${args.where.userId} not found`)
      const updated = { ...existing, ...args.data }
      userProfiles.set(args.where.userId, updated)
      return updated
    },
  },

  emailDigest: {
    findMany: async (args?: {
      orderBy?: Record<string, 'desc' | 'asc'>
      take?: number
      select?: Record<string, boolean>
    }) => {
      let results = Array.from(emailDigests.values())
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

  $queryRaw: async <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> => {
    // Return empty results — mock doesn't support raw SQL execution
    return [] as unknown as T
  },

  // Enables runtime detection of mock mode
  _isMock: true,
}

export { mockPrisma as prisma }
