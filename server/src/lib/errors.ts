/**
 * Standard error response + structured logging.
 *
 * Every error surfaced to clients uses:
 *   { success: false, error: { code, message } }
 *
 * Internal details (SQL, stack, secret values) are stripped before response
 * but logged server-side via `logError()` for diagnostics.
 */
import type { Context } from 'hono';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ApiErrorInput {
  code: ErrorCode;
  message: string;      // Safe, client-facing message.
  status?: number;      // defaults derived from code.
  cause?: unknown;      // Internal error — never returned to client.
  details?: unknown;    // Validation errors etc. (safe to expose).
}

const CODE_TO_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly cause?: unknown;
  readonly details?: unknown;
  constructor(input: ApiErrorInput) {
    super(input.message);
    this.code = input.code;
    this.status = input.status ?? CODE_TO_STATUS[input.code];
    this.cause = input.cause;
    this.details = input.details;
  }
}

/** Write a structured log line without leaking secrets. */
export function logError(c: Context, err: unknown, meta: Record<string, unknown> = {}) {
  const safe = err instanceof ApiError
    ? { code: err.code, message: err.message, details: err.details }
    : { message: err instanceof Error ? err.message : String(err) };
  const line = {
    ts: new Date().toISOString(),
    method: c.req.method,
    path: c.req.path,
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown',
    err: safe,
    ...meta,
  };
  console.log(JSON.stringify(line));
}

export function jsonError(c: Context, err: unknown) {
  if (err instanceof ApiError) {
    logError(c, err);
    const body: Record<string, unknown> = { success: false, error: { code: err.code, message: err.message } };
    if (err.details) body.error = { ...(body.error as Record<string, unknown>), details: err.details };
    return c.json(body, err.status as any);
  }
  const message = err instanceof Error ? err.message : 'Unexpected error.';
  logError(c, err, { internalMessage: message });
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }, 500 as any);
}

export function okJson<T>(c: Context, data: T, status = 200) {
  return c.json({ success: true, data }, status as any);
}

export function createdJson<T>(c: Context, data: T) {
  return okJson(c, data, 201);
}
