/**
 * Authentication endpoints (login/logout for admin + client).
 *
 *   POST /auth/admin/login     { password } -> { token, user }
 *   POST /auth/admin/logout    (no-op; clients discard token; logged in audit)
 *   POST /auth/client/login    { email, accessCode } -> { token, client }
 *   GET  /auth/me              -> identity for whichever kind the token is
 *
 * All tokens are short-lived HMAC-SHA256 JWTs signed with JWT_SECRET.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { signToken } from '../lib/jwt';
import { ApiError } from '../lib/errors';
import { writeAudit } from '../lib/audit';
import { rateLimit, clientIp } from '../lib/rate-limit';
import { v, shape } from '../lib/validate';
import {
  authAny, isDevMode,
  findClientByEmail, verifyAccessCode, generateAccessCode,
  DEMO_CLIENT_EMAIL, DEMO_CLIENT_CODE, adminPasswordExpected,
  type AuthContext,
} from '../lib/auth';

const app = new Hono<{ Bindings: Env }>();

const ADMIN_TTL = 60 * 60 * 8;      // 8h
const CLIENT_TTL = 60 * 60 * 24 * 7; // 7d

app.post('/admin/login', async (c) => {
  const env = c.env as Env;
  const ip = clientIp(c.req.raw);
  const rl = rateLimit(`admin-login:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) throw new ApiError({ code: 'RATE_LIMITED', message: 'Too many login attempts — wait a minute.' });

  let body: unknown;
  try { body = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON body.' }); }
  const parsed = shape({ password: v.string({ min: 1, max: 200 }) }, body);
  if (!parsed.ok) throw new ApiError({ code: 'VALIDATION_ERROR', message: parsed.message, details: { field: parsed.field } });

  const expected = adminPasswordExpected(env);
  const provided = parsed.value.password;
  if (!expected) {
    writeAudit(env, { action: 'LOGIN_FAILURE', entity: 'admin_users', meta: { reason: 'no_password_configured' }, req: c.req.raw });
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Admin password is not configured on the server.' });
  }

  // Constant-time compare.
  const providedPw = String(provided);
  const expectedPw = String(expected);
  let ok = providedPw.length === expectedPw.length;
  let diff = 0;
  if (providedPw.length === expectedPw.length) {
    for (let i = 0; i < expectedPw.length; i++) diff |= providedPw.charCodeAt(i) ^ expectedPw.charCodeAt(i);
    ok = diff === 0;
  }
  if (!ok) {
    writeAudit(env, { action: 'LOGIN_FAILURE', entity: 'admin_users', meta: { ip }, req: c.req.raw });
    throw new ApiError({ code: 'UNAUTHORIZED', message: 'Incorrect password.' });
  }

  // Look up an owner record if present; otherwise issue a local-admin session.
  const db = getDb(env);
  let role = 'OWNER';
  let email = 'admin@toluenetech.com';
  let name = 'Admin';
  const [owner] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.role, 'OWNER')).limit(1);
  if (owner) { role = owner.role; email = owner.email; name = owner.name ?? owner.email; }

  const sid = crypto.randomUUID();
  const token = await signToken(env, {
    sub: 'local-admin', email, name, kind: 'admin', role, sid,
  }, ADMIN_TTL);

  writeAudit(env, { action: 'LOGIN_SUCCESS', entity: 'admin_users', entityId: 'local-admin', meta: { role, ip }, req: c.req.raw });

  return c.json({
    success: true,
    data: {
      token,
      expiresIn: ADMIN_TTL,
      user: { uid: 'local-admin', email, name, role },
    },
  }, 200);
});

app.post('/admin/logout', async (c) => {
  const env = c.env as Env;
  // JWTs are stateless — client drops the token. We log the event for audit.
  let auth: AuthContext | null = null;
  try { auth = await authAny(c.req.raw, env); } catch { auth = null; }
  if (auth) writeAudit(env, { action: 'LOGOUT', entity: 'admin_users', entityId: auth.uid, auth, req: c.req.raw });
  return c.json({ success: true, data: { ok: true } });
});

app.post('/client/login', async (c) => {
  const env = c.env as Env;
  const ip = clientIp(c.req.raw);
  const rl = rateLimit(`client-login:${ip}`, { windowMs: 60_000, max: 15 });
  if (!rl.ok) throw new ApiError({ code: 'RATE_LIMITED', message: 'Too many attempts — try again in a minute.' });

  let body: unknown;
  try { body = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON body.' }); }
  const parsed = shape({
    email: v.email({ max: 240 }),
    accessCode: v.string({ min: 4, max: 32 }),
  }, body);
  if (!parsed.ok) throw new ApiError({ code: 'VALIDATION_ERROR', message: parsed.message, details: { field: parsed.field } });

  const email = parsed.value.email!.trim().toLowerCase();
  const code = parsed.value.accessCode!.trim();

  // Demo shortcut (dev only) — transparently bootstrap demo client.
  let client;
  if (isDevMode(env) && email === DEMO_CLIENT_EMAIL && code.toUpperCase() === DEMO_CLIENT_CODE) {
    const db = getDb(env);
    client = await findClientByEmail(env, email);
    if (!client) {
      const [row] = await db.insert(schema.clients).values({
        id: 'client-demo', userId: 'demo', name: 'Demo Client', email: DEMO_CLIENT_EMAIL, status: 'ACTIVE', accessCode: DEMO_CLIENT_CODE,
      }).returning();
      client = row;
    } else if (!client.accessCode) {
      await db.update(schema.clients).set({ accessCode: DEMO_CLIENT_CODE }).where(eq(schema.clients.id, client.id));
      client.accessCode = DEMO_CLIENT_CODE;
    }
  } else {
    client = await findClientByEmail(env, email);
    if (!client || !verifyAccessCode(client.accessCode, code)) {
      writeAudit(env, { action: 'LOGIN_FAILURE', entity: 'clients', meta: { email: email.slice(0, 120), ip }, req: c.req.raw });
      throw new ApiError({ code: 'UNAUTHORIZED', message: 'Invalid email or access code.' });
    }
    if (client.status !== 'ACTIVE') {
      throw new ApiError({ code: 'FORBIDDEN', message: 'This account is not active. Contact support.' });
    }
  }

  const db = getDb(env);
  await db.update(schema.clients).set({ lastLoginAt: new Date() }).where(eq(schema.clients.id, client.id));

  const sid = crypto.randomUUID();
  const token = await signToken(env, {
    sub: client.id,
    email: client.email,
    name: client.name,
    kind: 'client',
    clientId: client.id,
    sid,
  }, CLIENT_TTL);

  writeAudit(env, { action: 'LOGIN_SUCCESS', entity: 'clients', entityId: client.id, auth: null, req: c.req.raw, meta: { ip } });

  return c.json({
    success: true,
    data: {
      token,
      expiresIn: CLIENT_TTL,
      client: { id: client.id, name: client.name, email: client.email, company: client.company, status: client.status },
    },
  });
});

app.post('/client/logout', async (c) => {
  const env = c.env as Env;
  let auth: AuthContext | null = null;
  try { auth = await authAny(c.req.raw, env); } catch { auth = null; }
  if (auth) writeAudit(env, { action: 'LOGOUT', entity: 'clients', entityId: auth.clientId ?? auth.uid, auth, req: c.req.raw });
  return c.json({ success: true, data: { ok: true } });
});

/** GET /auth/me — returns the caller's identity. Useful for bootstrapping. */
app.get('/me', async (c) => {
  const env = c.env as Env;
  const auth = await authAny(c.req.raw, env);
  if (auth.kind === 'admin') {
    return c.json({
      success: true,
      data: { kind: 'admin', uid: auth.uid, email: auth.email, name: auth.name, role: auth.role },
    });
  }
  return c.json({
    success: true,
    data: { kind: 'client', clientId: auth.clientId, email: auth.email, name: auth.name },
  });
});

export default app;

// expose generator for use in admin client routes
export { generateAccessCode };
