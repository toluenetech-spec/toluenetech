export interface Env {
  ASSETS: R2Bucket;

  // Secrets (set via wrangler secret or .dev.vars)
  DATABASE_URL: string;

  // AI provider
  AI_PROVIDER?: 'openai' | 'anthropic' | 'gemini' | 'dahl';
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_MODEL_PUBLIC?: string;
  AI_MODEL_REASONING?: string;
  AI_MODEL_FALLBACK?: string;
  // Per-surface overrides (env-level baseline; DB ai_config overrides these)
  AI_MODEL_CLIENT?: string;
  AI_MODEL_PLANNER?: string;
  AI_MODEL_ADVISOR?: string;
  AI_MODEL_IDEA?: string;
  AI_MODEL_FALLBACK_PUBLIC?: string;
  AI_MODEL_FALLBACK_ADMIN?: string;
  AI_MODEL_FALLBACK_CLIENT?: string;
  AI_MODEL_FALLBACK_PLANNER?: string;
  AI_MODEL_FALLBACK_ADVISOR?: string;
  AI_MODEL_FALLBACK_IDEA?: string;
  AI_FALLBACK_PUBLIC_ENABLED?: string;
  AI_FALLBACK_ADMIN_ENABLED?: string;
  AI_FALLBACK_CLIENT_ENABLED?: string;
  AI_FALLBACK_PLANNER_ENABLED?: string;
  AI_FALLBACK_ADVISOR_ENABLED?: string;
  AI_FALLBACK_IDEA_ENABLED?: string;

  // Authentication
  // JWT_SECRET is REQUIRED in production for signing session tokens. If not
  // set, a per-isolate random secret is used (sessions reset on cold start —
  // acceptable for dev but NOT for production).
  JWT_SECRET?: string;
  // ADMIN_PASSWORD is the shared admin password accepted via X-TT-Admin-Password
  // (legacy) and POST /admin/login. If unset in production, the default is NOT
  // used — admin auth falls back to Firebase JWT only.
  ADMIN_PASSWORD?: string;
  // DEV_MODE enables the demo-client login (demo@toluenetech.com / DEMO-2026)
  // and the legacy default password fallback. Must be false/unset in prod.
  DEV_MODE?: string;
  FIREBASE_PROJECT_ID?: string;

  ASSISTANT_SECRET?: string;
  CORS_ORIGIN?: string;
  R2_PUBLIC_URL?: string;
  // R2_ENDPOINT is only needed to produce signed download URLs (S3-compat API).
  // Format: https://<accountid>.r2.cloudflarestorage.com
  R2_ENDPOINT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;

  // Flutterwave (payments) — optional; if absent, payment endpoints return 503
  // rather than creating fake records. FLW_PUBLIC_KEY is safe in the browser
  // for initialising the checkout; FLW_SECRET_KEY stays server-only.
  FLW_PUBLIC_KEY?: string;
  FLW_SECRET_KEY?: string;
  FLW_SECRET_HASH?: string;
}
