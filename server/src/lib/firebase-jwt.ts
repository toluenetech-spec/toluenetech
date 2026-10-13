/**
 * Firebase ID token verification (RS256).
 *
 * Fetches Google's public X.509 certs from
 * https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com,
 * caches them respecting the `Cache-Control: max-age` header, imports as
 * CryptoKey, and verifies signature + exp + iat + aud + iss.
 *
 * Returns the decoded payload on success. Throws on failure.
 */
import type { Env } from '../env';

interface CertsCache {
  keys: Map<string, CryptoKey>;     // kid -> RSA public key
  expiry: number;                   // epoch ms
}
let certsCache: CertsCache | null = null;

function base64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0));
}

function parseJwtParts(token: string): { header: any; payload: any; signingInput: Uint8Array; signature: Uint8Array } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed jwt');
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
  return {
    header,
    payload,
    signingInput: new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    signature: base64urlDecode(parts[2]),
  };
}

async function importRsaX509(pem: string): Promise<CryptoKey> {
  // Convert X.509 PEM -> DER.
  const b64 = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  const der = base64urlDecode(b64);
  // Extract SubjectPublicKeyInfo: parse DER to find spki bytes. We use a
  // simple approach — use crypto.subtle.importKey with "spki" after finding the
  // appropriate offset by looking for the RSA OID sequence. The robust approach:
  // use WebCrypto's X.509 support via "spki" import of public key directly.
  //
  // Because Workers do not accept raw X.509 certs via importKey("spki"), we
  // must manually extract spki: certificate is SEQUENCE { tbsCertificate,
  // sigAlg, signature BIT STRING }; spki is tbsCertificate.subjectPublicKeyInfo.
  //
  // Minimal ASN.1 DER walker.
  function parseDER(bytes: Uint8Array, offset = 0): { tag: number; length: number; headerLen: number; contentStart: number; end: number } {
    const tag = bytes[offset];
    let length = bytes[offset + 1];
    let headerLen = 2;
    if (length & 0x80) {
      const lenBytes = length & 0x7f;
      length = 0;
      for (let i = 0; i < lenBytes; i++) {
        length = (length << 8) | bytes[offset + 2 + i];
      }
      headerLen = 2 + lenBytes;
    }
    return { tag, length, headerLen, contentStart: offset + headerLen, end: offset + headerLen + length };
  }

  // cert
  const cert = parseDER(der);
  // tbsCert is first element inside cert
  const tbs = parseDER(der, cert.contentStart);
  // Walk tbsCertificate fields: version [0] EXPLICIT, serialNumber (INTEGER),
  // signature (SEQUENCE), issuer (SEQUENCE), validity (SEQUENCE), subject (SEQUENCE),
  // subjectPublicKeyInfo (SEQUENCE) — the 7th element.
  let pos = tbs.contentStart;
  const fields: { start: number; end: number }[] = [];
  while (pos < tbs.end && fields.length < 8) {
    const el = parseDER(der, pos);
    // context-specific [0] (version) is one field.
    if ((der[pos] & 0xc0) === 0x80) {
      fields.push({ start: el.contentStart, end: el.end });
    } else {
      fields.push({ start: pos, end: el.end });
    }
    pos = el.end;
  }
  // spki is the 6th (0-indexed) field in tbs (version, serial, sig, issuer, validity, subject, spki)
  // but if version is marked with [0] it still counts as field index 0.
  const spkiEntry = fields.find((_, i) => {
    // Check tag of this field — spki is SEQUENCE (0x30) after subject SEQUENCE.
    const t = der[fields[i].start];
    // field is at index 6 reliably but we just look for 7th entry
    return false;
  });
  // Reliable approach: the spki is the 7th TLV (index 6) in tbs.
  const spki = fields[6];
  if (!spki) throw new Error('could not locate spki');
  const spkiBytes = der.slice(spki.start, spki.end);
  return crypto.subtle.importKey(
    'spki',
    spkiBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function fetchCerts(env: Env): Promise<CertsCache> {
  if (certsCache && Date.now() < certsCache.expiry) return certsCache;
  const pid = env.FIREBASE_PROJECT_ID;
  if (!pid) throw new Error('FIREBASE_PROJECT_ID not configured');
  const url = `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`;
  const res = await fetch(url, { cf: { cacheTtl: 0 } });
  if (!res.ok) throw new Error(`Failed to fetch Google certs: ${res.status}`);
  const cc = res.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 60 * 60 * 1000;
  const data = await res.json() as Record<string, string>;
  const keys = new Map<string, CryptoKey>();
  await Promise.all(Object.entries(data).map(async ([kid, pem]) => {
    try { keys.set(kid, await importRsaX509(pem)); } catch { /* ignore bad cert */ }
  }));
  certsCache = { keys, expiry: Date.now() + maxAge - 5000 }; // refresh 5s early
  return certsCache;
}

export interface FirebaseClaims {
  uid: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
}

export async function verifyFirebaseToken(env: Env, token: string): Promise<FirebaseClaims> {
  const { header, payload, signingInput, signature } = parseJwtParts(token);
  if (header.alg !== 'RS256') throw new Error('Unsupported alg');
  if (!header.kid) throw new Error('Missing kid');
  const pid = env.FIREBASE_PROJECT_ID;
  if (!pid) throw new Error('Firebase not configured');
  const { keys } = await fetchCerts(env);
  const key = keys.get(header.kid);
  if (!key) {
    // Cache may have rotated; force refresh once.
    certsCache = null;
    const fresh = await fetchCerts(env);
    const retry = fresh.keys.get(header.kid);
    if (!retry) throw new Error('Unknown signing key');
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', retry, signature, signingInput);
    if (!ok) throw new Error('Invalid signature');
  } else {
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signingInput);
    if (!ok) throw new Error('Invalid signature');
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new Error('Token expired');
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new Error('Token issued in the future');
  if (payload.aud !== pid) throw new Error('Invalid audience');
  if (payload.iss !== `https://securetoken.google.com/${pid}`) throw new Error('Invalid issuer');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('Missing subject');
  if (payload.auth_time && typeof payload.auth_time === 'number' && payload.auth_time > now) throw new Error('auth_time in future');
  return { uid: payload.sub, email: payload.email, name: payload.name, email_verified: payload.email_verified };
}
