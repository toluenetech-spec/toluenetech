export interface Env {
  ASSETS: R2Bucket;

  // Secrets (set via wrangler secret or .dev.vars)
  DATABASE_URL: string;
  AI_PROVIDER?: 'openai' | 'anthropic' | 'gemini' | 'dahl';
  AI_API_KEY?: string;
  AI_MODEL?: string;              // override standard-tier model
  AI_MODEL_PUBLIC?: string;       // override fast/public tier (default: DeepSeek-V4-Flash-0731)
  AI_MODEL_REASONING?: string;    // override reasoning tier (default: MiniMaxAI/MiniMax-M2.7)
  AI_MODEL_FALLBACK?: string;     // override fallback (default: zai-org/GLM-5.3-Flash)
  ASSISTANT_SECRET?: string;
  ADMIN_PASSWORD?: string;
  CORS_ORIGIN?: string;
  R2_PUBLIC_URL?: string;
  FIREBASE_PROJECT_ID?: string;
}
