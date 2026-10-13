import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import type { Env } from '../env';

/**
 * We create a drizzle instance per-request (cheap — neon-http just wraps fetch).
 * The `?sslmode=require` param is already part of the Neon DSN.
 */
export function getDb(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — configure via wrangler secret or .dev.vars');
  }
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export * as schema from './schema';
