export interface Env {
  ASSETS: R2Bucket;

  // Secrets (set via wrangler secret or .dev.vars)
  DATABASE_URL: string;
  AI_PROVIDER?: 'openai' | 'anthropic' | 'gemini';
  AI_API_KEY?: string;
  AI_MODEL?: string;
  ASSISTANT_SECRET?: string;
  CORS_ORIGIN?: string;
  R2_PUBLIC_URL?: string;
  FIREBASE_PROJECT_ID?: string;
}
