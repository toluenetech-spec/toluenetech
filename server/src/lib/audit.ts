/**
 * Audit logging — fire-and-forget writer to audit_logs.
 *
 * Every mutating or sensitive action should call writeAudit() after it
 * succeeds (or before, for login failures). We never block the response
 * on audit writes, but we log errors to console.
 *
 * Never log passwords, API keys, or raw request bodies containing secrets.
 */
import type { Env } from '../env';
import type { AuthContext } from './auth';
import { getDb, schema } from '../db';
import type { auditActionEnum } from '../db/schema';
import { clientIp } from './rate-limit';

type AuditAction = typeof auditActionEnum.enumValues[number];

export interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string;
  success?: boolean;
  meta?: Record<string, unknown>;
  auth?: AuthContext | null;
  req?: Request;
}

export function writeAudit(env: Env, input: AuditInput) {
  // Run without awaiting — don't block response.
  (async () => {
    try {
      const db = getDb(env);
      const ip = input.req ? clientIp(input.req) : null;
      const ua = input.req ? (input.req.headers.get('user-agent') || '').slice(0, 300) : null;
      await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        actorType: input.auth ? input.auth.kind : 'public',
        actorId: input.auth ? input.auth.uid : null,
        actorRole: input.auth ? (input.auth.role ?? input.auth.kind) : null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        success: input.success ?? true,
        ip, ua,
        meta: input.meta && sanitizeMeta(input.meta),
      });
    } catch (e) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), warn: 'audit_log_write_failed', cause: sanitizeErr(e) }));
    }
  })();
}

function sanitizeErr(e: unknown): string {
  return String(e instanceof Error ? e.message : e).slice(0, 300);
}

function sanitizeMeta(m: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const secretKeys = /password|token|secret|apikey|api_key|authorization|cookie|jwt/i;
  for (const [k, v] of Object.entries(m)) {
    if (secretKeys.test(k)) { out[k] = '[REDACTED]'; continue; }
    if (v === undefined) continue;
    // Ensure values are JSON-serializable and cap strings.
    if (typeof v === 'string') out[k] = v.slice(0, 500);
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else out[k] = JSON.stringify(v).slice(0, 500);
  }
  return out;
}
