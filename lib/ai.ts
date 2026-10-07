/**
 * AI Lab client — talks to the Worker backend (never exposes API keys to
 * the browser). All LLM calls go through /ai-lab/* routes which share the
 * same Dahl provider / model router / fallback chain as Tolesh.
 */
import { apiBase } from './api';

export interface AIResponse {
  text: string;
  mode: 'live';
  model?: string;
  usedFallback?: boolean;
  error?: string;
}

export interface PlannerInput {
  projectIdea: string;
  projectType?: string;
  targetUsers?: string;
  businessType?: string;
  desiredFeatures?: string;
  platform?: string;
  budget?: string;
  deadline?: string;
  integrations?: string;
  technicalRequirements?: string;
  designRequirements?: string;
  notes?: string;
}

async function postJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({})) as any;
  if (!res.ok) {
    throw new Error(data?.error || `AI request failed (${res.status})`);
  }
  return data as T;
}

export async function planProject(input: PlannerInput | string, signal?: AbortSignal): Promise<AIResponse> {
  const body = typeof input === 'string' ? { brief: input } : input;
  const data = await postJSON<{ reply: string; model?: string; usedFallback?: boolean }>('/ai-lab/planner', body, signal);
  return { text: data.reply, mode: 'live', model: data.model, usedFallback: data.usedFallback };
}

export async function businessAdvice(question: string, signal?: AbortSignal): Promise<AIResponse> {
  const data = await postJSON<{ reply: string; model?: string; usedFallback?: boolean }>('/ai-lab/advisor', { question }, signal);
  return { text: data.reply, mode: 'live', model: data.model, usedFallback: data.usedFallback };
}

export async function analyzeIdea(idea: string, signal?: AbortSignal): Promise<AIResponse> {
  const data = await postJSON<{ reply: string; model?: string; usedFallback?: boolean }>('/ai-lab/idea', { idea }, signal);
  return { text: data.reply, mode: 'live', model: data.model, usedFallback: data.usedFallback };
}
