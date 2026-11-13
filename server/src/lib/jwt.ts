/**
 * Minimal HMAC-SHA256 JWT signer/verifier for internal session tokens.
 *
 * We use HMAC (HS256) rather than RSA because the Worker is the sole issuer
 * and verifier of these session tokens — no third party needs to verify them.
 * This is simpler than asymmetric signing and avoids PEM/cert management.
 *
 * For Firebase Auth tokens (admin users signing in with Firebase), we verify
 * against Google's JWKS using RSA-SHA256 in auth.ts.
 */
import type { Env } from '../env';

export interface SessionPayload {
  sub: string;            // admin uid or client id
  email?: string;
  name?: string;
  kind: 'admin' | 'client';
  role?: string;          // OWNER/ADMIN/EDITOR (admin)
  clientId?: string;      // for client sessions
  iat: number;
  exp: number;
  sid: string;            // session id (for revocation later)
}

const HS256 = { name: 'HMAC', hash: 'SHA-256' };

function enc(data: Uint8Array | string) {
  const u = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function dec(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0));
}

function isDev(env: Env): boolean {
  return (env.DEV_MODE ?? 'false') === 'true';
}

/**
 * Resolve (and cache) the signing secret. If JWT_SECRET is set, use it;
 * otherwise generate a per-isolate random secret (sessions reset on cold
 * start — safe for dev, never production).
 */
let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function getSigningKey(env: Env): Promise<CryptoKey> {
  const secret = env.JWT_SECRET;
  if (!secret) {
    // Dev fallback — warn loudly and use ephemeral key.
    if (!isDev(env) && !cachedSecret) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), warn: 'JWT_SECRET not set; using ephemeral key. Sessions will reset on cold start. Set JWT_SECRET in production.' }));
    }
    const ephemeral = cachedSecret ?? crypto.randomUUID();
    cachedSecret = ephemeral;
    return crypto.subtle.importKey('raw', new TextEncoder().encode(ephemeral), HS256, false, ['sign', 'verify']);
  }
  if (cachedKey && cachedSecret === secret) return cachedKey;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), HS256, false, ['sign', 'verify']);
  cachedKey = key;
  cachedSecret = secret;
  return key;
}

export async function signToken(env: Env, payload: Omit<SessionPayload, 'iat' | 'exp'> & { exp?: number }, ttlSeconds: number): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { exp: iat + ttlSeconds, ...payload, iat };
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = enc(JSON.stringify(header));
  const p = enc(JSON.stringify(full));
  const key = await getSigningKey(env);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${h}.${p}`)));
  return `${h}.${p}.${enc(sig)}`;
}

export async function verifyToken(env: Env, token: string): Promise<SessionPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const key = await getSigningKey(env);
  const ok = await crypto.subtle.verify(
    'HMAC', key,
    dec(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new Error('Invalid signature');
  let payload: SessionPayload;
  try { payload = JSON.parse(new TextDecoder().decode(dec(parts[1]))); } catch { throw new Error('Malformed payload'); }
  if (typeof payload !== 'object' || !payload) throw new Error('Malformed payload');
  if (!payload.sub || !payload.kind) throw new Error('Missing required claims');
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  if (typeof payload.iat !== 'number') throw new Error('Missing iat');
  return payload;
}
