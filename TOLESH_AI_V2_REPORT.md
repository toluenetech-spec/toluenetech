# Tolesh AI v2 — Implementation Report

**Date:** 2026-10-07
**Branch:** `arena/01a09826-toluenetech`
**Deploy:** Worker deployed successfully via GitHub Actions (run #37605669149, success in 1m29s).

---

## 1. Summary

Tolesh AI has been upgraded from a hard-coded, single-model MVP (simple prompt + bulk context dump) to a structured, multi-role, multi-model agent stack using Dahl Inference. The new system supports tool calling, tiered model routing, automatic fallbacks, structured retrieval, strict access scoping for admin and client surfaces, and a bounded tool-loop with safety guards.

The existing ToleshWidget UI, three surfaces (public/admin/client), branding (Tolesh, TT-monogram avatar, blue/amber/emerald surfaces), and response shape (`{ reply }`) are preserved, so frontend components needed no changes.

---

## 2. Architecture

```
client (ToleshChat.tsx)
   │   POST /assistant/chat   (public)
   │   POST /assistant/admin  (admin, JWT or X-TT-Admin-Password)
   │   POST /assistant/client (client, JWT or email+code or X-TT-Client-Demo)
   ▼
Hono route
   │   ─ auth (authAdmin / authClient)
   │   ─ rate-limit (per IP + per UID sliding window)
   │   ─ session upsert (assistant_sessions / assistant_messages)
   │   ─ basePublicContext() (compact CMS summary)
   │   ─ retrievePublic() (query-time keyword retrieval of relevant docs)
   ▼
getAI(env).run(...)
   │   ─ pickModel(tier) → DeepSeek-V4-Flash (fast) / MiniMax-M2.7 (standard/reasoning)
   │   ─ fallbackChain() → Kimi-K2.6 (failover on error/timeout/empty)
   │   ─ AbortController timeout (10–30s per tier)
   │   ─ tool-call loop:
   │       · sanitizeArgs (whitelist against JSON schema)
   │       · handler dispatch
   │       · per-tool try/catch (one tool fails → loop continues)
   │       · maxTurns cap (6 by default, 10 hard cap)
   │       · audit trail returned for debug
   │       · thinking-tag strip on every output
   ▼
Tool handlers (scoped per surface)
   │   PUBLIC:  search_services, search_projects, search_faqs, get_pricing,
   │            list_services, create_lead
   │   ADMIN:   + admin_list_leads, admin_get_lead, admin_stats,
   │            admin_draft_reply (DRAFT-ONLY), admin_search_projects
   │   CLIENT:  client_projects, client_milestones, client_messages, client_files
   ▼
DB (Neon Postgres via Drizzle) — no direct SQL from prompts, all access via typed handlers.
```

---

## 3. Models & Routing

| Tier       | Primary model          | Purpose                                       | Fallback         |
|------------|------------------------|-----------------------------------------------|------------------|
| `fast`     | **DeepSeek-V4-Flash**  | Greetings, short FAQ, trivial follow-ups      | Kimi-K2.6        |
| `standard` | **MiniMax-M2.7**       | Default (public/non-trivial, tool capable)    | Kimi-K2.6        |
| `reasoning`| **MiniMax-M2.7**       | Admin copilot, client assistant, lead qual    | Kimi-K2.6        |

- GLM-5.2/5.3 is NOT wired — confirmed "coming soon" in Dahl's official catalog (2026-10); an entry is reserved in `models.ts` but commented out until live.
- All model IDs are configurable via env vars: `AI_MODEL`, `AI_MODEL_PUBLIC`, `AI_MODEL_FALLBACK`.
- Provider: `dahl` (default) via `https://inference.dahl.global/v1` (OpenAI-compatible). OpenAI/Anthropic/Gemini stubs preserved for future use.

---

## 4. Tool Inventory

### Public surface
- `search_services(query)` — keyword search across published services (title, short, long description, capabilities).
- `search_projects(query)` — keyword search across published portfolio; client name only surfaced when `hasClientPermission=true`.
- `search_faqs(query)` — keyword search of published FAQs.
- `get_pricing()` — returns all published plans with feature snippets and pricing.
- `list_services()` — compact ordered list of all published services.
- `create_lead({name, email, requirements, ...})` — validates email, generates `TT-XXXX` ref, rate-limited (3/min/IP), links to assistant session via `capturedLeadId`, writes services/budget/timeline/notes. Model is instructed to call it only after capturing name + email + brief and only once per session (checked via `capturedLeadId`).

### Admin surface (inherits public tools)
- `admin_list_leads({status, limit})` — newest-first, optional status filter.
- `admin_get_lead({ref})` — full lead by TT-XXXX ref.
- `admin_stats()` — lead/project totals grouped by status.
- `admin_draft_reply({ref, tone, purpose})` — returns lead data + instructions to draft. **DRAFT ONLY — never sends.** System prompt is explicit that destructive/send/financial actions require explicit admin confirmation.
- `admin_search_projects({query})` — includes drafts.

### Client surface
- `client_projects()` — lists only the authenticated client's projects.
- `client_milestones({projectId})` — milestones only after ownership check.
- `client_messages({projectId})` — recent messages only after ownership check.
- `client_files({projectId})` — file list only after ownership check.

Every client-scoped tool does a `WHERE clientId = ctx.auth.clientId AND id = projectId` check. IDs supplied by the model are never trusted for access control.

---

## 5. Safety & Security

- **No fabrication rule:** system prompts explicitly prohibit inventing clients, projects, prices, metrics, partners, or results. Tools are the source of truth; empty tool results become "I don't see that in our data" messages.
- **Tool whitelist:** only declared tool names can be dispatched; `sanitizeArgs` drops unknown keys against JSON Schema; array lengths capped.
- **Loop protection:** max 6 tool turns per request (10 hard cap); per-call AbortController timeout (10s fast / 25–30s reasoning).
- **Thinking-tag stripping:** `<think>`, `<thinking>`, `<|begin_of_thought|>`, `[THINK]` blocks stripped before returning to user.
- **Prompt injection defense:** system prompt never reveals itself; model is instructed not to follow "ignore prior instructions" inside user content; retrieval results are presented as informational text, not as instructions; data from tools is rendered as JSON text in `[tool_result:…]` messages, not as system instructions.
- **Lead PII:** name/email asked only after intent is shown; email validated with strict regex; no duplicate leads per session.
- **Auth (hardened):**
  - Firebase ID JWTs: `exp`, `aud`, `iss`, `sub` checks + DB-membership check (only uids present in `admin_users` / `clients` are accepted).
  - `X-TT-Admin-Password`: sourced from `env.ADMIN_PASSWORD` with the legacy hardcoded value only as a fallback.
  - `X-TT-Client-Email/Code` and `X-TT-Client-Demo:1` for demo; demo client records bootstrapped in Neon on first use.
  - ClientId is always taken from the backend-auth'd identity, never from tool arguments or user prompts.
- **Rate limits:** public chat 20/min/IP; admin 30/min/UID+IP; client 30/min/UID+IP; lead creation 3/min/IP.
- **Admin copilot guard:** destructive/send/financial actions are NOT wired to tools; the prompt instructs the model to explain the proposed plan and ask for explicit confirmation.
- **CORS:** existing CORS middleware preserved; toluenetech.name.ng, Netlify, Pages.dev allowed.

---

## 6. Failure Handling

- If the primary model times out, returns empty content, or 5xxs, the client automatically falls back down the chain (primary → Kimi-K2.6).
- If all models fail, user sees a friendly "try again" message (no raw stack traces).
- If the AI provider is not configured (`AI_PROVIDER`/`AI_API_KEY` unset), the public bot directs visitors to /start-project and hello@toluenetech.com; admin/client say the feature is being set up.
- Tool errors are isolated to the offending tool (one failed tool doesn't abort the whole request).
- Response shape always `{ reply }` so the UI never breaks even on error paths.

---

## 7. Files Changed

### New
- `server/src/ai/models.ts` — Model catalog, tier routing, fallback chain.
- `server/src/ai/client.ts` — `getAI(env).run()`: tier routing, fallback, tool loop, audit, timeouts.
- `server/src/ai/client-backcompat.ts` — preserves legacy `getAIProvider()` import for the health route.
- `server/src/ai/agents/system-prompts.ts` — public/admin/client system prompts with strong anti-fabrication rules.
- `server/src/ai/providers/dahl.ts` — full `complete()` interface: tools, response_format, stream, AbortSignal.
- `server/src/ai/providers/openai.ts`, `anthropic.ts`, `gemini.ts` — extended/stubbed providers.
- `server/src/ai/strip-thinking.ts` — thinking-tag stripper.
- `server/src/ai/tools/index.ts` — tool specs + scoped handlers for all three surfaces.
- `server/src/retrieval/index.ts` — `retrievePublic`, `basePublicContext`, `adminSummary`.

### Rewritten
- `server/src/routes/assistant.ts` — public `/assistant/session`, `/assistant/chat` using the new pipeline.
- `server/src/routes/assistant-admin.ts` — admin route with auth, reasoning tier, admin tools.
- `server/src/routes/assistant-client.ts` — client route with clientId scoping, demo-bootstrap, client tools.
- `server/src/lib/auth.ts` — stricter JWT checks, `ADMIN_PASSWORD` env override, demo bootstrap helper.
- `server/src/ai/types.ts` — full `complete()` interface with tools/tool calls.
- `server/src/ai/index.ts` — re-exports new client + backcompat.
- `server/src/env.ts` — adds `AI_MODEL_FALLBACK`, `ADMIN_PASSWORD`, fixes duplicate `ASSETS` binding.

### Unchanged
- Frontend components (`ToleshWidget`, `ToleshChat`, `ToleshAvatar`) — response shape preserved (`{reply, anonId}`).
- All other public/admin/portal routes, CMS, media upload, leads form, pricing, portfolio, services, about, contact, start project, AI Lab, theme switching.

---

## 8. Testing Performed

- **TypeScript:** `tsc -p server/tsconfig.json --noEmit` clean; `tsc --noEmit` (full frontend) clean.
- **Wrangler bundle:** `wrangler deploy --dry-run` succeeds (598 KB / 136 KB gzipped).
- **Vite build:** `npm run build` succeeds (no new errors; existing chunk-size warning pre-exists).
- **Deploy:** GitHub Actions run #37605669149 deployed the worker successfully in 1m29s.
- **Adversarial checklist (code audit):**
  - Client isolation: every client tool re-queries with `clientId = ctx.auth.clientId` and `id = projectId` before returning data.
  - Prompt injection: system prompt says never to reveal it; tool output is returned as user-role messages, not system messages; sanitizeArgs drops unexpected keys.
  - Loop protection: maxTurns=6, hard cap 10, AbortController timeout.
  - Fallback: primary → Kimi-K2.6 automatic on error/timeout/empty; graceful user-facing message on total failure.
  - Lead creation: email regex, rate-limit, TT-XXXX ref, no duplicates per session.
  - Admin draft-only: `admin_draft_reply` returns data only; there is no send tool; the prompt instructs drafts are not sent.
  - Auth: JWT exp/aud/iss/sub verified + DB-membership; admin password overridable via env.

**End-to-end curl testing against the live worker was not possible from the sandbox due to TLS egress restrictions to workers.dev.** The bundle and types are clean; the deploy succeeded. Once pushed to the live branch, opening the widget on the public site should:
1. Answer service/portfolio/pricing questions from tools (no fabricated data).
2. Offer to start a project and, after name+email+brief, create a lead with a TT-XXXX ref.
3. Admin chat (behind password) can list/get leads and draft replies (drafts only).
4. Client chat (demo@toluenetech.com / DEMO-2026) sees only demo project data — not other clients'.

If the live Dahl key in secrets uses `dahl` as provider (it already was set per previous deploy), the system will be live immediately; otherwise set `AI_PROVIDER=dahl` and `AI_API_KEY=…` as Worker secrets.

---

## 9. Remaining Limitations / Follow-ups (out of this pass's scope)

1. Full RSA-SHA256 signature verification of Firebase ID tokens against Google's JWKS (currently structural + exp/aud/iss + DB membership check, matching the existing security posture).
2. Client portal still supports the demo identity; real client records will be activated when migrated from Firestore into Neon `clients`.
3. In-memory rate limiter resets per Worker isolate (acceptable for MVP; could move to KV/Upstash if needed).
4. GLM 5.2/5.3 models are not wired until they appear in Dahl's official catalog.
5. Quotation estimates are still "rough indication" — there is no automatic quote generator; `admin_draft_reply` is the only draft tool and it is explicitly marked NOT sent.
6. No streaming responses yet (streaming is implemented in the Dahl provider but the routes return full responses; SSE streaming to the widget is a future UI improvement).

---

## 10. Acceptance Criteria Cross-Check

| Requirement | Status |
|---|---|
| MiniMax-M2.7 primary, DeepSeek-V4-Flash fast, Kimi-K2.6 fallback | ✅ |
| GLM reserved for when live | ✅ (commented placeholder) |
| Tool/function calling with strict schemas, auth, audit | ✅ |
| No direct SQL from prompts | ✅ (all data via typed handlers) |
| Structured retrieval (no bulk context dump) | ✅ (`basePublicContext` + `retrievePublic`) |
| Project estimation only from approved pricing rules; drafts marked draft | ✅ |
| Conversation persistence via assistantSessions/Messages | ✅ |
| Tier routing fast/reasoning | ✅ |
| Graceful failure + fallback | ✅ |
| Lead intelligence classification (in prompt) + no duplicate leads | ✅ |
| Admin READ+ANALYZE by default; destructive/send/financial require confirmation | ✅ (no send/delete tools) |
| Client assistant with strict clientId isolation; demo bootstrap | ✅ |
| Model env-configurable (AI_MODEL, AI_MODEL_PUBLIC, AI_MODEL_FALLBACK) | ✅ |
| Tolesh branding, three surfaces, existing UI preserved | ✅ (UI unchanged; response shape preserved) |
| Loop protection, timeouts, tool cap | ✅ |
| Prompt-injection resistance (strip thinking, whitelist, no system leakage) | ✅ |
| No unrelated redesign / no broken routes | ✅ (routes preserved, CMS/media/leads untouched) |
| TypeScript clean, builds, deploys | ✅ |
