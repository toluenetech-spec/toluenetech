import type { Env } from '../env';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB hard cap per upload
export const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'video/mp4', 'video/webm',
  'application/pdf', 'application/zip',
  'text/plain', 'text/markdown',
]);

/**
 * Validate an upload's mime type and declared size.
 * Returns null on success, or a user-safe error string.
 */
export function validateUpload(mime: string | null, size: number | null, opts: { maxBytes?: number; allowed?: Set<string> } = {}): string | null {
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;
  const allowed = opts.allowed ?? ALLOWED_MIME;
  if (!mime || !allowed.has(mime)) return 'Unsupported file type.';
  if (size != null && size > maxBytes) return `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`;
  return null;
}

export function publicUrlFor(env: Env, key: string): string {
  const base = (env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!base) {
    // No public URL configured; private files still work via /files/:id signed access.
    return '';
  }
  return `${base}/${key}`;
}

export function makeKey(prefix: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const rand = crypto.randomUUID().slice(0, 8);
  return `${prefix}/${Date.now()}-${rand}-${safe}`;
}

export const limits = { maxBytes: MAX_UPLOAD_BYTES };

/**
 * Generate a presigned GET URL for an R2 object using the S3-compatible API
 * (HMAC-SHA256 sigv4). Returns null if any of the R2 S3 credentials are
 * missing (fall back to proxying bytes through the Worker).
 */
export async function signedGetUrl(env: Env, bucket: string, key: string, ttlSeconds = 3600): Promise<string | null> {
  const endpoint = env.R2_ENDPOINT;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME ?? bucket;
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;

  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = amz(now);
  const datestamp = amzDate.slice(0, 8);

  const host = endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const canonicalUri = '/' + encodeR2Key(key);
  const credential = `${accessKeyId}/${datestamp}/${region}/${service}/aws4_request`;
  const canonicalQuery = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(ttlSeconds),
    'X-Amz-SignedHeaders': 'host',
  }).toString();
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    `host:${bucketName}.${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${datestamp}/${region}/${service}/aws4_request`,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(secretAccessKey, datestamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  return `https://${bucketName}.${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function amz(d: Date): string {
  return d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
}
function encodeR2Key(k: string): string {
  return k.split('/').map(encodeURIComponent).join('/').replace(/%20/g, '+');
}
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const buf = await crypto.subtle.sign('HMAC', await importHmacKey(key), new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function importHmacKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const kDate = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', enc.encode('AWS4' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(dateStamp));
  const kRegion = await crypto.subtle.sign('HMAC', await importHmacKey(kDate), enc.encode(region));
  const kService = await crypto.subtle.sign('HMAC', await importHmacKey(kRegion), enc.encode(service));
  const kSigning = await crypto.subtle.sign('HMAC', await importHmacKey(kService), enc.encode('aws4_request'));
  return kSigning;
}
