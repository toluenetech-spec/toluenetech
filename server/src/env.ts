export interface Env {
  ASSETS: R2Bucket;

  // Secrets (set via wrangler secret or .dev.vars)
  DATABASE_URL: string;
  AI_PROVIDER?: 'openai' | 'anthropic' | 'gemini' | 'dahl';
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_MODEL_PUBLIC?: string;
  AI_MODEL_FALLBACK?: string;
  ASSISTANT_SECRET?: string;
  ADMIN_PASSWORD?: string;
  CORS_ORIGIN?: string;
  R2_PUBLIC_URL?: string;
  FIREBASE_PROJECT_ID?: string;
}
