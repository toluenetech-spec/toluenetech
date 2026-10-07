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
  // Per-surface overrides (admin-selectable via Admin AI Control)
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
  ASSISTANT_SECRET?: string;
  ADMIN_PASSWORD?: string;
  CORS_ORIGIN?: string;
  R2_PUBLIC_URL?: string;
  FIREBASE_PROJECT_ID?: string;
}
