/**
 * Lightweight AI client used by the AI Lab.
 *
 * SECURITY: In a pure-static SPA build there is no server-side layer, so the
 * Gemini API key would have to ship to the browser. To avoid exposing a real
 * secret, the app runs in one of two modes:
 *
 *   1. DEMO MODE (default, safe)  — returns templated, deterministic responses
 *      based on the user's input. No external API calls, no keys, no cost.
 *   2. LIVE MODE (opt-in)         — if `window.__TT_GEMINI_KEY` is set (e.g. via
 *      the browser console for a local demo), the Gemini REST API is called.
 *
 * The key is never read from the built bundle; the placeholder in .env.local is
 * explicitly "PLACEHOLDER_API_KEY". In production the AI Lab will run in demo
 * mode unless a server-side proxy is added.
 */

export interface AIResponse {
  text: string;
  mode: 'demo' | 'live';
  error?: string;
}

const HAS_KEY = () =>
  typeof window !== 'undefined' &&
  typeof (window as any).__TT_GEMINI_KEY === 'string' &&
  (window as any).__TT_GEMINI_KEY.length > 8 &&
  (window as any).__TT_GEMINI_KEY !== 'PLACEHOLDER_API_KEY';

async function callGemini(systemPrompt: string, userInput: string): Promise<string> {
  const key = (window as any).__TT_GEMINI_KEY as string;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nUSER: ${userInput}` }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 700 },
      }),
    },
  );
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from AI');
  return text.trim();
}

/* ---------------- Demo responses ---------------- */

function demoPlanner(input: string): string {
  const lower = input.toLowerCase();
  const tags: string[] = [];
  if (/chatbot|support|customer|question/.test(lower)) tags.push('AI customer-support chatbot (trained on your content)');
  if (/automat|workflow|crm|email|invoice/.test(lower)) tags.push('Workflow automation across your existing tools');
  if (/search|find|knowledge|doc/.test(lower)) tags.push('Semantic AI search over your docs/knowledge base');
  if (/restaurant|menu|order|book/.test(lower)) tags.push('Reservation / ordering assistant for customers');
  if (/lead|sales|qualif/.test(lower)) tags.push('Lead-qualification agent for your website');
  if (/ecommerce|shop|product/.test(lower)) tags.push('AI product recommendations & search');
  if (tags.length === 0) tags.push('LLM-powered assistant tailored to your use case');

  return `Based on what you described, here are practical solutions Toluene Tech could build for you:

${tags.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Suggested next steps:
• Discovery call to map goals, data sources and integrations
• Define success metrics and guardrails
• Build an MVP in 2–4 weeks
• Measure, iterate, then scale

Want Toluene Tech to build this? Click "Start a Project" below and we'll reply within 2 hours.`;
}

function demoAdvisor(input: string): string {
  const lower = input.toLowerCase();
  const list = [
    'Start with a clear problem statement — what specific task gets faster/easier with AI?',
    'Audit your data quality first — garbage in, garbage out applies to LLM features.',
    'Ship a narrow MVP (one job, one workflow) before expanding scope.',
  ];
  if (/cost|price|budget/.test(lower)) list.push('For AI projects, budget for model usage, retraining and ongoing monitoring — not just build cost.');
  if (/chatbot|support/.test(lower)) list.push('Add human-handoff early; the best bots know when to escalate.');
  if (/automation|workflow/.test(lower)) list.push('Map the existing workflow step by step before automating anything.');
  if (/rag|search|knowledge/.test(lower)) list.push('Clean, chunk and tag source documents before building retrieval.');
  return `Here's AI/automation advice based on your question:\n\n${list.map((l, i) => `• ${l}`).join('\n')}\n\nNeed help implementing this? Talk to our team.`;
}

function demoIdea(input: string): string {
  const angle = input.trim().length > 5 ? `\n\nStrengths of your idea "${input.slice(0, 120)}${input.length > 120 ? '…' : ''}":\n• Clear pain-point framing potential\n• Strong starting point for an MVP${input.length > 60 ? '\n• Scope is large enough to deliver real value' : ''}` : '';
  return `Idea analysis${angle}

Suggested next steps:
1. Validate the pain-point with 5–10 potential users
2. Define the smallest useful MVP
3. Estimate effort and pick a build partner (we can help!)

Toluene Tech offers a free 30-minute discovery call to help you scope this.`;
}

/* ---------------- Public API ---------------- */

export async function planProject(brief: string): Promise<AIResponse> {
  const prompt = `You are a solutions architect at Toluene Tech (a digital studio offering web design, development, apps, AI and automation). A user describes what they want. Return 4–6 concrete solutions Toluene Tech could build for them, plus 3 next steps. Be specific, practical, and avoid hype. Do not invent numbers. End with a short call to action to start a project.`;
  try {
    if (HAS_KEY()) return { text: await callGemini(prompt, brief), mode: 'live' };
  } catch (e) { /* fall through to demo */ }
  return { text: demoPlanner(brief), mode: 'demo' };
}

export async function businessAdvice(question: string): Promise<AIResponse> {
  const prompt = `You are a senior technical advisor at Toluene Tech. Give practical, grounded advice about AI, automation, and digital product development. Be concise (under 200 words), honest about limitations, and end with a suggestion about how Toluene Tech could help.`;
  try {
    if (HAS_KEY()) return { text: await callGemini(prompt, question), mode: 'live' };
  } catch (e) { /* fall through */ }
  return { text: demoAdvisor(question), mode: 'demo' };
}

export async function analyzeIdea(idea: string): Promise<AIResponse> {
  const prompt = `You are a product strategist at Toluene Tech. Analyse the user's idea. Point out strengths, risks and an MVP approach. Be concrete.`;
  try {
    if (HAS_KEY()) return { text: await callGemini(prompt, idea), mode: 'live' };
  } catch (e) { /* fall through */ }
  return { text: demoIdea(idea), mode: 'demo' };
}
