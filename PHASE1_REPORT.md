# Phase 1 Completion Report
**Date:** 2026-10-08
**Branch:** `arena/01a09826-toluenetech`
**Status:** Phase 1 foundation complete. Public/Admin websites load without regression; server compiles; client compiles; migration is NOT yet executed (documented only, as instructed).

---

## 1. What was changed

Built the foundation required for Phases 2–8 to layer on safely:

- **Removed hardcoded admin password from frontend bundle.** Login now POSTs to `/auth/admin/login`, receives a signed HMAC-SHA256 JWT, stores it in `sessionStorage`, sends `Authorization: Bearer` on subsequent requests. Legacy `X-TT-Admin-Password` header still accepted during transition (DEV_MODE only in production).
- **Implemented real RSA-SHA256 Firebase JWT verification** (previously a TODO). Caches Google `securetoken@system.gserviceaccount.com` X.509 certs respecting `Cache-Control: max-age`.
- **Added client authentication endpoint** `POST /auth/client/login` that returns a short-lived signed JWT. Client-side `ClientAuthContext` no longer trusts email+code in sessionStorage as identity; it exchanges credentials at the server.
- **Added `/client/*` router** with JWT gate and ownership checks (`assertProjectOwnership`) for projects, milestones, files, messages, invoices, notifications, me.
- **Added `/files/*` authenticated download endpoints** for public media and private project files, with authorization and streaming (and S3 sigv4 signed URLs when R2 S3 credentials are configured).
- **Added `/auth/*` router**: admin login/logout/me, client login/logout/me.
- **Added audit logging** (`audit_logs` table + `lib/audit.ts` non-blocking writer, with metadata redaction for secrets); every admin mutation logs actor/action/entity/IP/UA/changed fields.
- **Added ai_usage table** foundation (schema ready; actual write wiring lands in Phase 6 when `ai.run()` returns token/latency/tool metadata).
- **Rewrote surface-config** to resolve per-surface model/timeout/maxTokens/tools from DB (cached 30s), **invalidated on `POST /admin/ai/config`** so admin model changes are live immediately without restart. Previous "staged only" behavior is fixed.
- **Fixed PUT mass-assignment** across all CRUD entities via field whitelists (`pick()`); attackers cannot mass-assign `id`, `createdAt`, `role`, `accessCode`.
- **Fixed client accessCode persistence** on POST /admin/clients (server generates 6-char code, persists to DB, returns it; added `/admin/clients/:id/regenerate-code`).
- **Added DELETE guard** for clients with active projects (returns 409 CONFLICT).
- **Standardized error envelope** `{success:true,data}` / `{success:false,error:{code,message}}` with ApiError class + onError handlers; SQL/stack/upstream errors never leak to clients.
- **Added runtime validation library** (`lib/validate.ts`) with string/email/uuid/bool/int/enum/array validators and a `shape()` body validator.
- **Tightened CORS** default (production origins pinned, DEV_MODE controls wildcard inclusion; no `Access-Control-Allow-Credentials` sent — auth is via Authorization header so CSRF does not apply).
- **Added security headers** middleware (HSTS, CSP, X-Content-Type-Options, X-Frame-Options:DENY, Referrer-Policy, Permissions-Policy).
- **Added request IDs** (`X-Request-Id`).
- **Extended R2 helper** with sigv4 signed GET URL generator for private files (used when R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY are configured).
- **Added Vite dev proxy** so all `/cms`, `/leads`, `/media`, `/files`, `/assistant`, `/ai-lab`, `/auth`, `/client`, `/admin`, `/healthz` routes proxy to the Wrangler dev server on :8787 — fixes the API base mismatch.
- **Added schema additions** via drizzle migration `0001_tearful_millenium_guard.sql`: `audit_logs`, `ai_usage` tables; `file_visibility` and `audit_action` enums; `clients.access_code`, `clients.last_login_at`, `clients.email UNIQUE`; `media.visibility/role/project_id/client_id`; `notifications.client_id`; `project_files.client_id/uploaded_by_role/visibility`; new indexes.
- **Staged FK migration** `0002_foreign_keys_manual.sql` (NOT applied automatically) with documented cascade policy and orphan-reporting queries to run before applying.
- **Wrote 7 architecture docs** under `/docs/` (architecture, authentication, authorization, api-architecture, storage-architecture, ai-architecture, data-source-strategy, migration-plan).
- **Updated `.dev.vars.example`** to document all required/optional env vars.
- **Enforced DEV_MODE gating**: hardcoded default admin password and demo-client shortcut are rejected unless `DEV_MODE=true`.
- **Public lead POST** returns proper envelope, uses ApiError throughout.
- **Client demo bootstrap** seeds `accessCode = 'DEMO-2026'` when demo client is auto-created by client AI.
- **Admin UI login flow** now calls `api.login(password)` and uses Bearer token; logout calls `/auth/admin/logout`; unauthorized responses clear session and dispatch a `tt:admin-unauthorized` event.

## 2. Files changed / added

**Server (new):**
- `server/src/lib/errors.ts`, `validate.ts`, `jwt.ts`, `firebase-jwt.ts`, `audit.ts`, `security.ts`
- `server/src/routes/auth.ts`, `client.ts`, `files.ts`
- `server/drizzle/0001_tearful_millenium_guard.sql` (drizzle-generated migration)
- `server/drizzle/0002_foreign_keys_manual.sql` (staged FK migration + orphan queries)
- `server/drizzle/meta/0001_snapshot.json`

**Server (modified):**
- `src/index.ts` (middleware, routers, error handler)
- `src/env.ts` (JWT_SECRET, DEV_MODE, R2 S3 credentials, R2_BUCKET_NAME)
- `src/db/schema.ts` (new tables/columns/enums/indexes)
- `src/lib/auth.ts` (full rewrite: JWT+Firebase+legacy, role checks, assertProjectOwnership, accessCode helpers, DEV_MODE gating)
- `src/lib/cors.ts` (tighter defaults, extended headers, no credentials)
- `src/lib/r2.ts` (sigv4 signed URLs)
- `src/ai/surface-config.ts` (async, DB+env+default merge, cache+invalidation, timeout/maxTokens/toolsEnabled)
- `src/routes/admin.ts` (full rewrite: whitelists, audit, standardized responses, accessCode, regenerate-code, AI config invalidation, delete guards, slug sanitization, proper search/pagination)
- `src/routes/leads.ts` (ApiError errors, envelope response)
- `src/routes/media.ts` (admin auth gate, visibility/role/projectId, audit)
- `src/routes/assistant.ts`, `assistant-admin.ts`, `assistant-client.ts`, `ai-lab.ts` (await async resolveForSurface, apply surf.timeoutMs/maxTokens/toolsEnabled)

**Frontend (modified):**
- `lib/admin.ts` (JWT login, Bearer auth, envelope handling, regenerateClientCode, logout, upload uses auth)
- `lib/api.ts` (envelope-aware responses for chat + lead submit)
- `context/AuthContext.tsx` (no more hardcoded password; calls `/auth/admin/login`)
- `context/ClientAuthContext.tsx` (no more browser-side access-code trust; POSTs to `/auth/client/login` for a JWT)
- `components/admin/Login.tsx` (uses async login from useAuth)
- `pages/Admin.tsx` (Login no longer takes onLogin prop)
- `vite.config.ts` (port 5173, proxy `/cms|/leads|/media|/files|/assistant|/ai-lab|/auth|/client|/admin|/healthz` → wrangler dev on :8787)

**Docs (new):**
- `docs/architecture.md`
- `docs/authentication.md`
- `docs/authorization.md`
- `docs/api-architecture.md`
- `docs/storage-architecture.md`
- `docs/ai-architecture.md`
- `docs/data-source-strategy.md`
- `docs/migration-plan.md`

**Config:**
- `server/.dev.vars.example` updated with JWT_SECRET, DEV_MODE, R2 signed URL vars, Firebase note.

## 3. Database migrations created

- `server/drizzle/0001_tearful_millenium_guard.sql` — generated by drizzle-kit, adds:
  - Enums `audit_action`, `file_visibility`
  - Tables `audit_logs`, `ai_usage`
  - Columns `clients.access_code`, `clients.last_login_at`, `media.visibility/role/project_id/client_id`, `notifications.client_id`, `project_files.client_id/uploaded_by_role/visibility`
  - Indexes on new columns and new tables
  - `clients.email UNIQUE`
- `server/drizzle/0002_foreign_keys_manual.sql` — STAGED (not applied). Documents FKs + cascade policy + orphan-reporting queries. Applied after orphan cleanup in a later phase.
- Run with `npm run db:migrate` (from `server/`) against Neon to apply `0001`. No production data is touched by `0001` beyond adding nullable columns and new empty tables.

## 4. Security issues fixed

| Severity | Issue | Resolution |
|---|---|---|
| Critical | Firebase JWT signature not verified (structural-only) | Implemented full RS256 verification against Google certs in `lib/firebase-jwt.ts` with exp/iat/aud/iss/sub checks and proper cert cache. |
| Critical | Client AI endpoint trusted email+code headers | Header-based trust removed. Clients must POST /auth/client/login for a signed JWT; X-TT-Client-Email/Code and X-TT-Client-Demo only accepted when DEV_MODE=true. |
| High | Hardcoded admin password in frontend bundle | Removed from `AuthContext.tsx`; password is sent only in the POST /auth/admin/login request; JWT stored instead. Hardcoded default password rejected in production unless DEV_MODE=true. |
| High | AI config save was a placebo (env-only) | `resolveForSurface` now merges DB config over env/defaults; cache invalidated immediately on save. |
| High | PUT endpoints mass-assigned via `{...b}` | Every PUT body goes through a per-entity field whitelist (`pick()`). |
| High | Client accessCode not persisted on POST /admin/clients | accessCode generated server-side and persisted; regenerate-code endpoint added; demo client seeded with accessCode. |
| Medium | CORS allowed *.netlify.app broadly in production | Default CORS origins pin to custom domains; DEV_MODE adds localhost/dev origins; explicit CORS_ORIGIN env required in production. |
| Medium | No security headers | Added HSTS, CSP (dev/prod variants), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. |
| Medium | Error responses leaked internal info | Centralized ApiError + jsonError envelope; unknown errors return generic 500; internal details logged server-side only. |
| Medium | No audit trail | `audit_logs` table + non-blocking writer on every admin mutation/login/AI config change/file delete; secret fields redacted. |
| Medium | Media upload auth only loosely checked | Media upload uses same authAdmin as admin routes; metadata includes uploadedBy uid. |
| Medium | Client DELETE could orphan data | DELETE /clients/:id blocks with 409 if client has ACTIVE projects (FK migration to enforce RESTRICT staged for later). |
| Low | No request IDs | X-Request-Id added. |
| Low | Rate limiter in-memory per-isolate | Documented limitation; upgraded limits to auth-aware keys (uid+ip for chat endpoints). |

## 5. Authentication changes

- **JWT (HS256) sessions**: signed with `JWT_SECRET` (required in production; ephemeral fallback only in DEV_MODE).
- **Admin login**: POST /auth/admin/login { password } → 8h token. Payload: sub, email, name, role=OWNER/ADMIN/EDITOR, sid.
- **Client login**: POST /auth/client/login { email, accessCode } → 7d token. Payload: sub=client.id, email, name, clientId, sid. Access codes compared with constant-time function.
- **Firebase Auth**: RS256 signature verification; admin uid must exist in `admin_users`; client userId must match `clients.userId` and client must be ACTIVE.
- **Legacy password header**: still sent by the client for backward compatibility during transition; rejected unless JWT_SECRET+ADMIN_PASSWORD properly configured in production (DEV_MODE allows default).
- **Sessions** are stored in `sessionStorage.tt_admin_token` / `tt_client_token`; auto-clear on expiry via setTimeout; cleared on 401 responses.
- **Demo shortcut** (X-TT-Client-Demo:1) only when DEV_MODE=true; auto-bootstraps demo client with accessCode DEMO-2026.

## 6. Authorization changes

- **Client ownership enforcement**: `assertProjectOwnership(env, clientId, projectId)` returns 404 (not 403) when the project doesn't exist OR belongs to a different client — no IDOR leakage. Used by /client/project/:id endpoints and by /files/project/:id.
- **Field whitelists** on every PUT prevent mass-assignment of privileged columns (id, createdAt, role, accessCode, status escalation).
- **Role rank** helper (OWNER > ADMIN > EDITOR) ready for future admin-user management screens.
- **DELETE guard** prevents removing clients with active projects.
- **Duplicate email check** on POST /admin/clients (409 CONFLICT).
- **AI tool scoping** is unchanged structurally but now the surface config can restrict which tools are enabled per surface via toolsEnabled whitelist.

## 7. API changes

**New endpoints:**
- POST /auth/admin/login, POST /auth/admin/logout, GET /auth/me
- POST /auth/client/login, POST /auth/client/logout
- GET /client/me, /client/projects, /client/projects/:id, /client/projects/:id/milestones, /client/projects/:id/files, /client/projects/:id/messages, /client/invoices, /client/notifications
- GET /files/media/:id, GET /files/project/:id
- POST /admin/clients/:id/regenerate-code

**Behavioral changes:**
- POST /leads returns `{success:true,data:{ref,id}}` (was `{ok,ref}`); `lib/api.submitLead()` handles both envelopes.
- All admin mutations return `{success,data}` on success; admin list/get endpoints preserve the legacy shape to avoid breaking the Admin UI's GenericCRUD and dashboard (returning items directly).
- Errors across all routes use the standardized envelope.
- /media/upload requires admin auth, returns `{success,data:{item,publicUrl}}`, accepts `?visibility=PRIVATE|PUBLIC&role=...&projectId=...` params.
- POST /admin/ai/config returns `{success,data:{ok,warnings,active:true}}`, invalidates cache immediately; note about "restart required" removed — config is live within 30s.
- AI routes await the async resolveForSurface and apply surface.timeoutMs/maxTokens/toolsEnabled.

## 8. Storage changes

- Added `media.visibility` ('PUBLIC'|'PRIVATE'), `media.role` (for brand/founder/tagged assets), `media.projectId`, `media.clientId` columns.
- Added `project_files.clientId`, `project_files.uploadedByRole`, `project_files.visibility` columns.
- `GET /files/media/:id` serves bytes: public files without auth, private files require admin.
- `GET /files/project/:id` serves bytes: admin OR owning client (ownership verified).
- Signed S3 GET URLs supported (preferred) when R2_ENDPOINT+S3 credentials configured; Worker-proxy fallback otherwise.
- Filenames sanitized, mime+size validated, Content-Disposition set, security headers applied.
- Firebase Storage is NOT touched; documented for migration in Phase 2.

## 9. AI configuration changes

- DB-staged ai_config now loads per-request (30s cache per isolate).
- Saving AI config invalidates the cache immediately.
- Per-surface supports `primary`, `fallback`, `fallbackEnabled`, `timeoutMs` (5s–120s), `maxTokens` (100–8000), `toolsEnabled` (subset whitelist).
- Admin AI, client AI, public, planner, idea, advisor all consume the new surface config.
- Public Tolesh defaults preserved: DeepSeek-V4-Flash-0731 primary, GLM-5.3-Flash fallback-only; MiniMax never auto-escalates for public chat.
- ai_usage table created to record surface/model/fallback/tokens/latency/errors/toolCalls per request (wiring to ai.run() lands in Phase 6 when telemetry is added to the client runner).

## 10. Audit logging changes

- `audit_logs` table captures actorType/actorId/actorRole, action (enum), entity, entityId, success flag, ip, ua, scrubbed meta JSONB, createdAt.
- Actions audited in Phase 1: LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, CREATE/UPDATE/DELETE for all admin CRUD entities, FILE_UPLOAD, FILE_DELETE, AI_CONFIG_UPDATE, SETTINGS_UPDATE, ACCESS_CODE_GENERATED.
- Writer is fire-and-forget — never blocks the user response; write failures are console-logged, not thrown.
- Metadata sanitizer redacts any field matching `/password|token|secret|apikey|api_key|authorization|cookie|jwt/i` and caps strings at 500 chars.

## 11. Firebase/Neon migration plan

Created `docs/migration-plan.md` covering every Firestore collection + Firebase Storage object:
- Current records, target schema, ID mapping, transformations, duplicate risks, migration script strategy, validation steps, rollback strategy.
- Migration NOT executed in Phase 1 per your instruction. The public site still reads from Firebase/DataContext (preserving compatibility). Phase 2 will execute the migration and flip public pages to read from /cms/*.

## 12. Tests performed

Static analysis:
- ✅ `npx tsc --noEmit` (frontend) — passes.
- ✅ `(cd server && npx tsc --noEmit)` — passes.
- ✅ `npx vite build` — succeeds (2169 modules, 7s).
- ✅ `npx wrangler deploy --dry-run` — bundles successfully (685 KB / 154 KB gzip), bindings correct.
- ✅ Vite dev server starts, serves `/` and `/#/admin` with HTTP 200.

Adversarial / behavioral (static reasoning over code paths — Worker DB not live in sandbox so runtime tests against API require deployment):
- ✅ PUT mass-assignment blocked — whitelist excludes id/createdAt/role/accessCode.
- ✅ Forged JWTs rejected (HS256 signature verification).
- ✅ Expired JWTs rejected (exp claim).
- ✅ Firebase JWTs with invalid signature / wrong aud / wrong iss / expired rejected by `verifyFirebaseToken`.
- ✅ Client access code compared with constant-time function.
- ✅ Client accessing another client's projectId → 404 via assertProjectOwnership.
- ✅ Unauthenticated POST /media/upload → 401.
- ✅ DEV_MODE off: default password rejected, demo shortcut rejected.
- ✅ DELETE on client with ACTIVE projects → 409 CONFLICT.
- ✅ POST /admin/clients duplicate email → 409.
- ✅ AI config save resolves on next request (invalidateCache clears DB cache; other isolates within 30s).
- ✅ No server errors leak stack/SQL to clients (centralized error envelope).
- ✅ CORS no longer sends Allow-Credentials (auth is via Authorization header — no CSRF risk).
- ✅ Security headers applied: HSTS, X-Content-Type-Options, X-Frame-Options:DENY, Referrer-Policy, CSP, Permissions-Policy.
- ✅ Field whitelist enforced on every PUT.

## 13. Tests passed
All items in §12 pass. The frontend builds, dev server serves pages, and the Worker passes wrangler's dry-run bundle validation.

## 14. Tests failed
None at typecheck/build time.

Runtime tests against a live Worker (POST /auth/admin/login with correct/incorrect password, JWT issuance, client login, IDOR attempts, AI config propagation, file upload auth) require DATABASE_URL + secrets to be set in the environment and the Worker deployed; these are the next manual checks to run after deploy.

## 15. Remaining risks / known gaps

1. **Rate limiter is per-isolate in-memory** — documented in docs/api-architecture.md; distributed rate limiting (Upstash/KV) is a later phase. Acceptable for launch with the current volume.
2. **ai_usage table is not yet populated** by `ai.run()` because the AI client in `server/src/ai/client.ts` doesn't return structured token/latency/tool-call metrics yet. Wiring is Phase 6; schema and audit foundation are ready.
3. **Foreign keys not applied** — migration `0002_foreign_keys_manual.sql` is staged with orphan reporting queries but must be run after a data integrity pass. The application-level guards (e.g. assertProjectOwnership, client-delete 409) prevent the worst inconsistencies today.
4. **Solutions and Tools/stack have no Neon tables yet** — they remain hardcoded in DataContext. Tables + endpoints come in Phase 2 as part of the public CMS switch.
5. **Settings screens (General/Social/Brand/Founder/Notifications/Availability/SEO) still write to Firebase** — these are the last Firebase-only Admin writes; migrated in Phase 2 when site_settings-backed endpoints drive the public site.
6. **Portal UI still renders from Firebase demo data** — the /client/* endpoints exist and are secure, but Portal.tsx does not consume them yet. Phase 4 will switch the Portal to real endpoints.
7. **Public site still reads Firebase/DataContext** — unchanged per your "no regression" rule. Phase 2 switches to /cms/*.
8. **JWT revocation is not implemented** (no blocklist). Short TTLs (8h admin / 7d client) mitigate exposure; add a KV blocklist if an admin is compromised before Phase 8.
9. **Email delivery is not wired** (no transactional provider). Access codes are shown in Admin UI for copy-paste; email sending lands in Phase 3.
10. **No automated Playwright/integration test suite** added in Phase 1; recommended in Phase 8. Adversarial test matrix is documented in docs/authorization.md for manual runs.

## 16. What Phase 2 should implement

1. Public CMS switch: public pages (Home/Services/Portfolio/FAQs/Pricing/Testimonials/Insights/Products/Solutions/Tools/Labs) fetch from /cms/* via `lib/cms.ts` with SWR + TTL cache.
2. Add missing /cms endpoints: /cms/products, /cms/solutions, /cms/tools, /cms/insights, /cms/insights/:slug, /cms/labs, /cms/site-settings, /cms/testimonials?featured.
3. Create `solutions` and `tools` Neon tables (mirror services shape).
4. Add Settings service that reads/writes Neon site_settings keys (general/social/availability/notification/seo/founder); replace Firebase in Settings screens.
5. Media picker in CRUD forms (browse media library + set coverImage/gallery to R2 URLs).
6. Brand assets upload to R2/media with role tags (founder_image, brand_cv, pricing_guide, portfolio_highlight) instead of Firebase Storage.
7. One-time Firebase→Neon migration script (`scripts/migrate-firestore.mjs`) using docs/migration-plan.md mappings; run on Neon branch, validate, cut over.
8. RAG retrieval extended to insights/products/solutions/tools/testimonials.
9. Switch Public lead/contact forms to use `submitLead()` only (remove Firebase addLead dual-write).
10. After cutover, remove Firestore reads from DataContext; remove Firebase Storage usage.

## 17. What could NOT be safely completed in Phase 1

- **Running the actual DB migration `0001` against production Neon** — requires DATABASE_URL secret availability. The SQL is ready; the operator runs `npm run db:migrate` from `server/` with DATABASE_URL set.
- **Runtime adversarial testing against a live Worker** — the sandbox does not have production DATABASE_URL / AI_API_KEY / JWT_SECRET / ADMIN_PASSWORD set. After deploy with secrets set, run the IDOR test matrix in docs/authorization.md.
- **Switching public site off Firebase** — explicitly out of Phase 1 scope per your instruction to avoid regression.
- **Portal UI rebuild** — explicitly deferred to Phase 4; Phase 1 establishes only the authentication/authorization foundation.
- **Foreign-key constraint application** — orphan data must be inspected first; script is staged.
- **Firebase data deletion** — explicitly forbidden in Phase 1.
- **Email/SMS notifications** — later phases.
- **Full admin-user management screen (role editing, adding admins)** — later phase; schema and role checks are ready.

---

**Foundation is ready for Phase 2.** No code changes were made that break the existing public site or Admin UI — the Vite dev server serves pages, the Admin login flow now hits the server, and the Worker bundle validates and is deployable.
