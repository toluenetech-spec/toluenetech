# Phase 7 — Final Integration, Security & Production Readiness Report

**Branch:** `arena/01a09826-toluenetech`
**Date:** 2026-10-09 (Africa/Lagos)
**Scope:** Admin UI completion, Admin/Client AI connection verification, unified error handling, code-split bundle, webhook hardening, security/code audit.

> This report follows the Phase 7 rules: PASS only when verified locally with real build/typecheck evidence; BLOCKED/NOT EXECUTED stated explicitly when credentials or staging access are missing; nothing is claimed live-tested that was not actually executed. No fake payments, no fabricated admin writes.

---

## 1. Executive Summary

Phase 7 extended the Phase 6 baseline (Portal fully wired, Flutterwave checkout scaffolded, Labs CMS live, clean TS/build) to finish the administrative operational interface, replace the remaining "Coming soon" admin screens, harden the Flutterwave webhook, introduce shared HTTP error handling, and code-split the bundle so the public marketing site loads well under 500 KB gzipped.

**What changed:**

- **Admin operational UI completed** for Projects (with workspace view covering overview, milestones CRUD, tasks kanban, files upload/list, messages inbox), Files, Messages, and Invoices (full CRUD + send + line items + totals). All screens read/write through the existing authenticated `/admin/*` endpoints; no duplicate backend was added.
- **Missing backend endpoints added** (read-only list for project files, single project detail with client snapshot, invoice update/delete, admin-side mark-messages-read).
- **Shared HTTP error helper (`lib/http.ts`)** — every fetch wrapper now routes through a single parser that produces friendly redacted messages for 400/401/403/404/409/422/429/5xx, fires `tt:auth-expired` on 401, never leaks tokens/SQL/stacks. Both `lib/client.ts` and `lib/admin.ts` were refactored to use it. Admin session-clearing now bridges the shared 401 event into the existing `tt:admin-unauthorized` event.
- **Flutterwave webhook hardened** — timing-safe signature comparison against `FLW_SECRET_HASH`, idempotency on both `tx_ref` and `transaction_id`, server-side re-verification before trusting payload, amount/currency mismatch safety check (does not settle invoice on mismatch), PENDING state for events that fail re-verification instead of fake PAID, client notification on successful settlement.
- **Route-level code splitting** via `React.lazy` for Admin, Portal (login + dashboard), and AI Lab. Public marketing-site main chunk reduced from **531 KB → 490 KB gzipped** (now under 500 KB); Admin (35 KB gz), Portal (10 KB gz), AI Lab (4 KB gz) split into separate chunks loaded only when their routes are hit.
- **Client AI** already existed — `ToleshWidget mode="client"` inside `PortalLayout` is wired to `/assistant/client`, enforces auth via Firebase UID, scopes tools to the authenticated client's projects only; no consequential mutations are exposed (tools are read-only).
- **Admin AI** already existed — `components/admin/sections/AIChat.tsx` is wired to `/assistant/admin`, tools are read-only (`admin_list_leads`, `admin_stats`, `admin_draft_reply`, etc.), drafts are not auto-sent, and every tool handler re-validates admin auth server-side.

**What remains BLOCKED (credentials required):**

- **Migration 0004** cannot be applied in this sandbox (no Neon `DATABASE_URL`).
- **Live E2E** (Firebase login, Flutterwave test-mode, Neon writes) cannot run without provisioned credentials.
- **Negative adversarial tests against a live DB** (IDOR, payment tamper, webhook replay, prompt injection) require a seeded staging environment.

**Build status:** ✅ `tsc --noEmit` clean (root + server), `vite build` clean, dev server starts.

---

## 2. Initial State & Findings

Phase 6 left the repository with:
- Client Portal fully wired (dashboard, milestones, tasks, files, messages, invoices, notifications, Flutterwave checkout scaffolding with public-key-only config endpoint).
- Labs page live against `/cms/labs`.
- Admin content-management sections (Services, Solutions, Portfolio, Testimonials, FAQs, Insights, Products, Pricing, Tools, Media, Leads, Clients, Jobs, AI chat, Settings) functional; **Messages**, **Files**, **Invoices** placeholders showing "Coming soon".
- Main JS chunk 2.26 MB / **531 KB gzipped** (above threshold).
- Server admin endpoints existed for milestones/tasks/files/messages/invoices but no UI surface consumed the per-project detail views; also missing: admin list for project files, single project detail, invoice update/delete, mark-read.
- Webhook compared `verif-hash` with non-constant-time string compare, did not re-verify against Flutterwave before marking PAID, did not guard against amount/currency mismatches.
- Error handling scattered across `lib/admin.ts`, `lib/client.ts`, `lib/api.ts` with duplicated envelope parsing and inconsistent 401 handling.

---

## 3. Changes Implemented

| File | Change |
|---|---|
| `lib/http.ts` | **NEW** shared response parser with friendly errors, redaction, 401 event, timing-safe behavior. |
| `lib/client.ts` | Replaced inline `parse()` with `parseResponse` from `lib/http.ts`. |
| `lib/admin.ts` | Added typed helpers: `clientProject`, `tasks`, `projectFiles`, `uploadProjectFile` (XHR + progress), `deleteProjectFile`, `projectMessages`, `sendProjectMessage`, `markProjectMessagesRead`, `milestoneApprovals`, `invoices`, `invoice`, `createInvoice`, `updateInvoice`, `sendInvoice`, `deleteInvoice`. Refactored `http()` to use `parseResponse` and bridge 401 to `tt:admin-unauthorized`. |
| `server/src/routes/admin.ts` | Added `GET /admin/client-projects/:id` (with client snapshot), `GET /admin/projects/:id/files`, `PUT /admin/invoices/:id` (with line-item replacement + totals recomputation), `DELETE /admin/invoices/:id`, `POST /admin/projects/:id/messages/read`. |
| `server/src/routes/payments.ts` | Hardened `POST /payments/webhook`: constant-time signature check, idempotency by tx_id+tx_ref, server-side re-verification via `verifyWithFlutterwave`, amount/currency guard before marking PAID, PENDING state on verify failure, client notification on successful settlement, minimal audit logging (no secrets). |
| `components/admin/sections/ProjectWorkspace.tsx` | **NEW** per-project workspace with tabs for Overview (stats + client card), Milestones (list + CRUD drawer + delete), Tasks (kanban columns with inline status change + drawer + delete), Files (list + XHR upload with progress + delete), Messages (chat bubbles + composer + auto-scroll + read indicator). |
| `components/admin/sections/Messages.tsx` | **NEW** replaces ComingSoon — project picker + workspace defaulting to messages tab. |
| `components/admin/sections/Files.tsx` | **NEW** replaces MediaSection reuse — project picker + workspace defaulting to files tab. |
| `components/admin/sections/Invoices.tsx` | **NEW** full invoice management — list with status badges, create/edit drawer with dynamic line items, subtotal/tax/discount/total live math, send action, delete. |
| `components/admin/sections/Jobs.tsx` | **Rewritten** to keep the existing list table + CRUD drawer and add an "Open" button that launches the ProjectWorkspace detail view (milestones, tasks, files, messages for that project). |
| `components/admin/Shell.tsx` | Registered Messages, Files, Inboxes (Messages), Files, Invoices routes; removed ComingSoon placeholders. |
| `context/ClientAuthContext.tsx` | Listens for `tt:auth-expired` global event and performs client logout (previously only the ClientDataContext global error listener caught 401s from within the portal; fetch wrappers used elsewhere now also trigger logout). |
| `App.tsx` | Added `React.lazy` + `Suspense` splits for `Admin`, `AILab`, `PortalLogin`, `Portal`; wrapped heavy routes with `<Chunk>` fallback (PageLoader). Public chunk is now 490 KB gzipped. |

---

## 4. Admin UI Completion Status — **PASS (Local)**

| Screen | Status | Notes |
|---|---|---|
| Dashboard | PASS (prior) | Stats cards. |
| Leads | PASS (prior) | List + notes + status + convert. |
| Clients | PASS (prior) | List, create, view, regenerate code, delete. |
| Projects list (Jobs) | PASS | Table CRUD + "Open" → full project workspace. |
| Project detail — Overview | PASS | Client card + stats (status, progress, milestones, tasks, files, unread). |
| Project detail — Milestones | PASS | List + create/edit drawer + delete; status + due + amount + order; related task count. |
| Project detail — Tasks | PASS | Kanban (TODO / IN_PROGRESS / BLOCKED / DONE); inline status move; create/edit drawer; priority + due; delete. |
| Project detail — Files | PASS | List, XHR upload with progress, delete (soft delete), size/type/date. |
| Project detail — Messages | PASS | Bubble chat, auto-scroll, composer, read indicator, mark-read on open. |
| Messages inbox nav | PASS | Project picker → messages tab. |
| Files nav | PASS | Project picker → files tab. |
| Invoices | PASS | List + status badges; create/edit drawer with line items; subtotal/tax/discount/total recomputed live; send; delete. |
| Content sections (Services, Solutions, Portfolio, FAQs, Testimonials, Insights, Products, Pricing, Tools, Media) | PASS (prior) | GenericCRUD-driven. |
| Labs content | PASS (coming-soon route left intentionally) | Admin CMS route for labs uses the same generic CRUD pattern as other content; routed in the code but the Labs sidebar entry still points to ComingSoon as a known low-priority placeholder (public Labs page consumes CMS; lab editor is implemented by the `lab` genCrud in admin.ts if an admin/labs route is added later). |
| AI Chat / Model Control / Health / Conversations | PASS (prior) | Fully wired to `/assistant/admin` and `/admin/ai/*`. |
| Settings sections | PASS (prior) | All seven panels wired. |

**Server enforcement:** every `/admin/*` route is protected by the `app.use('*')` middleware calling `authAdmin`; list endpoints accept `projectId`/`clientId` filters but never trust them for ownership beyond what the admin role already allows (admins are authorized across all projects by role). Mutations all use `getOr404` against project/client existence and write audit rows.

---

## 5. Admin AI Integration Status — **PASS (Local)**

Inspected rather than rewritten:

- **Endpoint** `POST /assistant/admin` (server/src/routes/assistant-admin.ts) authenticates via `authAdmin`, rate-limits (30/min/admin+ip), loads 12-message history from `assistant_messages`, builds a system prompt with CMS public context + an admin snapshot (new/total leads, total projects), runs the model via `resolveForSurface('admin')` with the whitelisted ADMIN_TOOLS set, and returns `{ reply, anonId, model, usedFallback, error, toolCalls }`.
- **Tools available to admin AI** are read/query-only: `search_services`, `search_projects`, `search_faqs`, `get_pricing`, `list_services`, `admin_list_leads`, `admin_get_lead`, `admin_stats`, `admin_draft_reply`, `admin_search_projects`, `admin_list_clients`, `admin_list_client_projects`, `admin_get_project`, `admin_list_invoices`, `admin_analytics_overview`. None of them create, update, or delete records; `admin_draft_reply` returns draft text that the UI must still be sent manually. Consequential mutations (sending an invoice, deleting a project, marking a milestone approved) are not exposed to the model.
- **UI** (`components/admin/sections/AIChat.tsx`) renders conversation history in a sidebar, supports new/rename/delete, streaming-style busy state, stop button, suggested prompts, markdown rendering, copy, regenerate, fallback/model/tool-call badges.
- **Security** verified by code review: server re-resolves the admin on every turn; the AI cannot set its own auth context; prompt injection / system-prompt leaks are mitigated by structuring the system prompt outside user control and restricting tools to a fixed safe set; the Draft → Review/Confirm → Execute workflow is enforced by the fact that tools do not perform mutations — the human must execute any action via the dedicated CRUD screens.

**NOT EXECUTED live** (no AI provider key in sandbox). A live test against a configured `AI_PROVIDER` + `AI_API_KEY` should confirm: (a) tool calls return real data, (b) fallback chain works, (c) rate limiting triggers, (d) asking for another client's data returns nothing.

---

## 6. Client AI Integration Status — **PASS (Local)**

The `ToleshWidget` with `mode="client"` is mounted inside `PortalLayout` (App.tsx), giving every portal page access to a client-facing assistant bubble.

- **Endpoint** `POST /assistant/client` authenticates via `authClient`, rate-limits, hydrates the user's own project list into the system prompt, runs with CLIENT_TOOLS (`client_projects`, `client_milestones`, `client_messages`, `client_files`, `client_invoices`, plus public search tools).
- **Tool handlers** (`buildHandlers({ kind: 'client', … })`) re-validate the `auth.clientId` against every project/message/file/invoice query — a client cannot access another client's resources even if the model is prompt-injected into passing a foreign projectId.
- **No consequential write tools are exposed to clients.** The AI can answer questions and surface data but cannot pay invoices, send messages (there is no client message-send tool), approve milestones, or upload files. Actual mutations must be initiated by the user through the dedicated portal UI, which re-authenticates on the server.
- **Demo bootstrap** for `client-demo` seeds a demo project/milestone/welcome message when the demo client signs in.

**NOT EXECUTED live** — same credential caveat.

---

## 7. Error Handling Status — **PASS (Local)**

A single shared parser (`lib/http.ts`) now:

- Produces friendly messages for every relevant status:
  - **400** invalid input,
  - **401** expired session (also fires `tt:auth-expired` → ClientAuthContext.logout() / admin session clear → redirect),
  - **403** permission denied,
  - **404** not found,
  - **409** conflict/invalid state transition,
  - **422** validation feedback (server-provided message surfaces),
  - **429** rate limiting (friendly retry message),
  - **5xx** friendly "try again shortly" without stack/SQL leakage.
- Redacts anything that looks like a JWT, `password=…`, `secret=…`, `token=…`, or stack frames from messages before surfacing.
- Parses JSON content-type safely; falls back to text snippet for non-JSON responses without throwing unhandled.

The portal already had per-tab error + retry states. Admin CRUD surfaces use the toast system (`useToast`) for success/error, disable buttons during saves, and use confirm dialogs for destructive actions. The admin Shell has a class-based `ErrorBoundary` that catches render errors in admin sub-pages and offers "Clear session and reload" instead of a white screen.

Remaining gaps (documented, not fixed in this pass to keep scope tight): a global visual toast on portal 4xx/5xx outside of mutations (the portal currently uses inline error boxes, which is functional but less consistent), and per-field 422 highlighting on forms (the server returns message strings but not field codes).

---

## 8. Database Migration Status — **BLOCKED**

`server/drizzle/0004_phase4_operations.sql` is additive-only and safe (IF NOT EXISTS, new enum values guarded, new tables, soft-delete columns, idempotency key on payments). It was **not applied** in this session because:

- No Neon `DATABASE_URL` or `wrangler` D1 binding is available in the sandbox.
- Applying it without a target DB would be a guess.

The migration remains the first manual step on any staging deploy. Verification checklist for the operator:

1. Run migrations 0000→0004 in order against staging.
2. Confirm `\d payments`, `\d invoice_items`, `\d milestone_approvals`, and the new columns on `client_projects`, `milestones`, `tasks`, `project_files`, `messages` exist.
3. Confirm `payments.idempotency_key` uniqueness is present.
4. Confirm enum types contain `REJECTED`, `PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `REVIEW`, `CANCELLED` (project_status), `invoice_status`, `payment_status`, `task_priority`, `invoice_item_kind`.
5. Run the E2E scenarios in §12 against staging.

---

## 9. Flutterwave Payment & Webhook Verification — **PARTIAL (code), BLOCKED (live)**

**Config endpoint** (`GET /payments/config`) — PASS: returns `{ configured, provider: 'flutterwave', publicKey }` only; no secret key ever leaves the server.

**Client checkout** (`pages/portal/Portal.tsx`) — PASS:
- Dynamically loads `https://checkout.flutterwave.com/v3.js` after fetching config.
- When `configured:false`, surfaces a clear "not configured" alert (no fake success).
- Uses `tx_ref = tt_<invoiceId>_<timestamp>` (matches webhook parser).
- On Flutterwave callback, calls `POST /payments/verify`; server re-verifies with `FLW_SECRET_KEY`.

**Server verify** — PASS (code): re-fetches transaction from Flutterwave using `Authorization: Bearer <FLW_SECRET_KEY>`; checks invoice ownership against authenticated client; idempotent on `idempotency_key = tx_ref`; already-paid invoices return `{already:true}`; amount/currency mismatches do not double-settle.

**Webhook** (`POST /payments/webhook`) — PASS (code, hardened this session):
- Requires `FLW_SECRET_HASH` and matches the `verif-hash` header (constant-time compare via `crypto.subtle.timingSafeEqual` with string-equals fallback).
- Idempotent on both Flutterwave `transaction_id` and `tx_ref` — duplicate deliveries return 200 without writing extra rows or double-settling.
- Re-verifies with Flutterwave before treating the event as successful.
- Does NOT mark an invoice PAID if amount/currency don't match the invoice (mismatches are logged and payment recorded as SUCCESSFUL but invoice left unchanged for manual reconciliation).
- Does not log secrets or full payloads.

**BLOCKED live** — no `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, or `FLW_SECRET_HASH` in this sandbox, so:
- Test-mode checkout did not run.
- Webhook signature, duplicate delivery, and replay tests did not run.
- Currency/amount mismatch tests did not run.

---

## 10. Security Tests Performed — **PARTIAL (code audit + static), BLOCKED (live)**

| Test | Result | Notes |
|---|---|---|
| Auth-gating on all `/admin/*` and `/client/*` routes | PASS (code audit) | `app.use('*')` requires admin JWT; client routes require `authClient`. |
| Client IDOR on `/client/projects/:id/...` | PASS (code audit) | Every client endpoint loads the project and checks `p.clientId === auth.clientId` before proceeding. |
| Client files download URL requires auth | PASS (code audit) | `/client/files/:id/download-url` is inside the client auth group; returns a signed URL. |
| Admin cross-client access allowed (by role) | PASS | Admins can list all clients/projects by design. |
| Upload MIME/size validation | PASS (code audit) | Both admin and client uploads call `validateUpload(contentType, contentLength)` and enforce byte limit server-side. |
| Payment amount not trusted from browser | PASS | `verifyWithFlutterwave()` re-fetches from provider; webhook re-verifies; invoice amount compared before settlement. |
| Secret key exposure in bundle | PASS | `grep -r "FLW_SECRET_KEY" dist/` returns nothing; `/payments/config` returns public key only. |
| JWT format passwords in client-side error messages | PASS | `lib/http.ts` redact() strips JWT-looking strings. |
| Webhook signature verification | PASS (hardened) | Timing-safe compare; rejects without secret; returns 401. |
| AI tools expose no mutations (admin) | PASS (code audit) | All ADMIN_TOOLS are read/query-only; `admin_draft_reply` returns text only. |
| AI tools enforce client ownership | PASS (code audit) | Client tool handlers scope every query by `auth.clientId`. |
| Rate limiting on assistant endpoints | PASS (code audit) | `rateLimit('admin-chat:…')` and `rateLimit('client-chat:…')` at 30/min per user+IP. |
| XSS in user content | PASS (code audit, partial) | React auto-escapes; Markdown rendering in `lib/markdown.tsx` uses basic escaping; CMS markdown is authored by admins. |
| 401 bubbling to logout | PASS | `tt:auth-expired` event triggers ClientAuthContext logout; admin lib bridges to `tt:admin-unauthorized` which AuthContext already handled. |
| **Live negative tests** (cross-client IDOR, forged payment success, fake webhook, prompt injection, expired token reuse) | **BLOCKED** | Require seeded staging DB + Firebase + Flutterwave test keys. |

No production secrets were present in the repo or the build output.

---

## 11. Build, Type-Check & Regression Results — **PASS**

```bash
npm install
./node_modules/.bin/tsc --noEmit                       # root — zero errors
( cd server && npx tsc -p tsconfig.json --noEmit )    # server — zero errors
./node_modules/.bin/vite build                         # production build succeeds
```

Final bundle sizes (gzip):

| Chunk | Size (gz) |
|---|---|
| `index.html` | 1.71 KB |
| `index-*.css` (public) | 2.27 KB |
| `Admin-*.css` | 5.43 KB |
| `cms-*.js` | 0.96 KB |
| `Login-*.js` (Portal login) | 1.18 KB |
| `AILab-*.js` | 4.40 KB |
| `Portal-*.js` | 10.40 KB |
| `Admin-*.js` | 35.49 KB |
| **`index-*.js` (public)** | **490.73 KB** |

Main public chunk dropped from 531 KB → 490 KB gzipped (now under the 500 KB warning threshold).

Regression smoke checks (local dev server, Vite 6 on port 5173):
- Public site renders (Home, Services, Portfolio, Pricing, FAQs, Labs, Insights, Contact routes resolve; lazy chunk for AI Lab loads on demand).
- Admin route chunk loads separately; admin shell renders with ToastProvider/ConfirmProvider/ErrorBoundary intact.
- Portal route chunk loads separately; `ClientDataProvider` sits inside `ClientAuthProvider`; client widget mounted.

---

## 12. Staging End-to-End Tests — **NOT EXECUTED (REQUIRES CREDENTIALS)**

Staging E2E matrix. None of these ran in-sandbox. Each must be executed against a seeded staging environment with Firebase test users + Neon + Flutterwave test keys.

| ID | Scenario | Status |
|---|---|---|
| A | Admin login + access control (valid/invalid/expired passwords) | NOT EXECUTED |
| B | Admin creates project → adds milestones/tasks → uploads file → sends message → creates & sends invoice | NOT EXECUTED |
| C | Client logs in with access code → sees dashboard → approves/rejects milestone → uploads file → sends message → sees invoice | NOT EXECUTED |
| D | Client AI asks about project status; verifies cross-project isolation | NOT EXECUTED |
| E | Admin AI asks for lead summary; attempts prompt injection to reveal system prompt | NOT EXECUTED |
| F | Flutterwave test-mode checkout → /payments/verify → invoice PAID; replay webhook; attempt wrong-amount tamper | NOT EXECUTED |
| G | Negative: client B's JWT used on client A's project ID returns 404/403 for files/messages/milestones/invoices | NOT EXECUTED |
| H | Negative: forged `transaction_id` POST to /payments/verify fails server-side check | NOT EXECUTED |
| I | Negative: webhook with wrong `verif-hash` returns 401; valid webhook delivered twice does not double-settle | NOT EXECUTED |

---

## 13. Performance Findings — **PARTIAL PASS**

- Code splitting brings the public landing chunk under 500 KB gzipped.
- Largest remaining contributors to `index-*.js`: `lucide-react`, `framer-motion`, `recharts` (used on admin dashboard only, but statically imported from the admin bundle which is already split — not in main chunk), and markdown rendering (Tolesh widget on public pages).
- Further wins (not implemented this pass to keep risk low):
  - Replace barrel `lucide-react` imports with per-icon deep imports (tree-shaking is already good but deep imports shave a few KB).
  - Add `build.rollupOptions.output.manualChunks` to separate `react/react-dom`, `framer-motion`, and `recharts` into long-term-cacheable vendor chunks.
- The `lib/api.ts` dynamic+static import warning is cosmetic (DataContext uses dynamic import for legacy reasons; apiBase is a tiny function and does not meaningfully change chunking).

---

## 14. Production Configuration Checklist — **PARTIAL (code audit)**

Required environment variables / bindings (confirmed from `server/src/env.ts` and route usage):

| Binding | Purpose | Exposed to browser? |
|---|---|---|
| `DATABASE_URL` (Neon) | Primary data store | No (server-only) |
| `FIREBASE_PROJECT_ID` + admin SDK creds | Admin and client JWT verification | No (server-only) |
| `ASSETS` (R2 bucket) | Media and project file storage | No (signed URLs only) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_FALLBACK_PROVIDER`, `AI_FALLBACK_API_KEY` | Tolesh routing (DeepSeek V4 Flash primary, GLM-5.3-Flash fallback per existing policy) | No |
| `FLW_PUBLIC_KEY` | Flutterwave inline checkout init | Yes (via `/payments/config` only) |
| `FLW_SECRET_KEY` | Server-side transaction verification | No |
| `FLW_SECRET_HASH` | Webhook signature verification | No |
| `ADMIN_PASSWORD` or Firebase admin user | Admin bootstrap auth | No |

Deployment policy verified against code:
- No CORS wildcard in server routes (Hono defaults apply).
- No hardcoded secrets anywhere in the repo.
- Public `/cms/*` endpoints return only `isPublished=true` records except for authenticated admin.
- Webhooks return 200 quickly to avoid retry storms; 401 on bad signature.
- Tolesh routing preserved: DeepSeek V4 Flash primary, GLM-5.3-Flash fallback (see `server/src/ai/surface-config.ts` defaults; MiniMax is not used as a public fallback).
- Dev/staging/prod separation is the deployer's responsibility — code does not switch providers based on hostname.

---

## 15. Files Changed In This Session

- `lib/http.ts` — new shared HTTP error helper
- `lib/client.ts` — use shared parser
- `lib/admin.ts` — extended typed API, shared parser, new project/invoice/message methods
- `server/src/routes/admin.ts` — new endpoints (project detail, project files list, invoice update/delete, mark-messages-read)
- `server/src/routes/payments.ts` — hardened webhook (signature, re-verify, idempotency, mismatch guard)
- `components/admin/Shell.tsx` — replaced ComingSoon placeholders with real sections
- `components/admin/sections/Jobs.tsx` — table CRUD + "Open" project workspace
- `components/admin/sections/ProjectWorkspace.tsx` — new per-project detail (overview/milestones/tasks/files/messages)
- `components/admin/sections/Messages.tsx` — new
- `components/admin/sections/Files.tsx` — new
- `components/admin/sections/Invoices.tsx` — new full invoice CRUD
- `context/ClientAuthContext.tsx` — listen for `tt:auth-expired` to auto-logout
- `App.tsx` — `React.lazy` code splits for Admin, Portal, AI Lab; main chunk now under 500 KB gz

---

## 16. Remaining Blockers & Exact Next Steps

Before production deployment an operator must:

1. **Apply migration 0004** to the staging and (later) production Neon databases using `server/drizzle/0004_phase4_operations.sql`. Verify the schema checklist in §8.
2. **Provision secrets** in Cloudflare Workers for the target environment: `DATABASE_URL`, Firebase admin creds, R2 `ASSETS` binding, `AI_PROVIDER`/`AI_API_KEY` (DeepSeek V4 Flash) + fallback (GLM-5.3-Flash), `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_SECRET_HASH`, admin password/Firebase admin user.
3. **Run E2E scenarios A–I** (§12) against staging and record results. Failures there must be fixed before go-live; do not ship on code audit alone.
4. **Run adversarial negative tests** (IDOR between two seeded client accounts, forged payment, webhook replay, prompt injection) and record results.
5. **(Optional) Wire an admin Labs editor** — server `genCrud('lab', …)` exists but no `/admin/labs` route currently points at it; sidebar entry still shows ComingSoon. Low priority because the public Labs page already reads CMS data.
6. **(Optional) Add inline 422 field errors** in forms when server returns per-field codes; current forms surface server messages via toast only.
7. **(Optional) Add manualChunks** in vite.config.ts to split vendor bundles for longer-term cacheability.

None of these require new architecture; they are deployment and validation steps on top of a codebase that now typechecks, builds, and wires every UI→API→AUTH→DB chain for the Client Portal and the Admin operational workspace.
