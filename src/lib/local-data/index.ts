/**
 * LocalData — JSON file persistence layer.
 *
 * Replaces Prisma/Supabase entirely.
 * All data is stored as JSON files in the `.data/` directory.
 * Survives restarts, needs zero config, works everywhere.
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Data directory
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), '.data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// JSON read / write helpers
// ---------------------------------------------------------------------------

function storePath(collection: string): string {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readCollection<T extends { id: string }>(collection: string): Map<string, T> {
  ensureDataDir();
  const fp = storePath(collection);
  if (!fs.existsSync(fp)) return new Map();
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    const arr: T[] = JSON.parse(raw, reviveDates);
    const map = new Map<string, T>();
    for (const item of arr) {
      map.set(item.id, item);
    }
    return map;
  } catch {
    return new Map();
  }
}

function reviveDates(key: string, value: unknown): unknown {
  if (typeof value === 'string' && /(At|Date)$/.test(key) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }

  return value;
}

function writeCollection<T extends { id: string }>(collection: string, map: Map<string, T>): void {
  ensureDataDir();
  const fp = storePath(collection);
  const arr = Array.from(map.values());
  fs.writeFileSync(fp, JSON.stringify(arr, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type WhereEquals<T> = Partial<T>;
type WhereIn<T> = { in?: T[] };
type WhereDateOp = { gte?: Date; lt?: Date };
type WhereScoreOp = { not?: null };

type WhereClause<T> = {
  [K in keyof T]?: T[K] | WhereIn<T[K]> | WhereDateOp | WhereScoreOp;
};

type OrderBy<T> = Partial<Record<keyof T, 'asc' | 'desc'>>;

// ---------------------------------------------------------------------------
// LocalData class
// ---------------------------------------------------------------------------

export class LocalCollection<T extends { id: string }> {
  private collection: string;
  private cache: Map<string, T> | null = null;

  constructor(collection: string) {
    this.collection = collection;
  }

  private getMap(): Map<string, T> {
    if (!this.cache) {
      this.cache = readCollection<T>(this.collection);
    }
    return this.cache;
  }

  private persist(): void {
    if (this.cache) {
      writeCollection(this.collection, this.cache);
    }
  }

  /** Force re-read from disk (useful if external process modifies files) */
  refresh(): void {
    this.cache = readCollection<T>(this.collection);
  }

  // ---- CRUD ----

  async create(data: T): Promise<T> {
    const map = this.getMap();
    map.set(data.id, data);
    this.persist();
    return data;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const map = this.getMap();
    const existing = map.get(id);
    if (!existing) throw new Error(`Record ${id} not found in ${this.collection}`);
    const updated = { ...existing, ...data };
    map.set(id, updated);
    this.persist();
    return updated;
  }

  async delete(id: string): Promise<void> {
    const map = this.getMap();
    map.delete(id);
    this.persist();
  }

  async findById(id: string): Promise<T | null> {
    return this.getMap().get(id) ?? null;
  }

  async findOne(where: WhereClause<T>): Promise<T | null> {
    const results = this.filter(where);
    return results[0] ?? null;
  }

  async findMany(opts?: {
    where?: WhereClause<T>;
    orderBy?: OrderBy<T>;
    take?: number;
    select?: Partial<Record<keyof T, boolean>>;
  }): Promise<T[]> {
    let results = this.filter(opts?.where ?? {});

    if (opts?.orderBy) {
      const field = Object.keys(opts.orderBy)[0] as keyof T;
      const dir = opts.orderBy[field];
      results.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal instanceof Date && bVal instanceof Date) {
          return dir === 'desc' ? bVal.getTime() - aVal.getTime() : aVal.getTime() - bVal.getTime();
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return dir === 'desc' ? bVal - aVal : aVal - bVal;
        }
        return dir === 'desc'
          ? String(bVal).localeCompare(String(aVal))
          : String(aVal).localeCompare(String(bVal));
      });
    }

    if (opts?.take) {
      results = results.slice(0, opts.take);
    }

    if (!opts?.select) return results;

    return results.map((item) => {
      const projected: Record<string, unknown> = {};
      for (const key of Object.keys(opts.select!)) {
        if (key in item) {
          projected[key] = (item as unknown as Record<string, unknown>)[key];
        }
      }
      return projected as unknown as T;
    });
  }

  async count(where?: WhereClause<T>): Promise<number> {
    return this.filter(where ?? {}).length;
  }

  async upsert(
    idField: keyof T,
    idValue: string,
    createData: T,
    updateData: Partial<T>,
  ): Promise<T> {
    const map = this.getMap();
    // Find existing by idField
    let existing: T | undefined;
    for (const [, record] of map) {
      if (record[idField] === idValue) {
        existing = record;
        break;
      }
    }
    if (existing) {
      const updated = { ...existing, ...updateData };
      map.set(existing.id, updated);
      this.persist();
      return updated;
    }
    map.set(createData.id, createData);
    this.persist();
    return createData;
  }

  /** Update multiple records matching a where clause */
  async updateMany(where: WhereClause<T>, data: Partial<T>): Promise<{ count: number }> {
    const map = this.getMap();
    let count = 0;
    const matches = this.filter(where);
    for (const match of matches) {
      const updated = { ...match, ...data };
      map.set(match.id, updated);
      count++;
    }
    if (count > 0) this.persist();
    return { count };
  }

  /** Aggregate — currently only supports _avg.score */
  async aggregate(opts: {
    _avg?: { score?: boolean };
  }): Promise<{ _avg: { score: number | null } }> {
    if (!opts._avg?.score) return { _avg: { score: null } };
    const map = this.getMap();
    const values = Array.from(map.values());
    const scores = values
      .map((v) => (v as unknown as Record<string, unknown>).score)
      .filter((s): s is number => typeof s === 'number');
    if (scores.length === 0) return { _avg: { score: null } };
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { _avg: { score: Math.round(avg * 10) / 10 } };
  }

  // ---- Internal ----

  private filter(where: WhereClause<T>): T[] {
    const map = this.getMap();
    let results = Array.from(map.values());
    const keys = Object.keys(where) as (keyof T)[];
    for (const key of keys) {
      const condition = where[key];
      if (condition === undefined) continue;

      // Date operator { gte?, lt? }
      if (isDateOp(condition)) {
        results = results.filter((item) => {
          const val = item[key];
          if (!(val instanceof Date)) return false;
          if (condition.gte && val < condition.gte) return false;
          if (condition.lt && val >= condition.lt) return false;
          return true;
        });
        continue;
      }

      // Score operator { not: null }
      if (isScoreOp(condition)) {
        if (condition.not === null) {
          results = results.filter((item) => (item[key] as unknown) !== null);
        }
        continue;
      }

      // In operator
      if (isInOp(condition)) {
        results = results.filter((item) =>
          condition.in!.includes(item[key] as T[keyof T] & T[keyof T][]),
        );
        continue;
      }

      // Equality (including null)
      results = results.filter((item) => item[key] === condition);
    }
    return results;
  }
}

function isDateOp(v: unknown): v is { gte?: Date; lt?: Date } {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && ('gte' in v || 'lt' in v);
}

function isScoreOp(v: unknown): v is { not?: null } {
  return typeof v === 'object' && v !== null && 'not' in v;
}

function isInOp<T>(v: unknown): v is { in?: T[] } {
  return typeof v === 'object' && v !== null && 'in' in v;
}

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

export function generateId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}
