import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import type { Env } from '../env';
import { ensureSchema } from './ensure-schema';

let _db: any = null;
let _dbPromise: Promise<any> | null = null;

/**
 * We create a drizzle instance per-request (cheap — neon-http just wraps fetch)
 * but the underlying neon sql client is reused. On first access per isolate,
 * we run the idempotent schema bootstrap so new columns/tables exist before
 * Drizzle issues SELECT *.
 */
export async function getDbAsync(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — configure via wrangler secret or .dev.vars');
  }
  if (_db) return _db;
  if (!_dbPromise) {
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    _dbPromise = ensureSchema(db).then(() => { _db = db; return db; }).catch(() => db);
  }
  return _dbPromise;
}

/** Sync accessor kept for backwards compatibility with code paths that already
 *  awaited getDbAsync at least once per isolate (i.e. the warm path). */
export function getDb(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — configure via wrangler secret or .dev.vars');
  }
  if (_db) return _db;
  // Cold path: create without waiting for bootstrap so non-DB routes work,
  // but bootstrap runs in the background. For DB routes, callers should
  // await getDbAsync(env) to guarantee schema readiness.
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql, { schema });
  _dbPromise = ensureSchema(db).then(() => { _db = db; return db; }).catch(() => { _db = db; return db; });
  return db;
}

export * as schema from './schema';
