/**
 * Authentication & authorization helpers.
 *
 * Supported identity mechanisms:
 *   1. Internal session JWT in Authorization: Bearer — signed by us with
 *      HMAC-SHA256 using JWT_SECRET. Issued by POST /admin/login and
 *      POST /client/login. This is the primary path for Phase 1+.
 *   2. Firebase ID token in Authorization: Bearer — signature VERIFIED with
 *      RSASSA-PKCS1-v1_5 against Google's securetoken X.509 certs. Used as a
 *      bridge to Firebase Auth for admin users.
 *   3. X-TT-Admin-Password (legacy): the shared admin password. Only accepted
 *      in DEV_MODE or when the provided password matches env.ADMIN_PASSWORD.
 *      Hardcoded default is NEVER accepted in production (DEV_MODE must be on).
 *   4. X-TT-Client-Demo:1 demo shortcut — only accepted when DEV_MODE=true.
 *      The demo login still requires valid credentials via POST /client/login
 *      even in dev (to exercise the real session flow).
 *
 * Identity is ALWAYS determined on the server; the client's self-reported
 * clientId/projectId in request bodies is NEVER trusted without verifying
 * ownership against the DB (see assertProjectOwnership etc.).
 */
import type { Env } from '../env';
import { getDb, schema } from '../db';
import { eq, and } from 'drizzle-orm';
import { verifyToken, type SessionPayload } from './jwt';
import { verifyFirebaseToken } from './firebase-jwt';
import { ApiError } from './errors';

export interface AuthContext {
  uid: string;
  email: string;
  name?: string;
  kind: 'admin' | 'client';
  role?: string;        // OWNER/ADMIN/EDITOR (admin only)
  clientId?: string;    // client records only
  sessionId: string;
  // source is how this session was authenticated — useful for audit logs
  source: 'jwt' | 'firebase' | 'password' | 'demo';
}

const LEGACY_DEFAULT_ADMIN_PASSWORD = 'iloveesther221@@';
const DEMO_CLIENT_EMAIL = 'demo@toluenetech.com';
const DEMO_CLIENT_CODE = 'DEMO-2026';

function isDevMode(env: Env): boolean {
  return (env.DEV_MODE ?? 'false').toLowerCase() === 'true';
}

export function adminPasswordExpected(env: Env): string | null {
  if (env.ADMIN_PASSWORD) return env.ADMIN_PASSWORD;
  if (isDevMode(env)) return LEGACY_DEFAULT_ADMIN_PASSWORD;
  return null; // production requires JWT/Firebase
}

function extractBearer(req: Request): string | null {
  const m = (req.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

async function verifyBearer(req: Request, env: Env): Promise<AuthContext | null> {
  const bearer = extractBearer(req);
  if (!bearer) return null;

  // Try our session JWT first.
  try {
    const p: SessionPayload = await verifyToken(env, bearer);
    if (p.kind === 'admin') {
      // Load admin user to ensure they still exist and capture role.
      const db = getDb(env);
      const [row] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.uid, p.sub)).limit(1);
      if (row) {
        return {
          uid: row.uid, email: row.email, name: row.name ?? p.name, kind: 'admin',
          role: row.role, sessionId: p.sid, source: 'jwt',
        };
      }
      // Locally-issued admin password sessions use uid 'local-admin'.
      if (p.sub === 'local-admin') {
        return { uid: 'local-admin', email: p.email || 'admin@toluenetech.com', name: p.name || 'Admin', kind: 'admin', role: p.role || 'OWNER', sessionId: p.sid, source: 'jwt' };
      }
    } else if (p.kind === 'client') {
      // Load client and verify it still exists and is active.
      if (!p.clientId) return null;
      const db = getDb(env);
      const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, p.clientId)).limit(1);
      if (row && row.status === 'ACTIVE') {
        return {
          uid: row.id, email: row.email, name: row.name, kind: 'client',
          clientId: row.id, sessionId: p.sid, source: 'jwt',
        };
      }
    }
  } catch { /* fall through to firebase */ }

  // Firebase ID token.
  try {
    const claims = await verifyFirebaseToken(env, bearer);
    const db = getDb(env);
    // Try admin users first.
    const [admin] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.uid, claims.uid)).limit(1);
    if (admin) {
      return {
        uid: admin.uid, email: admin.email, name: admin.name ?? claims.name, kind: 'admin',
        role: admin.role, sessionId: 'firebase-' + claims.uid.slice(0, 8), source: 'firebase',
      };
    }
    // Then clients linked by userId.
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.userId, claims.uid)).limit(1);
    if (client && client.status === 'ACTIVE') {
      return {
        uid: client.id, email: client.email, name: client.name, kind: 'client',
        clientId: client.id, sessionId: 'firebase-' + claims.uid.slice(0, 8), source: 'firebase',
      };
    }
  } catch { /* ignore — return 401 below */ }

  return null;
}

/** Require an authenticated caller (admin OR client). Throws ApiError(401). */
export async function authAny(req: Request, env: Env): Promise<AuthContext> {
  const bearer = await verifyBearer(req, env);
  if (bearer) return bearer;

  // Legacy admin password.
  const pw = req.headers.get('X-TT-Admin-Password');
  const expected = adminPasswordExpected(env);
  if (pw && expected && pw === expected) {
    return { uid: 'local-admin', email: 'admin@toluenetech.com', name: 'Admin', kind: 'admin', role: 'OWNER', sessionId: 'pw-' + Date.now().toString(36), source: 'password' };
  }

  // Demo shortcut (dev only) for client endpoints.
  if (isDevMode(env) && req.headers.get('X-TT-Client-Demo') === '1') {
    const db = getDb(env);
    let [demo] = await db.select().from(schema.clients).where(eq(schema.clients.email, DEMO_CLIENT_EMAIL)).limit(1);
    if (!demo) {
      // Create the demo client lazily if not present (so dev works out of the box).
      const [row] = await db.insert(schema.clients).values({
        id: 'client-demo', name: 'Demo Client', email: DEMO_CLIENT_EMAIL,
        accessCode: DEMO_CLIENT_CODE, status: 'ACTIVE',
      }).returning();
      demo = row;
    }
    return { uid: demo.id, email: demo.email, name: demo.name, kind: 'client', clientId: demo.id, sessionId: 'demo-' + Date.now().toString(36), source: 'demo' };
  }

  throw new ApiError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
}

/** Require admin auth. */
export async function authAdmin(req: Request, env: Env): Promise<AuthContext> {
  const ctx = await authAny(req, env);
  if (ctx.kind !== 'admin') throw new ApiError({ code: 'FORBIDDEN', message: 'Admin access required.' });
  return ctx;
}

/** Require client auth. */
export async function authClient(req: Request, env: Env): Promise<AuthContext> {
  const ctx = await authAny(req, env);
  if (ctx.kind !== 'client' || !ctx.clientId) throw new ApiError({ code: 'FORBIDDEN', message: 'Client access required.' });
  return ctx;
}

/** Require a specific admin role or higher. OWNER > ADMIN > EDITOR. */
const ROLE_RANK: Record<string, number> = { OWNER: 3, ADMIN: 2, EDITOR: 1 };
export function requireRole(ctx: AuthContext, role: 'OWNER' | 'ADMIN' | 'EDITOR') {
  if (ctx.kind !== 'admin') throw new ApiError({ code: 'FORBIDDEN', message: 'Admin access required.' });
  const my = ROLE_RANK[ctx.role || 'ADMIN'] ?? 0;
  const need = ROLE_RANK[role];
  if (my < need) throw new ApiError({ code: 'FORBIDDEN', message: 'Insufficient permissions.' });
}

/**
 * Verify that `projectId` belongs to `clientId`. Throws 404 if the project
 * does not exist (so we don't leak existence to other clients); throws 403
 * if the project exists but belongs to another client. Also verifies the
 * project is not ARCHIVED unless `allowArchived` is true.
 */
export async function assertProjectOwnership(env: Env, clientId: string, projectId: string, opts: { allowArchived?: boolean } = {}) {
  const db = getDb(env);
  const [p] = await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.id, projectId)).limit(1);
  if (!p) throw new ApiError({ code: 'NOT_FOUND', message: 'Project not found.' });
  if (p.clientId !== clientId) {
    // Do not reveal existence; return 404.
    throw new ApiError({ code: 'NOT_FOUND', message: 'Project not found.' });
  }
  if (!opts.allowArchived && p.status === 'ARCHIVED') {
    // Still return 200 on read, but mutating against archived should be forbidden.
    throw new ApiError({ code: 'FORBIDDEN', message: 'Project is archived.' });
  }
  return p;
}

/**
 * Assert a record belongs to the given client project. The table must have
 * `projectId` (we look up projectId <-> clientId first). Useful for
 * milestones/tasks/messages/files.
 */
export async function assertChildOwnership(env: Env, clientId: string, projectId: string) {
  return assertProjectOwnership(env, clientId, projectId);
}

/** Look up a client by email (constant-timed compare for access code). */
export async function findClientByEmail(env: Env, email: string) {
  const db = getDb(env);
  const [c] = await db.select().from(schema.clients).where(eq(schema.clients.email, email.toLowerCase())).limit(1);
  return c ?? null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyAccessCode(expected: string | null | undefined, provided: string): boolean {
  if (!expected) return false;
  return timingSafeEqual(expected.trim().toUpperCase(), provided.trim().toUpperCase());
}

export function generateAccessCode(): string {
  // 6-char uppercase alphanumeric, no ambiguous chars.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 6; i++) out += alphabet[arr[i] % alphabet.length];
  return out;
}

export { isDevMode, DEMO_CLIENT_EMAIL, DEMO_CLIENT_CODE, LEGACY_DEFAULT_ADMIN_PASSWORD };
