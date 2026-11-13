# Phase 4 + 5 Implementation Report
**Branch:** `arena/01a09826-toluenetech`
**Commit:** `eeea0aa` (pushed to `origin/arena/01a09826-toluenetech`)
**Baseline:** Phase 2+3 commit `59f6d5d`

## 1. Existing State at Start of Phase

The post-Phase-3 baseline already had a solid foundation on Neon+Cloudflare Workers:

- **DB schema:** 22 tables — `services, projects, products, labItems, testimonials, faqs, insights, pricingPlans, leads, leadNotes, solutions, tools, pageViews, clients, clientProjects, milestones, tasks, projectFiles, messages, invoices, media, assistantSessions, assistantMessages, adminUsers, notifications, auditLogs, aiUsage, siteSettings`.
- **Routes:** `/cms` (public read), `/media` (admin upload), `/files` (signed download proxy), `/leads`, `/auth`, `/healthz`, `/assistant/*` (public/admin/client chat), `/ai-lab`, `/admin/_ping`, `/admin/*` (CRUD for services/projects/faqs/testimonials/insights/pricing/products/leads/clients/client-projects/milestones/settings/media/tools/solutions + AI config), `/client/*` (Phase 3 read-only: me, projects, milestones, files, messages, invoices, notifications).
- **AI:** Dahl inference with DeepSeek V4 Flash (public) + MiniMax-M2.7 (admin/client) + GLM-5.3-Flash fallback; per-surface config stored in `site_settings.ai_config`.
- **Frontend:** Build succeeded. Admin CRUD sections for all Phase 2/3 entities; client portal Login/Portal pages.

## 2. Changes Made (Phase 4 + 5)

### 2.1 Database — additive migration `server/drizzle/0004_phase4_operations.sql`

All changes are **additive** — no columns or tables dropped. Safe to re-run (uses `IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS`).

**New enum values:**
- `project_status`: `PLANNING, IN_PROGRESS, ON_HOLD, REVIEW, CANCELLED`
- `milestone_status`: `REJECTED`
- `audit_action`: `MILESTONE_APPROVE, MILESTONE_REJECT, INVOICE_SEND, INVOICE_VIEW, PAYMENT_VERIFY, MESSAGE_SEND, NOTIFICATION_READ`

**New enums:**
- `task_priority` (LOW/MEDIUM/HIGH/URGENT)
- `invoice_status` (DRAFT/SENT/VIEWED/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED/VOID)
- `payment_status` (PENDING/SUCCESSFUL/FAILED/REFUNDED)
- `invoice_item_kind` (SERVICE/MILESTONE/HOURLY/PRODUCT/DISCOUNT/TAX/CUSTOM)

**New columns on existing tables:**

| Table | New columns |
|---|---|
| `client_projects` | `priority, assignee, total_cents, currency, archived_at` |
| `milestones` | `amount_cents, approved_at, approved_by, rejection_reason` |
| `tasks` | `priority, completed_at, completed_by` |
| `project_files` | `updated_at, deleted_at, replace_of` (soft-delete + version chains) |
| `messages` | `thread_id, from_client_id, to_uid, to_client_id, to_name, is_from_client, read_at` |
| `invoices` | `subtotal_cents, tax_cents, discount_cents, notes, issued_at, viewed_at, cancelled_at, cancellation_reason, metadata` |

**New tables:**
- `milestone_approvals` — audit trail for client approval/rejection of completed milestones
- `invoice_items` — line items with kind/quantity/unit_price/amount/order
- `payments` — provider-verified payment records with idempotency key, Flutterwave refs, verification meta, failure reason

**New indexes:** `cp_status_idx, ms_proj_status_idx, tk_proj_status_idx, pf_proj_vis_idx, msg_thread_idx, msg_to_admin_idx, msg_to_client_idx, ma_milestone_idx, ma_proj_idx, ii_invoice_idx, inv_client_idx, inv_project_idx, inv_status_idx, pay_client_idx, pay_invoice_idx, pay_provider_ref_idx, n_unread_client_idx`.

Schema file `server/src/db/schema.ts` updated to reflect all additions (1221 insertions / 62 deletions across all files).

### 2.2 Backend API

All endpoints follow the existing envelope `{ success, data | error }`, use `authAdmin/authClient/authAny` middleware, derive `clientId` from the JWT (never trust request body), and call `assertProjectOwnership` for any project-scoped action. Audit logs are written (fire-and-forget, never block response) for every mutation.

**New/extended routes:**

| Method | Path | Phase | Auth | Notes |
|---|---|---|---|---|
| GET | `/cms/labs`, `/cms/labs/:slug` | 4.1 | public | Published lab items (was missing — Labs page had no data source) |
| GET | `/client/dashboard` | 4.6 | client | Active/completed project counts, unread notifications, outstanding invoices, open milestones, pending actions, recent messages, project list |
| GET | `/client/projects/:id/tasks` | 4.4 | client | Client-visible tasks for an owned project |
| POST | `/client/projects/:id/milestones/:mid/approve` | 4.3 | client | Approve COMPLETED milestone → APPROVED; writes `milestone_approvals` row; notifies admin |
| POST | `/client/projects/:id/milestones/:mid/approve` (body `approve:false`) | 4.3 | client | Reject with comment → REJECTED; records rejection reason |
| POST | `/client/projects/:id/files` | 4.5 | client | Client upload, 10 MB cap, strict MIME allowlist, prefix `projects/{pid}/client/`, ownership enforced, admin notification |
| GET | `/client/files/:id/download-url` | 4.5 | client + ownership | Returns signed R2 URL (900s TTL) **after** verifying ownership; falls back to proxied `/files/project/:id` if R2 S3 creds missing |
| POST | `/client/projects/:id/messages` | 4.7 | client | Two-way thread messaging; thread idempotency; attachments list; admin notification; body capped at 4000 chars; MIME/IDOR safe |
| GET | `/client/invoices/:id` | 4.9 | client | Returns invoice + line items; auto-transitions SENT→VIEWED |
| POST | `/client/notifications/:id/read` | 4.8 | client | Mark single notification read (enforced recipient match) |
| POST | `/client/notifications/read-all` | 4.8 | client | Bulk mark read for caller |
| POST | `/admin/projects/:id/files` | 4.5 | admin | Admin upload to project (20 MB, full MIME set); soft-deletes prior same-name file if `?replace=1`; client notification |
| DELETE | `/admin/projects/:id/files/:fid` | 4.5 | admin | Soft-delete (R2 object retained for audit trail) |
| GET | `/admin/projects/:id/messages` | 4.7 | admin | Full thread for project |
| POST | `/admin/projects/:id/messages` | 4.7 | admin | Admin reply in thread; enqueues client notification |
| GET | `/admin/invoices` | 4.9 | admin | Filter by clientId/projectId/status |
| GET | `/admin/invoices/:id` | 4.9 | admin | Invoice with line items |
| POST | `/admin/invoices` | 4.9 | admin | Create invoice with line items; auto-numbers `INV-00001`; if status=SENT on create, enqueues client notification |
| PUT | `/admin/invoices/:id/send` | 4.9 | admin | Transition DRAFT→SENT, set issued_at, notify client |
| GET | `/admin/labs`, `/labs/:id`, POST/PUT/DELETE `/labs` | 4.1 | admin | Full CRUD for Lab items via existing `genCrud` helper (slugify, publishedAt handling) |
| GET/POST/PUT/DELETE `/admin/tasks` | 4.4 | admin | Tasks CRUD with priority, DONE auto-sets `completedAt/completedBy` |
| GET | `/admin/milestones/:id/approvals` | 4.3 | admin | Approval history for a milestone |
| POST | `/payments/verify` | 4.10 | client | Server-side Flutterwave verification: re-fetches tx from provider, checks currency + amount, idempotent on `tx_ref`, supports partial payments → invoice PARTIALLY_PAID, full payment → PAID + admin notification |
| POST | `/payments/webhook` | 4.10 | signature | Flutterwave webhook: checks `Verif-Hash` against `FLW_SECRET_HASH`, idempotent, records payment, marks invoice paid when applicable |
| GET | `/payments` | 4.10 | client | Client's own payments (read-only) |
| POST | `/analytics/pv` | 5.6 | public (rate-limited) | Privacy-friendly page view; IP+UA hashed (SHA-256 prefix), no PII, 60 req/min/IP, never breaks the page on failure |

**Existing route hardening:**
- `/files/project/:id` now also rejects soft-deleted files and correctly handles clientId vs admin access.
- `/client/projects` filters out archived projects (where `archived_at` is not null).
- `/client/projects/:id/files` filters out soft-deleted files.
- `/client/projects/:id/messages` now filters so a client only sees messages they sent or that were addressed to them.
- Admin CRUD `client-projects` PUT now accepts `priority, assignee, totalCents, currency`; `milestones` POST/PUT accepts `amountCents`; CP_FIELDS, MS_FIELDS updated.

### 2.3 AI Model Routing (Phase 5.1)

**New default routing:** all surfaces (public/admin/client/planner/advisor/idea) use **DeepSeek V4 Flash 0731** as primary and **GLM-5.3-Flash** as the only automatic fallback.

- `server/src/ai/models.ts`: default `pickModel()` now returns DeepSeek for all three tiers; `fallbackChain()` explicitly refuses to auto-fallback to any MiniMax model (`!/minimax/i.test(fb)`); added comment documenting the "no auto-escalation" rule.
- `server/src/ai/surface-config.ts`: `DEFAULTS` updated so admin/client/advisor all default to DeepSeek V4 Flash primary + GLM fallback (was MiniMax before).
- `server/src/ai/client-backcompat.ts`: default model when `AI_MODEL` unset is now DeepSeek V4 Flash (was MiniMax).

Admins may still explicitly pick MiniMax via `AI_MODEL*` env vars or the Admin AI Model Control UI — it just won't be silently chosen on fallback.

### 2.4 AI Tools (Phase 5.2 – 5.5)

**Security audit baseline** — every tool handler answers the Phase 5.5 questions:

| Tool | Who | What data | Tenant | Mutate | Confirm | Audit |
|---|---|---|---|---|---|---|
| `search_services/projects/faqs`, `get_pricing`, `list_services` | public/admin | Published CMS only | n/a | no | n/a | no (read) |
| `create_lead` | public | leads | rate-limited by IP | yes (insert) | n/a (public lead capture) | lead_notes row created |
| `admin_list/get_leads`, `admin_draft_reply`, `admin_stats`, `admin_search_projects`, `admin_list_clients`, `admin_list_client_projects`, `admin_get_project`, `admin_list_invoices`, `admin_analytics_overview` | admin only (`ctx.kind==='admin'` check) | CRM/PM/Invoices/Analytics | admin (cross-client by design) | **no — read only** | writes never performed (assistant drafts; admin clicks apply in UI) | reads not audited separately (UI actions already audited) |
| `client_projects/milestones/messages/files/invoices` | client only (`ctx.kind==='client'`); `authProject()` re-checks project ownership per-call | Own data only — every query uses `eq(projectId, <auth-resolved>)` joined with `eq(clientId, ctx.auth.clientId)` | strict tenant isolation | no (read-only) | n/a | no |

**Key enforcement in code:**
- `authProject()` in `tools/index.ts` re-runs the ownership check on every tool call rather than trusting any caller-supplied projectId.
- No tool accepts raw SQL, arbitrary filters across clients, or file bytes.
- No tool performs silent writes; the only writing tool on the client surface would be a draft-message tool (added later as an explicit client action requiring confirmation).
- Prompt-injection: all tool outputs are returned as structured data (not re-injected as instructions); the `create_lead` tool caps all string fields to safe lengths and rate-limits per IP.

### 2.5 Payments Architecture (Phase 4.10)

Implemented as **architecture-only with full safety rails**, because live Flutterwave credentials are not in this sandbox:

- Endpoints return `503 SERVICE_UNAVAILABLE` ("Payment provider not configured.") when `FLW_SECRET_KEY` is absent — they **never** fabricate successful payments.
- Client POSTs only `transaction_id, invoice_id, tx_ref`; amount/currency/status are refetched server-side from `https://api.flutterwave.com/v3/transactions/{id}/verify` with the secret key.
- Idempotency: `idempotency_key = tx_ref` unique index prevents duplicate crediting on retries.
- Currency mismatch and underpayment are handled (PARTIALLY_PAID state).
- Webhook signature verification: compares `Verif-Hash` header to `FLW_SECRET_HASH`; rejects with 401 on mismatch.
- `FLW_PUBLIC_KEY` is safe to expose to the browser (for initializing Flutterwave checkout); `FLW_SECRET_KEY` and `FLW_SECRET_HASH` are never sent to the client.
- `env.ts` documents the three variables.

### 2.6 Audit Logging (Phase 5.7)

All new mutations write audit rows with actorType/actorId/action/entity/entityId/ip/ua/redacted-meta:

- `MILESTONE_APPROVE`, `MILESTONE_REJECT` (client and actor)
- `FILE_UPLOAD`, `FILE_DELETE` (both admin and client uploads)
- `MESSAGE_SEND` (both sides)
- `INVOICE_SEND`, `INVOICE_VIEW`
- `PAYMENT_VERIFY` (success/failure/partial/webhook)
- `NOTIFICATION_READ`
- Existing `CREATE/UPDATE/DELETE` cover Tasks, Lab items, Invoice CRUD, etc.
- `audit.ts` sanitizes any `password/token/secret/authorization/cookie/jwt` keys in meta.

### 2.7 Security Hardening (Phase 5.8 – 5.10)

- **IDOR:** Every project-scoped route calls `assertProjectOwnership()` or verifies `file.projectId → clientId` match before returning data or signing a URL. Notifications and invoices are filtered by `clientId = auth.clientId`.
- **Mass assignment:** All admin POST/PUT bodies go through `pick()` against explicit whitelists (CP_FIELDS, MS_FIELDS, TASK_FIELDS, LAB_FIELDS extended). No `...body` spread.
- **Auth before signing:** The new `/client/files/:id/download-url` endpoint verifies ownership **before** generating a signed R2 URL; previously the bytes-proxy route did this but the project had no signed-URL path that checked ownership.
- **No client-side secrets:** `FLW_SECRET_KEY` is server-only; no JWT signing or Firebase admin creds leak to the bundle.
- **Rate limits:** `create_lead`, page-view tracking, and the existing AI/leads endpoints use `rateLimit()` from `lib/rate-limit.ts`.
- **Error envelope:** Global `app.onError(jsonError)` strips stack traces / DB errors; all thrown errors use the safe `ApiError` with user-facing messages.
- **Soft deletes:** Project files are soft-deleted (preserving R2 object for audit) rather than destroyed.

### 2.8 CORS / Headers / Error Handling

No changes to the existing CORS or security-headers middleware (already applied globally). All new routes go through the same pipeline. Status codes used by new endpoints: 200/201/400/401/403/404/409/413/415/422/429/500/503 — consistent with existing code.

### 2.9 DB Integrity (Phase 5.12)

- All new tables use UUID PKs (consistent `id()` helper).
- `client_projects.status` is the extended enum; the migration adds values without breaking existing ACTIVE/PAUSED/COMPLETED/ARCHIVED rows.
- `milestone_approvals.milestone_id` has an explicit FK to `milestones(id) ON DELETE CASCADE`.
- `invoice_items.invoice_id` FKs to `invoices(id) ON DELETE CASCADE`.
- `payments.invoice_id` is `ON DELETE SET NULL` so historical payment records are preserved even if an invoice is removed.
- `idempotency_key` on payments is a UNIQUE index.
- Soft-delete is used for project files (no destructive deletion of bytes or file rows).
- No destructive migrations: migration 0004 uses `ADD COLUMN IF NOT EXISTS`, `CREATE TYPE … EXCEPTION WHEN duplicate_object`, etc.

### 2.10 Analytics (Phase 5.6)

- `POST /analytics/pv` — lightweight, async, non-blocking (catch-all try/catch); IP/UA hashed; 60 req/min/IP.
- `admin_analytics_overview` AI tool reads leads/clients/projects/invoices/AI-usage counts with 24h windows — minimal PII, aggregated.
- `page_views` uses indexes on (path, created_at) to keep queries fast.

## 3. Build & Typecheck Results

```
$ npx tsc -p server/tsconfig.json --noEmit
(no errors)

$ npx vite build
✓ 2170 modules transformed.
✓ built in ~6s
dist/index.html                     4.71 kB
dist/assets/index-*.css            34.45 kB
dist/assets/index-*.js          2,218.09 kB (gzip 520.99 kB)
```

Pre-existing large-chunk warning is noted; not introduced by these changes.

## 4. Tests Executed

| Test | Result |
|---|---|
| Server TypeScript typecheck (`tsc -p server/tsconfig.json --noEmit`) | ✅ PASS (no errors) |
| Frontend Vite production build | ✅ PASS |
| Migration SQL syntax — review against PostgreSQL 16 syntax; uses `IF NOT EXISTS`, `DO $$ BEGIN … EXCEPTION WHEN duplicate_object $$` blocks that have been tested on Postgres for enum creation | ✅ Manual review |
| Route/handler smoke audit — every new handler throws `ApiError` with safe messages, uses auth guard, calls `assertProjectOwnership` where applicable | ✅ Code audit |

**NOT EXECUTED (require deployment + live credentials):**

- End-to-end HTTP tests against a running Worker (no running wrangler dev in this sandbox — port not exposed persistently).
- Migration applied against a live Neon instance (drizzle-kit migrate not run; operator must run `npm run db:migrate` against `DATABASE_URL`).
- Flutterwave webhook signature verification against a live Flutterwave account (needs `FLW_SECRET_HASH` and a real checkout).
- R2 signed-URL end-to-end flow in production (needs `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`).
- Firebase Auth cross-check for clients that still sign in with Firebase tokens (code path preserved via `verifyFirebaseToken` in `lib/auth.ts`).
- Adversarial/IDOR/prompt-injection tests against a deployed endpoint.
- Client Portal UI wiring for new dashboard/milestone-approval/file-upload/messaging/payment endpoints (see "Remaining UI Work" below).

## 5. Feature Status

| Area | Status | Notes |
|---|---|---|
| 4.1 Site Settings on Neon | **COMPLETE** (already done in Phase 2+3; `/admin/settings/:key` validates key format, audits changes, `/admin/ai/config` invalidates cache) |
| 4.1 AI Lab migration | **COMPLETE** (labs table existed; added `/cms/labs` public endpoint + admin CRUD via genCrud) |
| 4.1 Tolesh Admin tools | **COMPLETE (READ)** Backend. Writes are UI-layer (drafts shown to admin for confirmation). | 5 new read tools added |
| 4.1 Tolesh Client tools | **COMPLETE (READ + invoice read)** Own-data scoping verified per tool. | `client_invoices` added |
| 4.1 Firebase migration inventory | **PARTIAL** Firebase Auth still used as a valid JWT issuer in `lib/auth.ts` for admin and clients (Rule 9: keep Firebase Auth during migration). No Firebase DB/Firestore dependencies remain. |
| 4.2 PM schema extension | **COMPLETE** (priority/assignee/dates/progress/currency/totalCents/archivedAt; status enum extended; additive only) |
| 4.3 Milestones CRUD + approval | **COMPLETE** Admin CRUD extended, client approve/reject endpoint with audit rows in `milestone_approvals`, admin can view approval history. |
| 4.4 Tasks CRUD | **COMPLETE** Admin CRUD with priority/completion tracking; client GET endpoint. |
| 4.5 Project files on R2 | **COMPLETE** Admin upload, client upload, signed-URL download endpoint (auth before signing), soft-delete, version replacement, MIME+size validation, audit logging, cross-client access prevention. |
| 4.6 Client dashboard | **COMPLETE** Backend `/client/dashboard` returns all required aggregates; UI needs wiring. |
| 4.7 Two-way messaging | **COMPLETE** Threads (thread_id), sender/recipient columns, isFromClient, readAt; client POST + admin POST endpoints; notifications on both sides; IDOR-safe message visibility. |
| 4.8 In-app notifications | **PARTIAL/COMPLETE** DB-backed notifications; read endpoints added; enqueue from all new mutations; no email/SMS/WA (per spec). Admin-facing notification list endpoint already exists. Client notification badge/mark-read endpoints added. |
| 4.9 Invoices | **COMPLETE** Full enum, line items, totals computed, status transitions (DRAFT→SENT→VIEWED→PARTIALLY_PAID→PAID; CANCELLED/VOID), send action w/ notification, viewed auto-transition. |
| 4.10 Payments foundation | **COMPLETE (architecture)** Server-side Flutterwave verify + webhook, idempotency, currency/amount validation, partial payments, no fake creds, no frontend secrets. Returns 503 when not configured. Live creds required for real transactions. |
| 5.1 DeepSeek V4 Flash primary, GLM fallback, no MiniMax auto-escalation | **COMPLETE** |
| 5.2 Client AI own-context retrieval | **COMPLETE** All client tools re-verify project ownership per call; no cross-client tools. |
| 5.3 Client AI actions READ/DRAFT/CONFIRM/EXECUTE tiers | **PARTIAL** Read is fully wired. Draft/Confirm/Execute tools require UI "apply" affordance which is not yet built; backend enforces no silent writes. |
| 5.4 Admin AI CRM/Clients/Leads/Projects/Tasks/Milestones/Files/Messages/Invoices/Analytics read | **COMPLETE** (read). Mutating tools (create_invoice, send_message, update_status) intentionally NOT exposed to the model — model drafts, human clicks apply in UI. |
| 5.5 AI context security audit | **COMPLETE** (table in §2.4) |
| 5.6 Analytics foundation | **COMPLETE** Page-view endpoint + admin analytics AI tool; minimal PII; rate-limited. |
| 5.7 Audit logging | **COMPLETE** All new actions enumerated in §2.6 |
| 5.8 Security hardening | **COMPLETE** for backend — IDOR checks on every new endpoint, soft deletes, idempotency keys on payments, signed-URL auth-before-sign, mass-assignment whitelists, CORS/headers already global. |
| 5.9 Frontend security | **PARTIAL** No secrets shipped; localStorage/sessionStorage use unchanged from Phase 2+3 (admin token in sessionStorage only; anon id in localStorage). No client-side auth guards weakened. UI wiring for new endpoints still needs token-error handling for 401/403 on the portal. |
| 5.10 Consistent error handling | **COMPLETE** All new endpoints throw `ApiError`; global `app.onError(jsonError)` returns the standard envelope; no stack traces leaked. |
| 5.11 Performance | **PARTIAL** Added targeted indexes for the new query patterns. Client dashboard uses `Promise.all` for concurrent aggregates. Bundle size warning is pre-existing and not addressed here. |
| 5.12 DB integrity | **COMPLETE** See §2.1 and §2.9 |
| 5.13 Cross-system testing | **PARTIAL** Typecheck + build pass. Migration, route, authz, negative, AI, integration tests against a live endpoint are NOT EXECUTED (see §4). |
| 5.14 Adversarial testing | **NOT EXECUTED** (requires deployment + scripted IDOR/spoof/replay/prompt-injection suite). |
| 5.15 UI audit / remove fake buttons | **PARTIAL** New backend endpoints exist; Client Portal UI needs to be wired to hit them (dashboard, message composer, file upload, milestone approve/reject, invoice view + pay button). Admin UI: new Labs CRUD works via existing GenericCRUD once the Labs section points to `/admin/labs`; Tasks, Project Files, Messages, Invoices need admin section components. Buttons that were already fake (no backend wired) now have a backend to connect to. |
| 5.16 Documentation | **COMPLETE** (this document). |

## 6. Remaining Firebase Dependencies

The only remaining Firebase integration is **authentication** (`lib/firebase-jwt.ts`, the `firebase` auth branch in `lib/auth.ts`, and `firebase.ts` in the frontend). This is explicitly preserved per Rule 9 ("Keep Firebase Auth during the migration — we haven't been told to kill it yet").

There are **no remaining Firestore/Firebase DB/Realtime Database/Storage** dependencies anywhere in the codebase — all data lives in Neon (R2 for binary). The migration verification from Phase 2+3 remains valid; Phase 4 adds new Neon tables rather than introducing any alternative store.

## 7. Manual Post-Deployment Steps

1. **Run migrations:**
   ```
   DATABASE_URL=<neon-dsn> npm run db:migrate
   ```
   This applies `0004_phase4_operations.sql` (additive; safe on existing DB).
2. **Set secrets (via `wrangler secret put` or dashboard):**
   - Required: `DATABASE_URL`, `JWT_SECRET`
   - Payments (optional — endpoint returns 503 until set): `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_SECRET_HASH`
   - R2 signed URLs (optional — files fall back to Worker proxy if absent): `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
   - Firebase (if using Firebase Auth): `FIREBASE_PROJECT_ID`
3. **R2 bucket binding:** Ensure the Worker has the `ASSETS` R2 bucket bound (already present from Phase 2+3).
4. **Smoke test (once deployed):**
   - Login as admin, create a client, create a project, upload a file, post a milestone, mark COMPLETED.
   - Login as client (access code flow), view dashboard, see milestone, approve it, send a message, upload a file, view invoice.
   - For payments: set up a Flutterwave webhook pointing to `/payments/webhook` with the `Verif-Hash` secret.
5. **Verify AI routing:** With `AI_API_KEY` set and no `AI_MODEL*` overrides, confirm that `/assistant/chat` logs `deepseek-ai/DeepSeek-V4-Flash-0731` as the model and falls back to `zai-org/GLM-5.3-Flash` on upstream failure (not MiniMax).
6. **Frontend wiring:** Wire the new Client Portal pages/dashboard/message-composer/file-upload/milestone-approval/invoice-view components to the `/client/*` endpoints listed in §2.2. The backend is ready.

## 8. Known Limitations

- **No live integration tests run** in this sandbox — the Worker was not started against a live Neon + R2 + Flutterwave sandbox. All code has been type-checked and reviewed against the existing architectural patterns that were verified in Phase 2+3.
- **No email/SMS/WhatsApp** — by design (spec §4.8 says "DB-backed; no fake email/SMS/WA").
- **No currency conversion** — invoices are single-currency; payments must match invoice currency.
- **No PDF generation for invoices** — `pdf_r2_key` column exists but no renderer is wired in this phase; admins can upload a generated PDF via media and link it.
- **R2 cleanup job not implemented** — soft-deleted files are kept for audit. A future lifecycle job can purge R2 objects after a retention window.
- **MiniMax still available for explicit selection** — if an admin explicitly chooses MiniMax in the AI Model Control UI, it will be used. This is intentional; the hard rule is "must NOT auto-escalate", not "must never be available".
- **Bundle size warning** on the frontend (`index-*.js` 2.2 MB / 521 kB gzip) is pre-existing and not addressed by this phase; code-splitting is a future optimization.

## 9. Files Changed / Added

**Modified (11):**
- `server/src/db/schema.ts` — new enums, columns, tables
- `server/src/env.ts` — added FLW_* env vars
- `server/src/index.ts` — mounted `/analytics`, `/payments`
- `server/src/routes/admin.ts` — extended CP_FIELDS/MS_FIELDS, added TASK_FIELDS/LAB_FIELDS, milestone approval history, tasks CRUD, project files admin upload+soft-delete, project messages admin post, invoices CRUD+send, lab items CRUD
- `server/src/routes/client.ts` — complete rewrite: dashboard, tasks, milestone approve/reject, file upload, signed download URL, message posting, invoice detail, notification read/read-all; proper AuthContext typing and ownership checks
- `server/src/routes/cms.ts` — added `/cms/labs`, `/cms/labs/:slug`
- `server/src/routes/files.ts` — rejects soft-deleted project files; admin/client auth consistent
- `server/src/ai/models.ts` — default primary = DeepSeek V4 Flash for all tiers; fallbackChain refuses MiniMax auto-escalation
- `server/src/ai/surface-config.ts` — DEFAULTS use DeepSeek for admin/client/advisor surfaces
- `server/src/ai/client-backcompat.ts` — default model changed to DeepSeek V4 Flash
- `server/src/ai/tools/index.ts` — added admin read tools (clients, projects-with-detail, invoices, analytics overview) and client invoices tool; strict tenant gating

**Added (3):**
- `server/drizzle/0004_phase4_operations.sql` — additive migration
- `server/src/routes/analytics.ts` — privacy-friendly page view tracking
- `server/src/routes/payments.ts` — Flutterwave verify + webhook (server-side, idempotent, signature-verified), client payment history

Commit: `eeea0aa` on `arena/01a09826-toluenetech`, pushed.
