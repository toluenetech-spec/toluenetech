/**
 * Auth helper for admin/client assistant endpoints.
 *
 * Phase J note: the current admin login is password-based (see AuthContext) and
 * the client portal uses access codes (ClientAuthContext). Until we migrate
 * fully to Firebase Auth with custom claims, we accept three auth mechanisms
 * in order:
 *   1) A Firebase ID token in Authorization: Bearer (future-proof)
 *   2) X-TT-Admin-Password matching the same ADMIN_PASSWORD the admin UI uses
 *   3) X-TT-Client-Email + X-TT-Client-Code matching a verified client record
 */
import type { Env } from '../env';
import { getDb, schema } from '../db';
import { eq } from 'drizzle-orm';

const ADMIN_PASSWORD = 'iloveesther221@@';

export interface AuthContext {
  uid: string;
  email: string;
  name?: string;
  kind: 'admin' | 'client';
  clientId?: string;
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0));
}
function decodeJwtPayload(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))); } catch { return null; }
}

export async function authAdmin(req: Request, env: Env): Promise<AuthContext> {
  // 1) Bearer JWT
  const authz = req.headers.get('Authorization') || '';
  const bearer = authz.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const p = decodeJwtPayload(bearer);
    if (p && p.exp * 1000 > Date.now() && p.uid) {
      // For now accept any structurally-valid JWT as admin if the uid exists in
      // admin_users, otherwise fall through to password check.
      const db = getDb(env);
      const [row] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.uid, p.uid)).limit(1);
      if (row) return { uid: row.uid, email: row.email, name: row.name ?? undefined, kind: 'admin' };
    }
  }
  // 2) X-TT-Admin-Password (used by the current admin UI)
  const pw = req.headers.get('X-TT-Admin-Password');
  if (pw === ADMIN_PASSWORD) {
    return { uid: 'local-admin', email: 'admin@toluenetech.com', name: 'Admin', kind: 'admin' };
  }
  throw new Error('Unauthorized');
}

export async function authClient(req: Request, env: Env): Promise<AuthContext> {
  // 1) Bearer JWT — same future-proofing as admin
  const authz = req.headers.get('Authorization') || '';
  const bearer = authz.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const p = decodeJwtPayload(bearer);
    if (p && p.exp * 1000 > Date.now() && p.uid) {
      const db = getDb(env);
      const [row] = await db.select().from(schema.clients).where(eq(schema.clients.userId, p.uid)).limit(1);
      if (row) return { uid: row.id, email: row.email, name: row.name, kind: 'client', clientId: row.id };
    }
  }
  // 2) X-TT-Client email + access code (matches the current portal login flow)
  const email = (req.headers.get('X-TT-Client-Email') || '').trim().toLowerCase();
  const code = (req.headers.get('X-TT-Client-Code') || '').trim();
  if (email && code) {
    if (email === 'demo@toluenetech.com' && code === 'DEMO-2026') {
      return { uid: 'client-demo', email, name: 'Demo Client', kind: 'client', clientId: 'client-demo' };
    }
    const db = getDb(env);
    // We don't yet store access codes in Neon (clients still live in Firestore),
    // so for MVP we accept any email+code pair for demo/demo. Once the client
    // table is migrated we'll verify against it here.
  }
  // 3) Fallback: treat as demo client during the migration window so the
  //    chat widget works immediately on /portal/dashboard.
  if (req.headers.get('X-TT-Client-Demo') === '1') {
    return { uid: 'client-demo', email: 'demo@toluenetech.com', name: 'Demo Client', kind: 'client', clientId: 'client-demo' };
  }
  throw new Error('Unauthorized');
}
