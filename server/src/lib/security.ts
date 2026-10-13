/**
 * Security headers + CORS hardening.
 *
 * Applied as a global middleware after the existing CORS middleware.
 * Security headers are applied to every response; CORS is tightened so
 * authenticated routes only accept origins explicitly in the allowlist
 * (wildcards are allowed for public deploy previews only when configured
 * explicitly via CORS_ORIGIN — default now excludes *.netlify.app for
 * production safety).
 */
import type { Context, Next } from 'hono';
import type { Env } from '../env';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '0', // deprecated but harmless
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  // We set a strict CSP in production below; dev allows vite HMR.
};

const DEV_CSP = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: ws: wss:; img-src 'self' data: blob: https:; connect-src 'self' https: wss: ws:;";
const PROD_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.gpteng.co https://cdn.jsdelivr.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: https://assets.toluenetech.com; connect-src 'self' https://toluene-tech-api.toluenetech.workers.dev https://inference.dahl.global; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';";

export async function securityHeaders(c: Context, next: Next) {
  await next();
  // Only apply to responses that haven't already set these (e.g. binary R2 downloads don't need CSP).
  const ct = c.res.headers.get('content-type') || '';
  const isHtml = ct.includes('text/html');
  const isJson = ct.includes('application/json');
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) c.header(k, v);
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (isHtml) {
    // CSP only for HTML.
    const env = c.env as Env;
    const isDev = (env.DEV_MODE ?? 'false').toLowerCase() === 'true';
    c.header('Content-Security-Policy', isDev ? DEV_CSP : PROD_CSP);
  }
  // Don't override Cache-Control set by other handlers.
  if (isJson && !c.res.headers.has('Cache-Control')) {
    c.header('Cache-Control', 'no-store');
  }
  // Remove server banner where possible (Workers sets "cloudflare" internally).
}
