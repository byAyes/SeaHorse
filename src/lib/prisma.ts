/**
 * Real Prisma client initialized with Supabase connection via @prisma/adapter-pg.
 *
 * Connection flow:
 *   PrismaClient → PrismaPg adapter → pg.Pool → Supabase PostgreSQL
 *
 * DATABASE_URL used for queries (runtime).
 * DIRECT_URL used by Prisma CLI for migrations (prisma db push / migrate).
 */

import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2, // Single-threaded pipeline doesn't need more
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

export { prisma }
