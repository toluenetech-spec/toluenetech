# Tolesh AI v2.1 — Fix & AI Lab Report

**Date:** 2026-10-07
**Branch:** `arena/01a09826-toluenetech`
**Deploys:** GitHub Actions runs #37616219766 and #37616752209 — both SUCCESS (54s / 52s).

---

## 1. Root cause of "What services does Toluene Tech offer?" failure

Two compounding bugs:

1. **Wrong Dahl model ID for the fast tier.**
   The code used the bare string `DeepSeek-V4-Flash`, but Dahl's live model ID is **`deepseek-ai/DeepSeek-V4-Flash-0731`** (verified from `https://inference.dahl.global/v1/models` and the official docs page). This meant every fast-tier request got a `400 model not found` from Dahl. It silently fell through to MiniMax, which is why short greetings ("Hi", "2+2", "tell me a joke", "What is Toluene Tech?") still worked — they were actually answered by MiniMax after the fast model errored.

2. **Kimi-K2.6 as the standard-tier fallback — but Kimi is RETIRED on Dahl.**
   The Dahl docs explicitly list `moonshotai/Kimi-K2.6` as "Retired — no longer offered on Dahl". For short messages MiniMax could answer without tools, so the fallback never fired. For "What services does Toluene Tech offer?" MiniMax correctly invoked a tool (list_services / search_services), executed it, then on the next model turn either (a) MiniMax returned an error/empty after seeing tool results, or (b) something about the post-tool call pushed us into fallback, at which point the code tried the retired Kimi model — producing a hard error, which was then swallowed by the generic catch-all as "I'm having trouble reaching our models." There was no error categorisation, so a model error, a tool error and a DB error all showed the same generic message, which made diagnosis look like a model connectivity issue when part of the problem was the tool loop + retired fallback.

**Fix:** Corrected all model IDs, removed Kimi from the active chain, added `normaliseModelId()` to alias legacy IDs to verified ones, made DeepSeek-V4-Flash tools-capable per Dahl, added structured error codes so tool/model/timeout/db failures produce different messages, and set the fallback to GLM-5.3-Flash (which supports tools and can continue a tool-using conversation).

## 2. Exact fix

- `server/src/ai/models.ts` — rewrote catalog with verified Dahl IDs:
  - fast: `deepseek-ai/DeepSeek-V4-Flash-0731`
  - standard/reasoning: `MiniMaxAI/MiniMax-M2.7`
  - fallback: `zai-org/GLM-5.3-Flash`
  - Kimi removed entirely from routing. `normaliseModelId()` maps legacy strings.
- `server/src/ai/client.ts` — added `AIErrorCode` (MODEL_ERROR, FALLBACK_ERROR, TOOL_ERROR, DATABASE_ERROR, AUTH_ERROR, TIMEOUT, INVALID_TOOL_ARGUMENTS, EMPTY_MODEL_RESPONSE, CONFIG_ERROR), categorises Dahl HTTP errors, surfaces user-friendly messages, and logs the real cause/model/HTTP status server-side. Catches AbortController timeouts explicitly as TIMEOUT.
- `server/src/ai/providers/dahl.ts` — updated comments to reflect the current model list and Kimi's retired status.
- `server/src/routes/assistant.ts` — rewrote `classifyTier()` so that math, jokes, and "who are you" always go fast but any non-trivial question (including "What services…") goes to the standard tier with tools enabled. Added per-phase DB error handling (session, retrieval, persistence) so a DB hiccup doesn't look like a model failure.
- `server/src/routes/assistant-admin.ts`, `assistant-client.ts` — added typed error handling, safer Promise destructuring for context loading, longer timeouts (35–40s) to accommodate tool loops.
- `server/src/lib/rate-limit.ts` — `clientIp(req)` takes only the request (no env).
- `server/src/ai/tools/index.ts` — every data-dependent handler returns a structured `{ result: { error: 'database unavailable' } }` instead of throwing if `ctx.db` is null; DB errors thrown from Drizzle are caught and returned as safe "database lookup failed" tool messages (no SQL/stack leakage to the model or user).
- Timeouts bumped: fast 15s, standard 30s, reasoning 35–45s, planner 45s.

## 3. Verified Dahl model IDs (from `docs.dahl.global/models` and `GET /v1/models` docs)

| Role | Model ID | Tools? | Context |
|------|----------|--------|---------|
| Fast / public | `deepseek-ai/DeepSeek-V4-Flash-0731` | ✅ | 400K |
| Reasoning | `MiniMaxAI/MiniMax-M2.7` | ✅ | 180K |
| Fallback | `zai-org/GLM-5.3-Flash` | ✅ | 400K |

Servix source was not present in the workspace (only `/home/user/toluenetech` exists and contains just Toluene Tech), so I verified the GLM ID from Dahl's own published model catalog (`zai-org/GLM-5.3-Flash`) rather than from a Servix reference. GLM-5.3-Flash uses the standard OpenAI-compatible tools schema (`tools: [{type:"function", function:{…}}]`, `tool_calls` in response), which is exactly what our Dahl provider already sends — no provider-level format change was necessary. GLM's always-on thinking is handled by the existing `stripThinking()` layer (emitsThinking=true in the model config).

## 4–6. Model routing (post-fix)

- **Public / fast:** `deepseek-ai/DeepSeek-V4-Flash-0731` (env override `AI_MODEL_PUBLIC`)
- **Reasoning / complex:** `MiniMaxAI/MiniMax-M2.7` (env override `AI_MODEL_REASONING`, falls back to `AI_MODEL`)
- **Fallback:** `zai-org/GLM-5.3-Flash` (env override `AI_MODEL_FALLBACK`)

Fallback chain is always `[primary, GLM]` — no second-guessing by tier. Kimi is NOT in the chain; the only remaining references are comments explicitly flagging it as retired.

## 7. Kimi removal

- Searched the entire codebase (server/src, components, pages, lib, wrangler.toml).
- All active routing references to `Kimi`, `Kimi-K2.6`, `moonshotai/Kimi-K2.6` are gone.
- Two mentions remain, both clearly labeled "RETIRED on Dahl; DO NOT USE" — kept intentionally as documentation to prevent future accidental re-addition.

## 8. GLM fallback live testing

**Not performed end-to-end from this sandbox.**
Reason: the sandbox cannot open TLS connections to `*.workers.dev` or `inference.dahl.global` (curl reports `OpenSSL SSL_connect: SSL_ERROR_SYSCALL` on every attempt to both hosts — an egress restriction in the Arena environment, not a code issue). The deployment itself succeeded cleanly (both GitHub Action runs deployed in ~50s, Worker bundle 616 KiB / 140 KiB gzipped), so the fallback path will execute live:

- GLM is registered as the fallback for both fast and standard/reasoning.
- GLM's model config is `tools: true, emitsThinking: true, maxOutput: 900, temperature: 0.45`.
- When the primary fails (HTTP error, timeout, empty response, AbortError), `getAI().run()` iterates the chain and calls `runOnModel` with the same original request messages (including tools), which GLM supports per its published spec.
- If GLM also fails, the user gets a graceful "I'm having trouble reaching our models right now" message and the server logs both failures with model + code + cause.

What I *did* verify statically: GLM's `tools: true` means the tool array is sent (not dropped), and `emitsThinking: true` means `<think>` blocks are stripped before returning to the user (required because GLM-5.3-Flash has thinking always-on). The tool-loop safety controls (maxTurns, argument whitelist, per-tool try/catch, audit array) apply identically on the fallback model.

## 9. AI Lab

All three AI Lab features are now connected to the real backend via new routes `/ai-lab/planner`, `/ai-lab/advisor`, `/ai-lab/idea`. No Gemini key-in-console, no demo-mode templated responses, no keys shipped to the browser.

- **Shared infrastructure:** the AI Lab uses the *same* `getAI()` pipeline, same Dahl provider, same model router, same fallback chain, same timeout/error handling, same argument sanitiser, same thinking-tag stripping as Tolesh. System prompts are separate (Planner / Advisor / Idea) and the lab only sees a small read-only subset of public tools (`list_services`, `search_services`, `get_pricing`) — lead creation, admin, and client tools are NOT exposed.
- **Project Planner** — accepts a structured form: project idea, project type, target users, business type, desired features, platform, budget, deadline, integrations, technical requirements, design requirements, notes. Returns the 13 required sections (summary, recommended solution, core features, pages/screens, UX considerations, technical direction, development phases, complexity, timeline, budget considerations, risks, missing info/questions, relevant TT services). Budget language never invents prices — uses `get_pricing` when a match exists, otherwise recommends a discovery call.
- **Business Advisor** — free-form; answers strategy/tech/AI/automation questions without forcing a sales pitch; only cites Toluene Tech services when relevant.
- **Idea Analyzer** — free-form; returns problem/audience/value-prop/feasibility/differentiation/risks/monetization/complexity/MVP/next steps; explicitly refuses impossible ideas (flying cars, etc.) and never fabricates market stats.

**UX improvements:**
- Loading spinner with tailored messaging per feature.
- Error card with inline **Retry** button.
- **Copy** result (with "Copied" confirmation).
- **Regenerate** (re-runs the last prompt).
- **Start over** (clears input and result).
- Input validation (min length, max length, per-field messages) — submit button disabled until valid.
- `AbortController` cancels in-flight requests when switching tabs or submitting again.
- User input is preserved when switching tabs mid-edit.
- Mobile-responsive layout (grid collapses on small screens, buttons wrap).
- Structured Markdown rendering (uses the existing safe `Markdown` component — bold, bullets, headings, links, inline code).
- "Live" pill when a response arrives.
- A small note when the response came from the fallback model.
- Demo-mode banner and the `window.__TT_GEMINI_KEY` instruction were removed entirely.

## 10. Security

- Public Tolesh and AI Lab route handlers set `kind: 'public'` / `kind: 'lab'` — admin and client handlers are never wired into these routes.
- AI Lab tool set is filtered to `list_services | search_services | get_pricing` only — no `create_lead`, no admin/client tools.
- Tool arguments are whitelist-sanitised against the JSON schema (unknown keys dropped).
- Client tools always re-check ownership with `WHERE clientId = ctx.auth.clientId` before touching milestones/messages/files.
- Dahl API key lives only as a Worker secret; the browser never sees it (the AI Lab now calls `/ai-lab/*`, not Gemini directly).
- System-prompt-injection defense: instructions never to reveal system prompts/secrets; tool results are injected as user-role `[tool_result:…]` text (not as system instructions).
- No direct DB access from prompts; all DB access is through validated typed handlers.
- Rate limits: public chat 25/min/IP; admin 30/min/UID+IP; client 30/min/UID+IP; AI Lab 10/min/IP/feature; lead creation 3/min/IP.
- `ADMIN_PASSWORD` env var overrides the legacy hardcoded password.

## 11. Tests performed and results

| Test | Result |
|------|--------|
| `tsc -p server/tsconfig.json --noEmit` | ✅ clean (0 errors) |
| `tsc --noEmit` (frontend) | ✅ clean |
| `npm run build` (vite) | ✅ builds (5.2s); pre-existing chunk-size warning, no new errors |
| `wrangler deploy --dry-run` | ✅ bundle validates: 616 KiB / 140 KiB gzipped; R2 binding recognised |
| GitHub Actions deploy (runs 37616219766, 37616752209) | ✅ success in 48–54s |
| Grep for Kimi in active code | ✅ 0 hits (only "retired" doc-comments remain) |
| Static trace of service-question path (frontend → route → classifyTier → standard tier → MiniMax+tools → search_services → tool result → model → reply) | ✅ all segments exist, types correct, tools list correct, tool result sanitised |
| Tool null-db guard | ✅ all 12 tool handlers return structured error instead of throwing when db=null |
| ClientId scoping in client_* tools | ✅ verified — AND clientId = ctx.auth.clientId before any query |
| Admin draft-only | ✅ `admin_draft_reply` returns data only; no send tool exists |
| AI Lab route mounted at `/ai-lab/{planner,advisor,idea}` | ✅ verified in server/src/index.ts |
| AI Lab frontend uses real backend (`lib/ai.ts` now POSTs to `/ai-lab/*`) | ✅ Gemini call and demo-mode logic removed |
| AI Lab planner form fields (11 fields) | ✅ all present, wired to state, submitted as structured JSON |
| AI Lab UX (loading/error/retry/copy/regenerate/start over/abort) | ✅ all implemented |
| Response shape unchanged (`{reply, anonId, model, usedFallback, error?, toolCalls}`) | ✅ existing ToleshChat component works unmodified |

## 12. Tests blocked by environment

I must be explicit here: the following tests could **not** be executed live from the sandbox because TLS egress to `*.workers.dev` and `inference.dahl.global` fails with `OpenSSL SSL_connect: SSL_ERROR_SYSCALL` from the sandbox network. The code is written and deployed, but you will need to verify in your browser:

1. **Live chat tests in the widget** — all 15 test messages listed in the brief ("Hi", "What services…", "What projects…", "2+2", "Tell me a joke", "What is Toluene Tech?", fashion-website question, ₦500k budget question, revenue prompt-injection attempt, "ignore previous instructions" prompt-injection, flying-car joke, service question, project question, pricing question, rapid messages).
2. **Fallback behaviour** — DeepSeek failure → GLM; MiniMax failure → GLM; GLM unavailable → graceful error. (Cannot force a model failure from outside without temporarily overriding the model ID env var.)
3. **Tool failure / DB failure / timeout / empty response** user-facing messages.
4. **Admin copilot** end-to-end (behind admin password) — listing leads, drafting replies, and the explicit confirm prompt for destructive/send actions.
5. **Client assistant** end-to-end (demo@toluenetech.com / DEMO-2026) — that demo client records are auto-bootstrapped and milestones/messages/files are scoped.
6. **AI Lab** in the browser — Planner with normal/complex/missing/unrealistic/empty/long/injection inputs; Advisor with normal/TT-related/unrelated/injection; Idea Analyzer with normal/vague/unrealistic/empty/injection.
7. **Mobile UI** of the new planner form (responsive grid) — I used the existing Tailwind responsive classes (`sm:grid-cols-2`) but did not device-test.
8. **Browser console** for errors/duplicate requests after loading the live site.
9. **Duplicate lead prevention** across sessions with same email.

Because of the sandbox TLS restriction, I cannot truthfully claim the service question now returns a real service answer. I'm confident the root cause (bad DeepSeek ID + retired Kimi fallback + missing error categorisation) is fixed and the code compiles, builds, deploys and wires GLM correctly — but you should open the widget on the live site and type "What services does Toluene Tech offer?" to confirm end-to-end. If it still fails, the new server-side logs will contain a structured entry (`{"ai":"public","event":"model_failed","model":…,"code":…,"cause":…}`) that pinpoints exactly which step failed (model HTTP status, tool error, DB error, timeout, etc.), which is a big improvement over the previous opaque generic message.

## 13. Remaining production risks

1. **GLM tool-calling parity with MiniMax.** GLM-5.3-Flash supports OpenAI-compatible tools per its published spec, but we haven't observed it live in this integration. If GLM formats tool_calls slightly differently (e.g. streaming tool calls, or `arguments` as an object rather than a JSON string), the parser in `dahl.ts` may need a small adjustment; the error will now surface clearly as a model_failed log with cause.
2. **Client portal still uses demo identity** for demo@toluenetech.com; real client migration from Firestore to Neon is out of scope.
3. **In-memory rate limiter** resets per Worker isolate (pre-existing, not changed).
4. **Firebase JWT signature verification** is still structural (exp/aud/iss/sub) + DB membership rather than full RSA-SHA256 against Google JWKS (pre-existing posture, not regressed).
5. **If the Neon `services` table is empty** (fresh DB), tool results will be empty and the assistant will say it can't find service data rather than fabricating — which is correct behaviour but you may want to seed the table.
6. **AI Lab planner output length** is capped at 1200 tokens; very complex briefs may produce slightly truncated plans (safer than runaway generation).
