import type { Env } from '../env';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB hard cap per upload
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm',
  'application/pdf', 'application/zip',
  'text/plain', 'text/markdown',
]);

export interface SignedUploadResult {
  uploadUrl: string;   // PUT URL
  publicUrl: string;   // where the asset will live after upload
  r2Key: string;       // storage key
  expiresIn: number;   // seconds
}

/**
 * Workers R2 binding does not natively support pre-signed PUT URLs the way S3 does,
 * but we can proxy uploads through a Worker endpoint that validates mime+size.
 * For production at scale, switch to direct S3-compatible signed URLs using the
 * S3 API compatibility layer (https://<account>.r2.cloudflarestorage.com/...) with
 * an HMAC-SHA256 signature. For the MVP we expose an authenticated PUT endpoint
 * at /api/media/upload (admin only) — simple and safe.
 */
export function validateUpload(mime: string | null, size: number | null): string | null {
  if (!mime || !ALLOWED_MIME.has(mime)) return 'Unsupported file type.';
  if (size != null && size > MAX_UPLOAD_BYTES) return 'File too large (max 20 MB).';
  return null;
}

export function publicUrlFor(env: Env, key: string): string {
  const base = env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? '';
  return base ? `${base}/${key}` : `https://assets.toluenetech.com/${key}`;
}

export function makeKey(prefix: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}/${Date.now()}-${rand}-${safe}`;
}

export const limits = { maxBytes: MAX_UPLOAD_BYTES };
