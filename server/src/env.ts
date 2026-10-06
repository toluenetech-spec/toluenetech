export interface Env {
  ASSETS: R2Bucket;

  // Secrets (set via wrangler secret or .dev.vars)
  DATABASE_URL: string;
  AI_PROVIDER?: 'openai' | 'anthropic' | 'gemini' | 'dahl';
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_MODEL_PUBLIC?: string;  // override for public visitor chat (faster/cheaper model)
  ASSISTANT_SECRET?: string;
  CORS_ORIGIN?: string;
  R2_PUBLIC_URL?: string;
  FIREBASE_PROJECT_ID?: string;
}
