# Toluene Tech — Complete Backend Connection & Data-Flow Audit
# Master Implementation Blueprint

**Audit date:** 2026-10-08
**Audited state:** commit tree on branch `arena/01a09826-toluenetech` (post admin-blank-page fix + mobile-responsiveness refactor).
**Scope:** entire frontend (`pages/`, `components/`, `context/`, `lib/`), Cloudflare Worker backend (`server/src/`), Neon/Postgres schema (`server/src/db/schema.ts`, drizzle migrations), Firebase (`firebase.ts`, `context/DataContext.tsx`), AI layer (`server/src/ai/`), R2 storage (`server/src/lib/r2.ts`).

---

## 1. Executive Summary

The Toluene Tech platform currently has **two disconnected data planes** and one **partially complete server**. Many Admin screens *look* fully connected because they render polished UI and hit API endpoints, but cross-surface propagation is broken:

- **Plane A — Neon + Worker (`server/src/`)** is the intended production source of truth. It has a well-designed 20-table Postgres schema, Hono routes for CMS/CRUD/leads/AI/media, auth helpers, R2 uploads, rate limiting, AI chat for public/admin/client, AI Lab, and RAG retrieval.
- **Plane B — Firebase (`context/DataContext.tsx` + `firebase.ts`)** is the **active source the public website and Client Portal actually consume**. It holds hardcoded `DEFAULT_*` seed data (8 services, 13 solutions, 5 FAQs, demo client/projects/milestones/files/messages, tools list, founder note, social links, site settings, site notification) and reads/writes Firestore + Firebase Storage. It fires *lead* dual-writes to Plane A as a best-effort fetch but otherwise **does not read anything from Neon/Worker**.

The result is the core architectural defect of the platform today:

> **Admin edits to Services / Portfolio / FAQs / Pricing / Testimonials / Insights / Products / Settings / Brand / Social / Founder / Notifications / Availability / Clients / Projects / Milestones / Files / Messages go to either Neon OR Firebase depending on which screen you are on, and the public website only sees Firebase.** The public `/cms/*` Worker endpoints exist but are **never called by the public site**. The AI (Tolesh) reads from **Neon**, so AI answers can contradict what the public website displays.

Additionally:

- **AI Model Control** UI saves a `site_settings.ai_config` JSON blob, but `server/src/ai/surface-config.ts` reads *only Worker environment variables (`AI_MODEL_*`)* and never consults the DB. The "Save configuration" button is a placebo — the server reply even admits it ("staged in DB. Apply to Worker env… restart required").
- **Client Portal auth** verifies an email + access code against the **Firebase** client list (hardcoded demo `DEMO-2026` only out of the box) in sessionStorage. The Worker's `/assistant/client` has its own independent `authClient()` that accepts a `X-TT-Client-Email`/`X-TT-Client-Code` header (same demo creds + JWT placeholder) — there is no shared session or server-side portal login. The Portal UI reads data only from Firebase `useData()` (hardcoded demo project/milestones/messages).
- **Admin auth** is a hardcoded password (`iloveesther221@@`) sent as `X-TT-Admin-Password`. Firebase JWT support is scaffolded (`authAdmin` checks structural claims) but **RSA signature verification is an explicit TODO** (`auth.ts` lines 54-62: "we rely on (a) HTTPS-only, (b) exp check, (c) aud/iss check, (d) DB membership check").
- **Schema has zero foreign-key constraints.** All relations are `varchar(36)` columns with app-level joining. No cascade deletes, no FK integrity.
- **Missing entities/tables:** no tasks, project_files, messages, invoices, notifications, admin_users rows are seeded or wired to Admin UI CRUD for many of them; several Admin sections are placeholders (`Messages`, `Files`, `Invoices` = ComingSoon; `Tools` uses Firebase `DEFAULT_TOOLS`).
- **Missing endpoints:** no public `/cms/products`, `/cms/solutions`, `/cms/insights`, `/cms/testimonials?featured`, `/cms/site-settings`, no client-project endpoints outside Admin, no file signed-URL download endpoint, no invoice endpoints, no notification endpoints, no RAG for insights/products/solutions/tools.
- **Public pages use `useData()` (Firebase) exclusively.** Admin CMS sections (Services, Portfolio, FAQs, Pricing, Testimonials, Insights, Products) use `GenericCRUD` which hits **Worker /admin/\*** (Neon). They write to Neon, but the public site never reads Neon. Edits are invisible to visitors.
- **Settings pages (General, Social, Notifications, Availability, SEO, Brand, Founder) use `useData()` → Firebase.** They do not hit `/admin/settings`.
- **Dashboard, Leads, Clients, Jobs (client-projects), Milestones, Media, AI sections hit Worker / Neon.**
- **Solutions, Tools, Labs** are entirely Firebase-only (hardcoded `DEFAULT_SOLUTIONS`, `DEFAULT_TOOLS`) with no Neon table for solutions/tools at all (`labItems` exists in schema but Admin "Labs" is ComingSoon).

Below is the section-by-section audit you requested.

---

## 2. Complete Admin Feature Inventory

Classifications used: ✅ Fully connected · 🟡 Partially connected · ❌ Frontend only / placeholder · ⚠️ Connected but to wrong data source / dead-end · 🔌 Backend exists, UI not wired.

### Navigation frame
| Item | Class | Notes |
|---|---|---|
| Sidebar collapse (`tt_admin_collapsed` localStorage) | ✅ | `sidebarState` store, persists in localStorage. |
| Mobile hamburger + drawer | ✅ | AnimatePresence, body scroll lock, route-change auto-close. |
| Topbar health indicator (`/healthz`) | ✅ | Hits Worker `/healthz`, JSON/content-type guarded. |
| Sign out button | ✅ | Calls `AuthContext.logout()` which clears `sessionStorage`. |

### Dashboard
| Item | Class | Notes |
|---|---|---|
| Stat cards (Projects/Leads/Clients/Content) | ✅ | `GET /admin/stats` → Neon. |
| Recent leads list | ✅ | Same endpoint. |
| Recent projects list | ✅ | Same endpoint. |
| Quick action cards | ❌ | `nav()` only; no data load. |
| "Ask Tolesh AI" button | ✅ | Routes to `/admin/ai/chat`. |

### CRM

**Leads**
| Item | Class | Notes |
|---|---|---|
| Filter pills (All/NEW/…/LOST counts) | ✅ | `GET /admin/leads?status=&source=&q=` → Neon. |
| Search (name/email/company/ref) | ✅ |  |
| Source filter | ✅ |  |
| Data table | ✅ |  |
| Row → drawer (contact, project, notes, status buttons) | ✅ | `GET/PUT /admin/leads/:id` |
| New lead modal | ✅ | `POST /admin/leads` (generates TT-#### ref server-side). |
| Edit row / delete row | ✅ | `PUT/DELETE /admin/leads/:id`. |
| Status update buttons (8 states) | ✅ |  |
| Add note | ✅ | Appended via `PUT /admin/leads/:id` `notes` field. |
| Lead → convert to Client | ❌ | UI: no "Convert to client" button exists. Backend: `leads.convertedClientId` column exists but no API sets it; no endpoint creates a Client from a Lead. |
| Lead source analytics/reporting | ❌ | Not shown. |
| Follow-up reminders (`followUpDate`) | ❌ | Column exists in schema; no UI, no scheduler/notification. |
| Lead assignment | ❌ | No `assignedTo` column, no UI. |
| Lead activity/history timeline | ❌ |  |

**Clients**
| Item | Class | Notes |
|---|---|---|
| List/search | ✅ | `GET /admin/clients` |
| New client drawer (name/email/phone/company) | ✅ | `POST /admin/clients` returns `accessCode`. |
| View client (contact, project list) | ✅ | `GET /admin/clients/:id` joins projects. |
| Edit/delete | ✅ | `PUT/DELETE`. |
| Copy access code | ✅ |  |
| Send access code (email/WhatsApp) | ❌ | No email/WhatsApp integration. |
| Client portal impersonation | ❌ |  |

**Projects / Jobs** (`clientProjects` in Neon — separate from public portfolio `projects`)
| Item | Class | Notes |
|---|---|---|
| List/search | ✅ | `GET /admin/client-projects?clientId=` |
| Create/edit/delete | ✅ | `POST/PUT/DELETE /admin/client-projects/:id`. |
| Progress % | 🟡 | Field exists and is editable, but Client Portal shows hardcoded 55% for demo project only — Portal doesn't read `/admin/client-projects`. |
| Milestones | ✅ | `GET/POST/PUT/DELETE /admin/milestones`. |
| Tasks | ❌ | Table `tasks` exists in schema; no UI, no API routes. |
| Files | ❌ | Table `projectFiles` exists; no UI, no API routes; `Media.tsx` is a separate R2 media library unrelated to project files. |
| Messages | ❌ | Table `messages` exists; no UI, no API routes; Portal uses Firebase `messages` collection with hardcoded welcome. |
| Invoices | ❌ | ComingSoon; table `invoices` exists but no routes/UI. |

**Messages, Files, Invoices nav items** | ❌ | All render `ComingSoon.tsx`.

### Content

**Services / FAQs / Testimonials / Pricing / Insights / Products / Portfolio(Projects)** all use `GenericCRUD` → Worker → Neon.

| Item | Class | Notes |
|---|---|---|
| List / search / create / edit / delete / reorder | ✅ | Full CRUD via `/admin/<entity>`. |
| Publish/unpublish toggle | ✅ | `isPublished` boolean. |
| Featured toggle | ✅ | `isFeatured`. |
| Slug auto-generation | ✅ | Client-side fallback in `beforeSave`; server also slugifies. |
| Tags / chips (capabilities, features, techStack) | ✅ | Stored as JSONB. |
| Markdown content (Insights) | ✅ |  |
| SEO fields (title/description/OG image) | ✅ |  |
| Media upload into portfolio/service/insight fields | ❌ | Text URL inputs only — no media-picker integration. |
| Order/sort drag-and-drop | ❌ | Numeric `order` field editable as input but no drag UI. |
| Archive/unarchive (projects) | 🟡 | `status` column exists (ACTIVE/PAUSED/COMPLETED/ARCHIVED) but CRUD form doesn't expose status changes beyond isPublished. |
| Client permission toggle (`hasClientPermission`) | 🟡 | Exists in schema, server accepts it, GenericCRUD Services/Portfolio doesn't expose it in fields. |
| Bulk actions | ❌ |  |
| Preview | ❌ |  |

**CRITICAL**: writes go to Neon, but **all public pages read from Firebase** (see §4), so these edits are invisible on the public website. The AI (Tolesh) reads from Neon via `/cms` and RAG, so AI answers will reflect edits but the public website will not.

**Solutions**
| Item | Class | Notes |
|---|---|---|
| Solutions list/form | ❌ | Nav item renders `ComingSoon.tsx` despite `Solutions.tsx` existing in `/pages`. No Neon table for solutions (only hardcoded `DEFAULT_SOLUTIONS` in DataContext). |

**Tools / Stack**
| Item | Class | Notes |
|---|---|---|
| Tools list | ⚠️ | `Tools.tsx` uses `useData().tools` (Firebase, hardcoded `DEFAULT_TOOLS` devicon URLs). No Neon table, no API. |

**Media Library**
| Item | Class | Notes |
|---|---|---|
| Upload (images/PDF/zip/video) | ✅ | `POST /media/upload` → R2 + Neon `media` table, admin-auth gated. |
| Grid view / preview | ✅ |  |
| Copy URL | ✅ |  |
| Delete | ✅ | `DELETE /admin/media/:id` also deletes from R2. |
| Alt text edit | ❌ | Column exists but UI doesn't edit it. |
| Insert into content (media picker) | ❌ | No integration with service/project/insight forms. |
| Project files / client uploads | ❌ | `projectFiles` table has no endpoints/UI. |
| Public download link security | ⚠️ | `publicUrlFor()` returns a public R2 URL; no signed URLs, no per-file auth for private project files. |
| CV/PDF assets (Brand CV, pricing guide, portfolio highlight) | ⚠️ | Settings/Brand uploads to **Firebase Storage** via `DataContext.assetUpdate`, NOT R2. |

### AI

**Admin AI Chat**
| Item | Class | Notes |
|---|---|---|
| Send/receive streaming-free messages | ✅ | `POST /assistant/admin` (auth-gated, password header). |
| Conversation history (local per session anonId) | ✅ | Persisted in `assistant_sessions` / `assistant_messages`. |
| Conversation list sidebar | ✅ | `GET /admin/ai/conversations?prefix=adm_`. |
| Rename conversation | ✅ | `POST /admin/ai/conversations/:id/rename`. |
| Delete conversation | ✅ | `DELETE`. |
| New chat | ✅ |  |
| Model/fallback/tool-calls meta per message | ✅ | Shown under each bubble. |
| Stop generation | ✅ | Abort controller on client; server-side abort not actually wired (stream isn't streamed). |
| Copy message / copy code / regenerate | ✅ | Client-only; regenerate resends last user message. |
| Admin tools (list leads, get lead, stats, draft reply, search projects) | ✅ | Backend enforces `ctx.kind === 'admin'`. Drafted replies are explicitly NOT sent. |

**AI Model Control**
| Item | Class | Notes |
|---|---|---|
| Dahl model catalog fetch | ✅ | `GET /admin/ai/models` (proxies `inference.dahl.global/v1/models`). |
| Model health/status | ✅ | `GET /admin/ai/status` (proxies Dahl `/v1/status?window=24h`). |
| Primary + fallback selectors per surface | ⚠️ | UI saves config, but **server reads env vars only** — see §10. |
| Fallback enabled switches | ⚠️ | Same — saved to DB but ignored by request path. |
| Provider/catalog info | ✅ | Static `MODEL_CATALOG`. |
| Per-surface timeout/max_tokens/tool-access config | ❌ | No UI, DB fields, or env parsing for these. |
| "Apply live" / deploy trigger | ❌ | The note in the response explicitly says a Worker deploy is required. No deploy automation. |

**AI Health**
| Item | Class | Notes |
|---|---|---|
| Per-model status grid | ✅ |  |
| Per-surface routing status | 🟡 | Shows env-based values, not DB-staged ones. |
| Uptime/latency numbers | ❌ | The Dahl status endpoint is proxied raw; no per-model latency history is stored. |
| Last-checked timestamp | 🟡 | Client-side only; resets on refresh. |

**AI Conversations** | ✅ | Lists all assistant sessions (anonId-prefixed); opens message thread.

**AI Lab routes** (`/ai-lab/planner|advisor|idea`) | ✅ | Server endpoints exist and are rate-limited; public Labs page calls them. No Admin management UI for prompts.

### Settings

All Settings screens **except Security** use `useData()` → Firebase; they do NOT hit `/admin/settings`.

| Screen | Class | Notes |
|---|---|---|
| General (business name, tagline, hero copy) | ⚠️ | Firebase only. Public home page reads from Firebase. `/admin/settings` endpoint exists but UI doesn't use it. |
| Social & Contact | ⚠️ | Firebase only. |
| Site Availability | ⚠️ | Firebase only. |
| Notifications (site banner) | ⚠️ | Firebase only. `Layout.tsx` reads from Firebase to show banner. |
| Brand Assets (CV PDFs, founder image) | ⚠️ | Firebase Storage via `uploadBytes`. Public About/Downloads pages read from Firebase. |
| Founder | ⚠️ | Firebase only. |
| SEO defaults | ⚠️ | Firebase only. |
| Security | 🟡 | Static informational card; lists known issues (hardcoded password, JWT verification TODO, etc.). No controls. |
| Site settings key-value API (`/admin/settings`, `PUT /admin/settings/:key`) | 🔌 | Backend endpoint exists (reads/writes Neon `site_settings`), but no Admin UI uses it except AI Model Control which writes `ai_config` into it. |

### Security (known issues enumerated in UI but not enforced in code)
- Hardcoded admin password in frontend bundle
- JWT signature verification TODO
- Password in plaintext sessionStorage
- Demo client credentials hardcoded
- (Media upload auth is fixed per note — confirmed.)

---

## 3. Complete Client Feature Inventory

| Feature | Status | Notes |
|---|---|---|
| Portal login (email + access code) | ⚠️ | Client-side check against Firebase DataContext `clients` array. Demo creds `demo@toluenetech.com / DEMO-2026` hardcoded. Session in sessionStorage (email+code, not a token). **No server-side session/JWT.** |
| Project list | ⚠️ | Reads from Firebase `clientProjects` (hardcoded demo project). Does not hit Worker. |
| Project selector | ⚠️ | Firebase-only. |
| Milestone tracker / progress bar | ⚠️ | Firebase `milestones` (hardcoded). |
| Files list | ⚠️ | Firebase `files` (hardcoded `#` URLs — broken links). |
| Messages / send message | ⚠️ | Firebase `messages`; messages only visible locally because the other side (Admin) has no Messages UI. |
| Client AI assistant | 🔌 | Server endpoint `/assistant/client` exists with its own auth (`X-TT-Client-Email/Code` or `X-TT-Client-Demo:1`), with client-scoped tools (`client_projects`, `client_milestones`, `client_messages`, `client_files`). But the **Portal UI doesn't render a chat widget** for it. No client-side caller for these endpoints in `/pages/portal/`. |
| Invoice view/pay | ❌ | ComingSoon; no API. |
| Profile edit | ❌ |  |
| Notifications | ❌ |  |
| File upload | ❌ |  |
| Milestone approval | ❌ | `milestone_status` has `APPROVED` state but no client UI. |
| Tenant isolation | ⚠️ | Client-side filter `clientProjects.filter(p => p.clientId === client.id)` — **no server-side authorization for portal data** because portal doesn't hit the server. The client AI endpoint does server-side ownership checks via `authProject()`. |

---

## 4. Complete Public Feature Inventory

| Page | Data source | Class |
|---|---|---|
| Home (hero, featured services, social, project highlights, stats) | `useData()` → Firebase defaults | ⚠️ Hardcoded content plus whatever Firebase has (which is identical if empty) |
| About (founder image, founder note, social) | `useData()` → Firebase | ⚠️ |
| Services (list + detail) | `useData()` → Firebase `DEFAULT_SERVICES` | ⚠️ |
| Solutions | `useData()` → Firebase `DEFAULT_SOLUTIONS` | ⚠️ No Neon table. |
| Portfolio (list + project detail) | `useData()` → Firebase `projects` (empty; uses zero projects) — but the redesigned `/components/Sections.tsx` likely ships with hardcoded cards as a fallback | ⚠️ |
| Pricing | `useData()` → Firebase (no plans seeded; page renders empty or hardcoded). `GET /cms/pricing` Worker endpoint exists but unused. | ⚠️ |
| FAQ | `useData()` → Firebase `DEFAULT_FAQS` (5 hardcoded) | ⚠️ |
| Testimonials | `useData()` → Firebase (empty by default) | ⚠️ |
| Insights list + detail | `useData()` → Firebase (empty) | ⚠️ |
| Products | `useData()` → Firebase (empty) | ⚠️ |
| Technology / Tools | `useData()` → Firebase `DEFAULT_TOOLS` (devicon URLs, hardcoded) | ⚠️ |
| Labs / AI Lab | Labs page is static; AI Lab (planner/advisor/idea) calls `/ai-lab/*` on Worker ✅ | 🟡 |
| Contact (form) | No submit handler wired to API in current pages (needs verification). Old code used `addLead` (Firebase dual-write). | ❌/🟡 |
| Start Project / Estimate | `addLead` via `useData()` → dual-writes to Firebase + Neon `/leads` | 🟡 |
| Tolesh Widget (public chat) | `lib/api.sendChatMessage` → Worker `/assistant/chat` ✅, but RAG reads from **Neon** | ✅ for chat; ⚠️ RAG may disagree with public site |
| Site notification banner | `DataContext.siteNotification` (Firebase) | ⚠️ |
| Downloads (CV, portfolio PDF, pricing guide) | Firebase Storage URLs from DataContext | ⚠️ |
| SEO `<meta>` tags | Hardcoded in `index.html` + per-page hardcoded | ❌ Not driven by CMS |

There is no public page that fetches `/cms/*`.

---

## 5. Database / Entity Inventory

| Entity | Neon table | Firebase collection | R2/Firebase Storage | Admin UI | Client UI | Public UI | AI uses it | CRUD API | Auth | Relations | Source-of-truth recommendation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Admin users | `admin_users` | — | — | Security screen (read-only info) | — | — | identity only | ❌ no list/create/delete endpoints | JWT/password | uid PK; no relation to `clients` | **Neon**; migrate off password shim to Firebase Auth uids in this table |
| Clients | `clients` | `clients` (DataContext) | — | Clients section ✅ | Portal login (Firebase) | — | client identity | `/admin/clients` ✅ | authAdmin + authClient (header) | `clientProjects.clientId` → clients.id (logical, no FK) | **Neon**; drop Firebase clients; Portal must call Worker |
| Leads | `leads` | `leads` (DataContext) | — | Leads section ✅ | — | Start Project dual-writes 🟡 | create_lead tool ✅ | `/admin/leads` ✅ + public `POST /leads` ✅ | public rate-limited + admin | `convertedClientId` (logical) | **Neon**; remove Firebase leads |
| Public Projects (portfolio) | `projects` | `projects` | R2 via `coverImage`/`gallery` URLs (but upload not integrated) | Portfolio section ✅ | — | Home/Portfolio/ProjectDetail (Firebase ⚠️) | search_projects tool ✅ | `/admin/projects` ✅ + `/cms/projects` ✅ | public read | `serviceIds` JSONB, `relatedProjectIds` reverse on services | **Neon**; switch public site to `/cms` |
| Client projects | `clientProjects` | `clientProjects` (DEFAULT demo) | — | Jobs ✅ | Portal (Firebase ⚠️) | — | client_projects tool | `/admin/client-projects` ✅ | admin only (missing client GET) | `clientId` → clients.id | **Neon** |
| Milestones | `milestones` | `milestones` (DEFAULT demo) | — | Jobs detail drawer (field exists but Jobs list has no milestone tab in current view; endpoint exists) | Portal (Firebase ⚠️) | — | client_milestones tool | `/admin/milestones` ✅ | admin only | `projectId` → clientProjects.id | **Neon** |
| Tasks | `tasks` | — | — | ❌ | ❌ | — | ❌ | ❌ no endpoints | — | `projectId`, `milestoneId` | **Neon** (needs API + UI) |
| Project files | `projectFiles` | `files` (DEFAULT demo with `#` URLs) | R2 via `r2Key` | ❌ | ❌ (broken `#` links) | — | client_files tool | ❌ no endpoints (only media-library endpoint) | — | `projectId` → clientProjects.id; `uploadedBy` | **Neon + R2**; upload/download API needed |
| Messages | `messages` | `messages` (DEFAULT welcome) | attachments JSONB (R2 keys planned) | ❌ | Portal (Firebase ⚠️) | — | client_messages tool | ❌ no endpoints | — | `contextType`+`contextId` | **Neon** |
| Invoices | `invoices` | — | `pdfR2Key` in R2 | ❌ | ❌ | — | ❌ | ❌ no endpoints | — | `clientId`, `projectId` | **Neon** |
| Services | `services` | `services` (DEFAULT_SERVICES hardcoded) | — | Services section ✅ | — | Services page (Firebase ⚠️) | search/list tools ✅ + public RAG ✅ | `/admin/services` ✅ + `/cms/services` ✅ | public read | `relatedProjectIds` JSONB | **Neon** |
| Solutions | ❌ no table | `solutions` (DEFAULT_SOLUTIONS hardcoded) | — | ❌ ComingSoon | — | Solutions page (Firebase ⚠️) | ❌ | ❌ | — | — | **Neon** (create `solutions` table) |
| Products | `products` | `products` (empty default) | `logo`, `screenshots` URLs | Products section ✅ | — | Products page (Firebase ⚠️) | ❌ not in RAG | `/admin/products` ✅; `/cms/products` ❌ missing | public read needed |  | **Neon**; add `/cms/products` |
| Lab items | `labItems` | `labs` | — | ❌ ComingSoon | — | Labs page likely hardcoded | planner/advisor/idea use prompts but not labItems | ❌ | — |  | **Neon** (build UI + public endpoint) |
| Testimonials | `testimonials` | `testimonials` (empty default) | `photo` URL | Testimonials CRUD ✅ | — | Testimonials page (Firebase ⚠️) | ❌ not in RAG | `/admin/testimonials` ✅; `/cms/testimonials` ✅ (list only) | public read | `relatedProjectId` | **Neon** |
| FAQs | `faqs` | `faqs` (DEFAULT_FAQS hardcoded) | — | FAQs CRUD ✅ | — | FAQ page (Firebase ⚠️) | search_faqs tool ✅ | `/admin/faqs` ✅; `/cms/faqs` ✅ | public read |  | **Neon** |
| Insights/blog | `insights` | `insights` (empty default) | `coverImage` URL | Insights CRUD ✅ | — | Insights/Detail (Firebase ⚠️) | ❌ not in RAG | `/admin/insights` ✅; `/cms/insights` ❌ missing | public read | `tags` JSONB | **Neon**; add `/cms/insights`, `/cms/insights/:slug` |
| Pricing plans | `pricingPlans` | — (DataContext has no pricing; DEFAULT empty) | — | Pricing CRUD ✅ | — | Pricing page (hardcoded tiers likely) | get_pricing tool ✅ | `/admin/pricing` ✅; `/cms/pricing` ✅ | public read |  | **Neon**; switch public Pricing page |
| Tools/tech stack | ❌ no table | `tools` (DEFAULT_TOOLS hardcoded devicon URLs) | — | Tools section uses Firebase ❌ | — | Technology page (Firebase ⚠️) | ❌ | ❌ | — |  | **Neon** (create `tools` table) — or accept as config |
| Media library | `media` | `media` | **R2** `ASSETS` bucket | Media section ✅ | — | Pages render URLs when given | ❌ | `/admin/media` ✅; `POST /media/upload` ✅; `GET` only via admin | admin for upload; public read via R2 public URL | `uploadedBy` | **Neon + R2** |
| Site settings | `site_settings` (key-value JSONB) | `settings/global` doc (Firebase) | — | Settings pages use Firebase ⚠️ | — | Public pages use Firebase ⚠️ | basePublicContext reads NEON site_settings? No — retrieval reads services/projects/faqs/pricing but not site_settings | `/admin/settings` ✅ (backend exists, UI unused) | admin |  | **Neon** (deprecate Firebase settings doc) |
| Founder info / image | part of site_settings? Currently in Firebase settings doc | `founderNote`, `founderImageData` | Firebase Storage | Settings/Founder, Brand → Firebase ⚠️ | — | About page (Firebase ⚠️) | ❌ | ❌ | — |  | **Neon site_settings** + R2 |
| Social/contact | part of site_settings? | `socialLinks` in settings doc | — | Settings/Social → Firebase ⚠️ | — | Footer/Contact (Firebase ⚠️) | ❌ | ❌ | — |  | **Neon site_settings** |
| Brand assets (CV, portfolio PDF, pricing guide) | ❌ no dedicated metadata | Brand settings fields | Firebase Storage | Settings/Brand → Firebase ⚠️ | — | Downloads page (Firebase ⚠️) | ❌ | Upload via admin (Firebase) | admin |  | **Neon media** + R2; treat as media-library entries tagged by role |
| Site notification/banner | part of site_settings? | `siteNotification` in settings doc | — | Settings/Notifications → Firebase ⚠️ | — | Layout banner (Firebase ⚠️) | ❌ | ❌ | — |  | **Neon site_settings** |
| Availability | availabilityEnum, but no column in services/projects; site setting only | `availability` in Firebase settings | — | Settings/Availability → Firebase ⚠️ | — | Layout/hero (Firebase ⚠️) | No enforcement in API | ❌ | — |  | **Neon site_settings** |
| Assistant sessions | `assistantSessions` | — | — | AI Conversations ✅ | — | Tolesh widget | read by AI routes ✅ | admin list/get/rename/delete ✅; public create via `/assistant/session` & `/assistant/chat` | per-session anonId | `capturedLeadId` → leads.id | **Neon** |
| Assistant messages | `assistantMessages` | — | — | Loaded per conversation ✅ | — | — | read by AI routes ✅ | no separate admin API (loaded via session) |  | `sessionId` → assistantSessions.id | **Neon** |
| AI config (model routing) | `site_settings.ai_config` (staged only) | — | — | AIModelControl ✅ (dead-end) | — | — | ❌ server ignores DB | `POST/GET /admin/ai/config` ✅ | admin | surface-keyed | **Move into DB + make server read it per request** (or generate env via build step) |
| Notifications | `notifications` table exists | — | — | ❌ no UI, no endpoints | ❌ | — | — | ❌ |  | `uid` targets admin user | **Neon**; build after admin users are real |
| Audit logs | ❌ no table | — | — | ❌ | — | — | — | ❌ | — |  | **Create `audit_logs`** |
| Payments | ❌ no table | — | — | ❌ | ❌ | — | — | ❌ | — |  | Future (Stripe/Paystack); out of initial scope |
| Newsletter subscribers | ❌ no table | — | — | — | — | — | — | ❌ | — |  | Create if needed |

### Firebase vs Neon summary
- **Firebase is still the live source** for everything the public site renders (DEFAULT_* seeds act as the CMS).
- **Neon/Worker is live** for: leads (public form + Tolesh create_lead), AI chat (all 3 surfaces), AI Lab, media upload (admin only), CRUD for services/projects/faqs/pricing/testimonials/insights/products/clients/client-projects/milestones (admin UI wired, but public doesn't read), dashboard stats, AI model catalog/status/conversations.
- **Dual-writes** exist in one direction only: `DataContext.addLead` writes Firebase first then fire-and-forgits to Neon `/leads`. No reverse sync.
- **Orphaned Neon entities** (no UI / no Firebase counterpart): `tasks`, `projectFiles`, `messages`, `invoices`, `notifications`, `adminUsers` (empty), `ai_config` (staged, unused at request time), `labItems` (no UI, no public endpoint).
- **Orphaned Firebase entities** (no Neon counterpart): `solutions`, `tools`, founder image/brand PDFs/pricing guide/portfolio highlight (stored in Firebase Storage under `docs/*`, `images/founder`), `siteSettings`, `socialLinks`, `founderNote`, `siteNotification`, `clientProjects`/`milestones`/`files`/`messages`/`clients` seed data.

---

## 6. Firebase vs Neon Recommendation

**Recommendation: make Neon + R2 the single source of truth. Deprecate Firestore entirely (or reduce Firebase to Auth only).**

Reasons:
1. Server is already on Neon; RLS-friendly Postgres; Drizzle ORM + migrations already set up (`server/drizzle/`).
2. R2 is bound to the Worker; media uploads already land there. Firebase Storage is only used for Brand assets and dual-write leads (which don't use storage).
3. AI/RAG reads from Neon; keeping Firebase means AI answers diverge from public content.
4. Firestore security rules are not audited (and the Firebase API key is shipped in the bundle — standard for client Firebase, but the current setup has no user auth other than hardcoded admin password and demo client code).

Phased plan in §24.

---

## 7. Admin → Backend Connection Map (intended flows)

Each Admin action should follow UI → authenticated Worker → validation → Neon → invalidate/refresh → fan-out to public/AI/notifications.

| Admin action | Endpoint | Validation/auth | DB change | Public-site effect | AI effect | Notification |
|---|---|---|---|---|---|---|
| Create Service | POST /admin/services | admin auth, slug unique | insert services | should appear on /services after switch to /cms | search/list tools return it next request | none |
| Update Service | PUT /admin/services/:id | admin auth, ownership (n/a) | update | public refetches | same | none |
| Delete Service | DELETE /admin/services/:id | admin auth, block if referenced | delete (or soft-delete with `isPublished=false`/new `deletedAt`) | removed from /services | removed from RAG | none |
| Publish / unpublish Service | PUT `isPublished` | admin auth | toggle isPublished | toggle visibility; 404 on detail when unpublished | toggle inclusion in RAG (already filtered by `isPublished=true`) | none |
| Feature / unfeature Service | PUT `isFeatured` | admin auth | toggle | appears on home hero/services strip | — | none |
| Reorder services | PUT `order` per item or batch PATCH | admin auth | update order | new sort order on /services | — | none |
| Same CRUD for Projects, FAQs, Testimonials, Pricing, Products, Insights | mirror | mirror | mirror | mirror | mirror | mirror |
| Upload media | POST /media/upload | admin auth, mime+size cap (20MB) | insert R2 + media row | accessible via publicUrl (R2) | can cite in answers (not yet wired to tools) | none |
| Delete media | DELETE /admin/media/:id | admin auth | delete R2 object + media row | 404 if still referenced; cascade should nullify references | — | none |
| Create Client | POST /admin/clients | admin auth; valid email; generate access code | insert clients | no direct public effect | client AI gets a new identity; future assistant can answer for them | generate access code, email/SMS to client (future) |
| Update Client | PUT /admin/clients/:id | admin auth | update | — | client AI reflects changes | send invite if user_id set |
| Delete Client | DELETE /admin/clients/:id | admin auth; block if ACTIVE projects exist | delete + cascade client_projects/milestones/tasks/messages/files/invoices? (must be transactional or soft-delete) | — | client AI auth fails with 401 | notify client (future) |
| Update Lead status | PUT /admin/leads/:id `{status}` | admin auth, valid enum | update leads.status | none; leads are admin-only | admin AI sees new status in admin_list_leads | on WON, prompt to convert to Client; on NEW (public), optional new-lead notification (future) |
| Convert Lead → Client | POST /admin/clients/convert (NEW) | admin auth | insert clients + update leads.convertedClientId + optionally create clientProjects | — | admin AI stats update | send welcome email (future) |
| Add Lead note | PUT /admin/leads/:id | admin auth | append notes (or dedicated `lead_notes` table — recommended) | — | admin_get_lead includes notes | none |
| Create Client Project | POST /admin/client-projects | admin auth, valid clientId | insert clientProjects | — | client_projects tool returns it | email to client (future) + in-app notification |
| Update project status/progress | PUT /admin/client-projects/:id | admin auth, valid enum | update | Portal reflects it; currently doesn't fetch | client tool reflects it | notify client (future) |
| Create milestone | POST /admin/milestones | admin auth, valid projectId owned by client | insert milestones | Portal reflects it | client_milestones tool returns it | notify client |
| Mark milestone complete/approved | PUT /admin/milestones/:id | admin auth | update status | — | — | notify other party |
| Upload project file | POST /admin/project-files (NEW) | admin auth, valid projectId | put R2, insert project_files | Portal lists it; client AI can list | client_files tool | notify client |
| Delete project file | DELETE /admin/project-files/:id | admin/authProject-style ownership check | delete R2 + row | removed from portal | removed from tool | notify client |
| Post admin message on project | POST /admin/messages (NEW) | admin auth, valid context | insert messages (contextType=PROJECT, fromUid=admin) | Portal shows it | client_messages tool returns it | notify client |
| Create/update invoice | POST/PUT /admin/invoices (NEW) | admin auth | insert/update invoices (status DRAFT/SENT/PAID/VOID) | Portal lists it when SENT | — | email invoice to client (future) |
| Save AI model config | POST /admin/ai/config | admin auth; validate model IDs against catalog | upsert site_settings.ai_config **and signal Worker** (KV or hot-reload; see §10) | — | *all subsequent AI calls use new primary/fallback* | none (write audit log) |
| Update site settings (general/social/availability/notifications/SEO/founder) | PUT /admin/settings/:key | admin auth, schema-validate per key | upsert site_settings | public site refetches (SSR/ISR or short TTL) | basePublicContext picks up e.g. availability message, business name | site-wide banner appears immediately |
| Upload brand asset | use media library + tag role, or POST /admin/media with `role` field | admin auth | insert media with role label | Downloads/About pages render by role | — | none |

Every one of these writes should also insert an `audit_logs` row (see §15).

---

## 8. Admin → Public Website Connection (intended)

| Admin control | DB field | Public consumer | Effect | Refresh | AI effect |
|---|---|---|---|---|---|
| Service title/desc/capabilities/icon | services.* | `/services`, `/services/:slug`, Home services strip, ServiceDetail | Copy/structure changes immediately | After public site reads from `/cms/services` (short TTL, e.g. 60s) | RAG/search uses it on next request |
| Service publish toggle | services.isPublished | `/services` list filtered; `/services/:slug` 404 when unpublished | Visibility gate | Immediate on next fetch | Toggles whether tool returns it (already `eq(isPublished,true)`) |
| Service featured | services.isFeatured | Home services strip | Show/hide in hero strip | Next fetch | No change |
| Project title/client/challenge/solution/results/gallery/cover | projects.* | `/portfolio`, `/portfolio/:slug`, Home featured | Content changes | Next fetch | search_projects tool uses it |
| Project published | projects.isPublished | Portfolio visibility + detail 404 | Visibility | Next fetch | Tool filter already applied |
| Project featured | projects.isFeatured | Home portfolio highlight | Highlighted card | Next fetch | — |
| Project client permission | projects.hasClientPermission | `/portfolio/:slug` shows client name/logo only when true | Privacy gate | Next fetch | Tool already filters client name by this flag |
| FAQ question/answer/category/order | faqs.* | `/faq`, FAQ schema | Q&A update | Next fetch | search_faqs uses it |
| FAQ publish | faqs.isPublished | Visibility | Toggle | Next fetch | Tool filter |
| Testimonial quote/name/company/photo/featured | testimonials.* | `/testimonials`, Home testimonials section, Testimonial schema | Content/featured | Next fetch | Not currently in RAG (add to retrieval if desired) |
| Testimonial publish | testimonials.isPublished | Visibility | Toggle | Next fetch | — |
| Pricing plan name/price/features/featured | pricingPlans.* | `/pricing`, Pricing schema | Plan change | Next fetch | get_pricing tool returns it |
| Insight title/excerpt/content/cover/author/category/tags/publishDate | insights.* | `/insights`, `/insights/:slug`, Blog schema | Article published/updated | Next fetch | Add insights to RAG (not currently retrieved) |
| Insight draft toggle | insights.isDraft | Visibility; drafts 404 | Publish workflow | Next fetch | Add to retrieval only when not draft |
| Insight featured | insights.isFeatured | Home blog strip | Highlight | Next fetch | — |
| Product name/desc/logo/features/status/screenshots | products.* | `/products` | Product listing | `/cms/products` needs creating; Products page must switch | Not currently in RAG (add) |
| Tools stack | new `tools` table | `/technology`, footer | Logo/name grid | `/cms/tools` (new endpoint) | Not in RAG |
| Solutions (new table) | solutions.* | `/solutions`, Home solutions strip | Solution cards | `/cms/solutions` (new) | Add to RAG |
| Labs items | labItems.* | `/labs` | Lab listing | `/cms/labs` (new) | — |
| Media library | media.* | Used wherever URLs are referenced by services/projects/etc. | Image/file delivery | Immediate (URL is stable) | — |
| Business name / tagline / hero copy | site_settings.general | Home hero, footer, `<title>` defaults | Branding update | Next fetch | basePublicContext should surface |
| Social links (email/WA/FB/IG/Twitter/LinkedIn) | site_settings.social | Footer, Contact page, Tolesh signature | Link updates | Next fetch | Tolesh can use for "contact us" replies |
| Contact information (email/phone) | site_settings.social | Header/footer/Contact | — | Next fetch | — |
| Founder info (name, role, message, image) | site_settings.founder (+ media) | `/about` founder section | About page | Next fetch | — |
| Brand assets (CV PDF, portfolio highlight, pricing guide) | media with role tags (or site_settings keys) | `/downloads` | Download links | Next fetch | — |
| Availability status + message | site_settings.availability | Layout banner, hero status chip | Show availability | Next fetch | Tolesh should mention availability in greeting when not AVAILABLE |
| Site notification banner | site_settings.notification | Layout top banner | Show banner sitewide | Near-immediate (poll or SSE); SSR safe with TTL | — |
| SEO defaults (title/description/OG image) | site_settings.seo | Document head defaults | Meta tags | SSR/next build | — |
| Per-entity SEO (services/projects/insights) | services.seoTitle etc. | Document head on detail pages | Meta tags | Next fetch | — |
| AI model routing | site_settings.ai_config | (admin-only) | None for public | AI calls immediately start using new primary/fallback once hot-reload works | All AI routes |
| Client/project status/progress | clientProjects.* | Client Portal dashboard | Progress/milestone updates | Portal refetch (poll or SSE) | client_projects tool returns it |
| Milestone status | milestones.status | Client Portal timeline | Check mark, progress bar | Portal refetch | client_milestones tool |
| New client message | messages (admin→client) | Portal messages | New message appears | Portal refetch + notification | — |
| New lead (public) | leads insert | Admin Leads list (new row) | Lead appears | Admin refresh or pub/sub | Tolesh created it; admin AI can see it |

### Public pages currently using hardcoded data instead of backend
Almost every public page has hardcoded markup in `components/Premium.tsx` and `components/Sections.tsx` in addition to Firebase defaults. Switching them to Worker `/cms` endpoints will be the main Phase 2 work.

---

## 9. Public → Admin (visitor-originated data)

| Visitor action | Endpoint | Validation/rate-limit | DB write | Where Admin sees it | Notification | AI involvement |
|---|---|---|---|---|---|---|
| Sends message via public Tolesh widget | POST `/assistant/chat` | IP rate limit (25/min), max 1500 chars | insert assistant_sessions (if new) + assistant_messages; create_lead tool inserts leads if they volunteer name+email+brief | AI Conversations; Leads list (when lead created) | None today | Tolesh asks qualifying questions and uses create_lead tool when ready |
| Submits Start a Project form | POST `/leads` (via `submitLead()`) | IP rate limit (5/min), email+name required, server-side sanitization | insert leads (source=website-form); ref TT-#### generated | Leads list, Dashboard "New leads" count | None today (future: notification + email) | Tolesh can see leads via admin tools; public Tolesh cannot |
| Submits Contact form | **NO ENDPOINT CALLED** in current Contact.tsx — needs wiring. Historical `addLead` dual-writes to Firebase. | — | Currently nothing durable to Neon if the page doesn't call submitLead() | — | — | — |
| Submits Estimate form | Estimate.tsx — verify; likely needs same `/leads` wiring with source=estimate | — | — | — | — | — |
| Signs up for newsletter | ❌ no such feature yet. | — | — | — | — | — |
| AI Lab planner/advisor/idea requests | POST `/ai-lab/{planner|advisor|idea}` | IP rate limit (10/min), input size caps per kind | no DB write (stateless) | None | None | Uses public RAG + public tools only; no lead creation |
| Uploads a file (visitor) | ❌ no endpoint | — | — | — | — | — |
| Client portal login | **Client-side only** against Firebase DataContext. Server side accepts X-TT-Client-Email/Code headers for `/assistant/client`. | Need a real POST `/client/login` that returns a short-lived signed token. | session / token | Admin shows last-login in Clients (future) | none | client AI authenticates with token |
| Client sends message / uploads file / marks milestone approved | ❌ no endpoints | — | — | — | — | client AI can read but portal UI doesn't send yet |

---

## 10. Client Portal ↔ Admin

### Intended feature matrix
| Feature | DB entity | API needed | Admin side | Client read | Client create | Client update | Client must NOT access | Notification |
|---|---|---|---|---|---|---|---|---|
| Account profile | clients | POST /client/login (token), GET /client/me | edit/disable/delete | name/email/company/phone | — | update own phone? (optional) | other clients | welcome email, reset-code email |
| Projects list | clientProjects | GET /client/projects (scoped) | CRUD + progress | own projects only | ❌ | ❌ | other clients' projects | on project creation |
| Project detail | clientProjects | GET /client/projects/:id (ownership check) | edit fields, progress, status | title/desc/status/progress/dates | ❌ | ❌ | other clients' | on status/progress change |
| Milestones | milestones | GET /client/projects/:id/milestones | CRUD, order, status | all milestones on own project | ❌ | mark APPROVED? (design decision) | other projects' milestones | on milestone completion, on approval |
| Tasks | tasks | GET /client/projects/:id/tasks | CRUD, assign | tasks on own project | ❌ | comment? (future) | other projects' tasks | on task completion |
| Files | projectFiles | POST/GET/DELETE /client/projects/:id/files signed URLs | upload, delete | download/view files on own project | upload files (optional) | delete own uploads | other projects' files; overwrite admin uploads | on new file |
| Messages | messages | GET/POST /client/projects/:id/messages | reply, post as admin | messages on own project | post new message | ❌ cannot edit/delete sent | other projects' messages; admin-only notes | email/in-app on new message for both sides |
| Invoices | invoices | GET /client/invoices, GET /client/invoices/:id/pdf | create, mark PAID, upload PDF | view own invoices, download PDF | ❌ | ❌ (pay online later) | other clients' invoices | email when invoice sent, reminder before due |
| Payments | payments (new) | POST /client/invoices/:id/pay (webhook from Paystack/Stripe) | record, view | pay invoice, view receipts | — | — | — | admin notification + receipt email |
| Notifications | notifications | GET /client/notifications, POST /client/notifications/:id/read | send manual, auto-generated by triggers | own notifications | mark read | — | — | realtime (SSE or poll) |
| Client AI assistant | assistant_sessions (cli_ anonId) | POST /assistant/client (already exists, uses authClient) | view conversations? | chat with Tolesh scoped to own data | send messages | — | other clients' data | none; AI can alert admin when needed (future) |
| Support ticket | (could reuse messages w/ GENERAL context) | — | admin triage | file a support request | create | — | — | email admin |

### Tenant isolation (critical)
- Every client-scoped endpoint must verify `clientId` from the authenticated token against `client_projects.clientId` (or corresponding child table) in every single query — never trust a projectId from the client. The existing `authProject()` helper in `server/src/ai/tools/index.ts` is the right pattern; replicate it for every REST route.
- Never expose numeric database IDs in URLs without a signed token? Not strictly necessary if server ownership checks are bulletproof, but every query must include `clientId = <auth.clientId>`.

---

## 11. Admin ↔ Client Project Lifecycle

| Stage | Admin action | Client action | Backend / DB | Notification | AI | Public |
|---|---|---|---|---|---|---|
| 1. Lead captures | View Leads inbox | Visitor submits Start Project / Tolesh create_lead / Contact (wired) | insert leads (NEW, source set) | new-lead notification (future) | Tolesh already created it and captured brief; admin AI can draft reply | — |
| 2. Qualify | Set status CONTACTED/QUALIFIED; add notes; schedule call | — | update leads.status; append to `lead_notes` (new table recommended) | — | Admin AI can summarize/draft replies | — |
| 3. Proposal / Discovery | Set DISCOVERY/PROPOSAL; attach estimate doc (file upload) | Receives proposal link (future) | update leads.status; project_files with proposal tag; email w/ link (future) | Proposal email (future) | — | — |
| 4. Won → Client | "Convert to client" button (needs implementing): creates clients row + access code; updates leads.convertedClientId and status WON | — | insert clients; update leads | Send welcome email with access code (future) | — | — |
| 5. Project created | Create clientProject; link public portfolio project optionally | — | insert clientProjects; milestones inserted from template | Project kickoff email | — | — |
| 6. Deposit invoice (future) | Create invoice, mark SENT | Pays via Paystack/Stripe (future) | insert invoices; webhook marks PAID | Invoice email + receipt | — | — |
| 7. Milestones | Create and update milestones as work progresses; upload deliverables to project files | Views progress bar/milestones; receives files; marks milestones APPROVED (optional) | insert milestones/projectFiles/messages; milestone approval inserts with status=APPROVED | Email/in-app on each event | Client AI answers progress questions from DB | — |
| 8. Client feedback/comms | Reply via Messages UI (needs building) | Sends messages, uploads files | insert messages/project_files | Real-time notifications (SSE) | Client AI and Admin AI can surface summaries | — |
| 9. Final delivery | Mark last milestone COMPLETED; attach deliverables; create final invoice | Downloads deliverables; pays final invoice; approves | update clientProjects.status=COMPLETED; invoice PAID | Completion email; testimonial request | — | Optionally link to a portfolio project (set hasClientPermission when approved) |
| 10. Testimonial request | Send testimonial request (future); create testimonial when approved | Submits testimonial | insert testimonials (isPublished=false until admin approves) | Thank-you email | — | When approved, appears on /testimonials and Home |
| 11. Follow-up | Set follow-up; ARCHIVE project | — | update clientProjects.status=ARCHIVED; lead follow-up | — | — | — |

**Implemented today:** step 1 (leads inserted) ✅. Steps 2–3: status updates + notes work but no email/notifications. Steps 4–11: **not implemented**, though the DB tables for clients, clientProjects, milestones, invoices, messages all exist.

---

## 12. CRM Audit (lead flow)
What exists:
- `leads` table with `ref`, status enum, services, source, budget, timeline, notes, followUpDate, convertedClientId.
- Public POST `/leads` with rate limiting + validation + TT-ref generation.
- Admin list/search/filter/CRUD + status-update pill grid.
- Tolesh `create_lead` tool (captures lead when name/email/requirements volunteered during chat and links session to lead).

Missing:
- **Lead activity timeline** (auditable note history). `notes` is a single text column; every edit overwrites. Add `lead_notights` table (id, leadId, author, body, createdAt, type: note/status-change/email/sms).
- **Lead assignment** (`assignedTo` admin uid column).
- **Follow-up reminders** — `followUpDate` column exists but no scheduler/notification.
- **Duplicate detection** — no email dedupe on POST /leads (rate limit exists but no email match).
- **Lead source attribution** — `source` is set but no UTM parameters captured (utm_source/medium/campaign, referrer, landing page).
- **Conversion to Client** — no UI/API for atomic lead→client conversion.
- **Email integration** — no transactional email provider (Resend/Postmark) wired. Tolesh "drafts" replies but cannot send.
- **AI qualification** — public Tolesh captures basic requirements; automatic QUALIFIED tagging based on budget/timeline is not implemented.
- **Lead export (CSV)** — no endpoint/UI.
- **Audit log for lead changes** — no audit table (see §15).

---

## 13. AI Architecture & Permission Matrix

### What each AI surface can currently access
| Data | Public Tolesh | Admin AI | Client AI | Planner/Advisor/Idea |
|---|---|---|---|---|
| Published services | ✅ search/list | ✅ search/list | ❌ | ✅ list_services only |
| Published projects (masked client name) | ✅ search_projects (honors hasClientPermission) | ✅ admin_search_projects (sees ALL including drafts) | ❌ | ❌ |
| FAQs | ✅ search_faqs | ✅ search_faqs | ❌ | ❌ |
| Pricing | ✅ get_pricing | ✅ get_pricing | ❌ | ❌ |
| Create lead | ✅ create_lead (rate-limited) | ❌ | ❌ | ❌ |
| Lead list/details | ❌ | ✅ admin_list_leads / admin_get_lead | ❌ | ❌ |
| Lead stats | ❌ | ✅ admin_stats | ❌ | ❌ |
| Draft reply | ❌ | ✅ admin_draft_reply (never sends) | ❌ | ❌ |
| Own projects | ❌ | ❌ | ✅ client_projects (enforces ownership) | ❌ |
| Own milestones | ❌ | ❌ | ✅ client_milestones (enforces project ownership) | ❌ |
| Own messages | ❌ | ❌ | ✅ client_messages (enforces ownership) | ❌ |
| Own files | ❌ | ❌ | ✅ client_files (no URL signing yet) | ❌ |
| Client lists/invoices/payments | ❌ | ❌ | ❌ | ❌ |
| Site settings/social | Partial (via system prompt, static) | Admin snapshot injected into sys prompt | ❌ | Partial (basePublicContext) |
| Admin settings/AI config | ❌ | ❌ | ❌ | ❌ |
| Other clients / other projects | ❌ (masked + published-only) | ✅ | ❌ (enforced) | ❌ |
| Internal prompt/keys/tools list | Prompt explicitly refuses | Same | Same | Same |

### Required fixes
1. **AI config MUST be read from DB at request time** (or at least cached with TTL). Today server reads env vars only. Add a `resolveForSurface` that merges DB `ai_config` (staged per surface) on top of env defaults, falling back to defaults if DB fetch fails. Cache in-memory per Worker isolate with a TTL (e.g., 30s) and invalidate on `POST /admin/ai/config`.
2. **Add surfaces for tools/timeout/maxTokens/toolAccess/systemPromptOverrides** — add columns (or JSONB fields) to `ai_config` value per surface.
3. **Public Tolesh retrieval is missing**: insights, products, testimonials, tools, solutions. Extend `retrievePublic` and tools accordingly.
4. **Admin AI should not leak unpublished content to clients indirectly** — already scoped by kind; keep the three tool-sets separate.
5. **AI usage logging**: insert into `ai_usage` (new table) per request: surface, model, fallbackUsed, input/output tokens, latencyMs, toolCalls[], errorCode, sessionId. This is what actually powers AI Health numbers (currently the Health page only hits the Dahl status endpoint which doesn't give app-level stats).
6. **Rate limiting** already present per surface; ensure client chat rate-limits per clientId not just IP.
7. **Client AI endpoint must require a real auth token**, not just X-TT-Client-Email header (which is trivially spoofable).

---

## 14. AI Model Control Center — How It Should Work

Today: UI → `POST /admin/ai/config` writes JSONB to `site_settings.ai_config` and returns "staged; restart worker". Server never reads it.

Required architecture:

1. ai_config JSONB schema per surface:
   ```
   primary: modelId,
   fallback: modelId | null,
   fallbackEnabled: bool,
   timeoutMs: number,       // default per tier
   maxTokens: number,       // default per tier
   toolsEnabled: string[],  // subset of surface's tool whitelist
   systemPromptOverride: string | null,
   rateLimitPerMin: number, // optional override
   ```
2. Server loads config on each request (with short in-memory cache, invalidated by POST):
   ```
   effective = merge(DEFAULTS[surface], envOverrides[surface], dbStaged[surface])
   ```
   This allows env to set API keys and baseline overrides; DB can tweak per surface without a deploy.
3. Model health: poll Dahl `/v1/status` on a cron or cached every 60s; record per-model latency/error rates into `ai_model_stats` (new table) for the Health dashboard. The Health page should show app-level metrics (requests, fallback %, p50/p95 latency, error rate per surface) fetched from a new endpoint `/admin/ai/usage` — not just the raw Dahl status.
4. Fallback triggers automatically: `server/src/ai/client.ts` should try primary, catch timeout/5xx/model-not-found/context-length, then chain through fallbackModels; record `usedFallback` and reason in `ai_usage`.
5. Missing surfaces: `toolsEnabled` controls which public/admin/client tools are attached. e.g., you might disable create_lead on the Idea analyzer.
6. Validation: POST /admin/ai/config validates that the selected model exists in MODEL_CATALOG or Dahl /v1/models response; unknown models get a warning (as today) but are still saved for forward compatibility.
7. Apply-without-deploy is possible (no cold restart needed) because config is loaded per-request.

---

## 15. Files & Media

Current state:
- Media Library (admin): uploads → R2 `ASSETS` bucket, metadata → `media` table. Auth-gated. Delete removes both.
- Public access: `publicUrlFor()` returns `https://assets.toluenetech.com/<r2key>` (or R2_PUBLIC_URL env) — public bucket, no signed URLs.
- Brand assets (founder image, CV, pricing guide, portfolio PDF): upload to **Firebase Storage** via DataContext, not R2. Divergent.
- Project files: `projectFiles` table exists but no upload/download endpoints; Portal uses Firebase `files` with hardcoded `#` URLs (broken).
- Founder image same problem.

Required architecture:
- **All files go to R2 `ASSETS` bucket.** Use prefixes: `media/`, `brand/`, `projects/<projectId>/`, `invoices/<invoiceId>/`, `founder/`.
- **Public files** (portfolio, services, media library, brand, founder, public PDFs) serve via public R2 domain (already configured).
- **Private project files**: serve via Worker authenticated endpoint `GET /client/files/:id` that (a) verifies client auth token, (b) verifies file.projectId belongs to client, (c) returns a signed R2 URL (or proxies the bytes for short-lived access, but prefer signed URLs using R2 S3-compat API with HMAC-SHA256).
- **Invoice PDFs**: similar, private to the owning client; admin also has access.
- **Media picker in CRUD forms**: uploads to media library or selects existing; field stores the media.id or publicUrl.
- **Metadata**: use existing `media` table for all files; add a `role`/`tags` column and `visibility` enum (public/private) and `projectId` nullable foreign key.
- **Upload size/mime validation** already exists; extend to private uploads.
- **Cascade rules**: when a project is deleted/archived, soft-delete its files (or move to a cold prefix); don't hard-delete without audit.
- **Brand/Files settings in Admin must be updated to upload to R2/media library** (remove Firebase Storage usage entirely).
- **Founder image** field in settings should point at media.publicUrl.

---

## 16. Authentication & Authorization

### Current state
- Admin: hardcoded password `iloveesther221@@` (overridable via `ADMIN_PASSWORD` env). Sent in plaintext header every request. Session stores password in sessionStorage. Firebase JWT path exists but **signature verification is a TODO**.
- Client: email + 6-char access code. Client-side check against Firebase DataContext; sessionStorage holds `{email,code}`. Server accepts the same in `X-TT-Client-Email`/`X-TT-Client-Code` headers for client AI (trivially spoofable — anyone can send `demo@toluenetech.com / DEMO-2026`).
- Public `/leads` POST and `/assistant/chat`, `/media/upload` uses admin password header (media upload requires admin password which is correct).
- No CSRF protection (Worker uses CORS origin check; password-in-header pattern is CSRF-safe because browsers don't auto-send custom headers).

### Required hardening
1. **Admin**
   - Phase 1: keep password header but enforce `ADMIN_PASSWORD` env is set in production; return 401 if not set; remove the hardcoded default from server source at least for production (fail closed). Rotate the password.
   - Phase 2: create real admin users in `admin_users` table (uid = Firebase uid); ship a login flow that signs in with Firebase Auth custom token or email/password, returns a short-lived (15 min) signed session token (HMAC JWT) the browser stores in httpOnly cookie or memory; refresh via endpoint.
   - Add role-based access (OWNER/ADMIN/EDITOR) — schema supports `role` column already; middleware enforces role per route (e.g., only OWNER can manage admin users, security settings).
   - Complete Firebase JWT RSA-SHA256 verification (`getPublicKeys` + `crypto.subtle.import` + `verify`).
2. **Client**
   - Replace access-code-only with: POST /client/login (email, code) → returns signed short-lived JWT containing `clientId`; refresh endpoint.
   - All `/client/*` and `/assistant/client` routes require the JWT and extract `clientId` from it (never from headers or body).
   - Generate per-client random access codes (admin creates client; UI shows code once; regenerate on demand); email code on creation; expire after first use if desired.
   - Rate limit login attempts per email + IP.
   - Remove demo credentials from production builds or gate behind env flag.
3. **General**
   - All client-scoped endpoints must enforce ownership via JOIN/`where clientId = auth.clientId`.
   - Strict input validation using a schema library (zod/valibot) on every POST/PUT. Drizzle doesn't do runtime validation.
   - Add request IDs, structured logging, and audit logs for mutating actions.
   - Add `security.txt` and rate-limit all mutating public endpoints.
   - Ensure no DB errors leak raw SQL/messages to clients.
4. **IDOR risks today** (specific):
   - `/admin/leads/:id`, `/admin/clients/:id`, `/admin/projects/:id` etc. require admin password so not directly exploitable by anonymous users, but once admin auth is strengthened these are fine.
   - `/assistant/client` currently accepts any request with `X-TT-Client-Email: demo@toluenetech.com` and `X-TT-Client-Code: DEMO-2026` from any origin → **any visitor on the public internet can impersonate the demo client**. This is by design for the demo but is an IDOR-class weakness when real clients exist. Fix before onboarding real clients.
   - Public `/media/upload` correctly enforces authAdmin.
   - CORS: `*.netlify.app` is allowed in default origins; tighten to known deploy previews in production.

---

## 17. Notifications

Not implemented. Schema has `notifications` table (uid, type, title, body, link, isRead, createdAt).

Required:
- Trigger events: new_lead, client_message, admin_message, milestone_update, file_uploaded, invoice_sent, invoice_paid, project_completed, ai_lead_captured, ai_error_spike.
- Endpoints: GET /admin/notifications, POST /admin/notifications/:id/read, GET /client/notifications (scoped).
- Delivery channels: in-app (DB) first; email via Resend/Postmark (worker-side) second; WhatsApp (optional, third) via Twilio/360dialog.
- Admin UI: bell icon in topbar with unread count + dropdown.
- Client UI: notification bell in portal.
- Polling is acceptable for MVP; add SSE endpoint for real-time later.

---

## 18. Audit Logging

New table **`audit_logs`**:
```
id uuid PK
actor_type  admin|client|public|system|ai
actor_id    uid or sessionId
action      string (lead.status_update, service.create, media.delete, ai.config.update, login.success/fail, ...)
entity      string (leads/services/...)
entity_id   uuid
meta        jsonb (before/after diff, IP, user-agent)
created_at  timestamptz default now()
```
- Insert via a server helper after every successful mutating admin/client action. Never block the response on audit insert (fire-and-forget with catch).
- Admin UI: Security/Audit screen to browse/filter/export.
- Retain for 12 months; archive older.

---

## 19. Analytics & Reporting

Today's Dashboard `/admin/stats` returns: total/published projects; new/qualified/won/total leads + conversion rate; active/total clients; content counts (services, faqs, testimonials, insights); recent 8 leads + 6 projects. That's all that is **actually** measurable from current data.

What's required for reliable analytics:
- **Add `ai_usage`** (surface, model, fallbackUsed bool, inputTokens, outputTokens, latencyMs, toolCalls[] jsonb, errorCode nullable, sessionId, createdAt, ip hash, clientId nullable) — populated by the AI runner.
- **Add `page_views`** (path, referrer, ua hash, country from CF-Connecting-IP+CF-IPCountry, session anonId, createdAt) — via Worker middleware on public routes, with sampling and bots excluded. Privacy-friendly (no cookies, no PII).
- **Add `lead_events`** (leadId, event, meta) to track qualification timeline.
- **Add `conversion_events`** (service viewed, CTA clicked, estimate started, lead submitted) — client-side ping to Worker, with ad-hoc UTM.
- Lead source UTM capture on submit.
- Then Dashboard can show: traffic → leads → qualified → won conversion funnel, per-source ROI, per-service interest, AI usage/savings (e.g. "Tolesh handled 142 conversations, 18 converted to leads this week").

Don't invent numbers until these tables exist.

---

## 20. API Inventory

### Existing endpoints (Worker `server/src/`)

| Method | Endpoint | Auth | DB | Purpose | Used by UI |
|---|---|---|---|---|---|
| GET | `/healthz` | none | ping | liveness + DB/AI probe | Admin topbar |
| GET | `/admin/_ping` | none | none | lightweight reachability | (not currently called) |
| GET | `/cms/services` | none | services.published | public service list | **unused** |
| GET | `/cms/services/:slug` | none | services | public detail | **unused** |
| GET | `/cms/projects` | none | projects.published | public project list | **unused** |
| GET | `/cms/projects/:slug` | none | projects | public detail | **unused** |
| GET | `/cms/faqs` | none | faqs.published | public FAQs | **unused** |
| GET | `/cms/pricing` | none | pricingPlans.published | public pricing | **unused** |
| GET | `/cms/testimonials` | none | testimonials.published | public testimonials | **unused** |
| POST | `/leads` | rate limit | leads insert | public lead submit | StartProject (dual-write); Tolesh create_lead |
| POST | `/media/upload` | admin auth | R2 + media insert | admin upload | Media section |
| GET | `/assistant/session` | rate limit | assistantSessions | get/create anon id | Tolesh widget |
| POST | `/assistant/chat` | rate limit | sessions + messages + lead via tool | public Tolesh | Tolesh widget |
| POST | `/assistant/admin` | admin auth + rate limit | sessions + messages + full AI tools | admin AI chat | Admin AI Chat |
| POST | `/assistant/client` | client auth (header code) | sessions + client tools | client AI chat | **not wired in Portal UI** |
| POST | `/ai-lab/planner` `/ai-lab/advisor` `/ai-lab/idea` | rate limit | AI + RAG | AI Lab tools | Labs page |
| GET | `/admin/stats` | admin | cross-table | dashboard stats | Dashboard |
| GET/POST/PUT/DELETE | `/admin/services` `/services/:id` | admin | services CRUD | Services |
| GET/POST/PUT/DELETE | `/admin/projects` `/projects/:id` | admin | projects CRUD | Portfolio |
| GET/POST/PUT/DELETE | `/admin/faqs` `/faqs/:id` | admin | faqs CRUD | FAQs |
| GET/POST/PUT/DELETE | `/admin/testimonials` `/testimonials/:id` | admin | testimonials CRUD | Testimonials |
| GET/POST/PUT/DELETE | `/admin/insights` `/insights/:id` | admin | insights CRUD | Insights |
| GET/POST/PUT/DELETE | `/admin/pricing` `/pricing/:id` | admin | pricingPlans CRUD | Pricing |
| GET/POST/PUT/DELETE | `/admin/products` `/products/:id` | admin | products CRUD | Products |
| GET/POST/PUT/DELETE | `/admin/leads` `/leads/:id` | admin | leads CRUD | Leads |
| GET/POST/PUT/DELETE | `/admin/clients` `/clients/:id` | admin | clients CRUD (POST returns accessCode) | Clients |
| GET/POST/PUT/DELETE | `/admin/client-projects` `/client-projects/:id` | admin | clientProjects CRUD | Jobs |
| GET/POST/PUT/DELETE | `/admin/milestones` `/milestones/:id` | admin | milestones CRUD | Jobs (partial) |
| GET | `/admin/settings` | admin | site_settings key/value | **unused by UI** |
| PUT | `/admin/settings/:key` | admin | upsert site_settings | AIModelControl uses this for ai_config |
| GET | `/admin/media` | admin | media list | Media |
| DELETE | `/admin/media/:id` | admin | media + R2 delete | Media |
| GET | `/admin/ai/config` | admin | env + DB-staged ai_config | AIModelControl |
| GET | `/admin/ai/models` | admin | Dahl /v1/models proxy | AIModelControl |
| GET | `/admin/ai/status` | admin | Dahl /v1/status proxy | AIHealth |
| POST | `/admin/ai/config` | admin | upsert ai_config (staged) | AIModelControl (**dead-end**) |
| GET | `/admin/ai/conversations` | admin | assistantSessions list (prefix filter) | AIChat + AIConversations |
| GET | `/admin/ai/conversations/:id/messages` | admin | session + messages | AIChat thread |
| POST | `/admin/ai/conversations/:id/rename` | admin | update session.name | AIChat |
| DELETE | `/admin/ai/conversations/:id` | admin | delete messages + session | AIChat |

### Missing endpoints required for full connection
- Public CMS: GET `/cms/products`, `/cms/solutions`, `/cms/tools`, `/cms/insights`, `/cms/insights/:slug`, `/cms/labs`, `/cms/site-settings` (public-safe slice: businessName, tagline, social, availability, seoDefaults, founder info), `/cms/testimonials?featured=true`
- Public lead capture: ensure `/contact` form submits to `/leads` with source=contact; `/estimate` with source=estimate.
- Client auth: POST `/client/login` (email, code → signed JWT), POST `/client/logout`, GET `/client/me`.
- Client data (all JWT-auth, ownership-enforced): GET `/client/projects`, GET `/client/projects/:id`, GET `/client/projects/:id/milestones`, GET `/client/projects/:id/messages`, POST `/client/projects/:id/messages`, GET `/client/projects/:id/files`, POST `/client/projects/:id/files` (signed upload URL), GET `/client/files/:id` (signed download), GET `/client/invoices`, GET `/client/invoices/:id/pdf`, GET `/client/notifications`, POST `/client/notifications/:id/read`, POST `/client/milestones/:milestoneId/approve` (optional).
- Admin client-project extensions: POST/PUT/DELETE `/admin/tasks`, GET `/admin/messages`, POST `/admin/messages`, GET `/admin/project-files`, POST `/admin/project-files`, DELETE `/admin/project-files/:id`, GET/POST/PUT/DELETE `/admin/invoices`.
- Notifications: GET `/admin/notifications`, POST `/admin/notifications/:id/read`, POST `/admin/notifications` (manual send).
- AI admin: GET `/admin/ai/usage` (from ai_usage table), GET `/admin/ai/usage/summary` (dashboard metrics).
- Audit: GET `/admin/audit-logs` (OWNER only).
- Admin users: POST `/admin/admin-users` (OWNER), PUT/PATCH `/admin/admin-users/:id` (role change), DELETE `/admin/admin-users/:id`, POST `/admin/login` (verify password or Firebase token → signed session JWT).
- Media picker: GET `/admin/media?role=...` filter already works; add POST `/admin/media/from-url` (for avatar-by-URL) optional.
- Signed URL endpoint for private files: GET `/admin/files/:id/signed-url` (admin) and GET `/client/files/:id/signed-url` (client).

---

## 21. Database Relationship Map (text diagram)

```
admin_users (uid PK)
  └── (notifications.uid) [logical: admin target]
  └── (audit_logs.actor_id) [future]

clients (id PK, user_id unique)
  ├── clientProjects.clientId ──► clients.id   (logical, no FK)
  │     ├── milestones.projectId ──► clientProjects.id
  │     │     └── tasks.milestoneId ──► milestones.id
  │     ├── tasks.projectId ──► clientProjects.id
  │     ├── projectFiles.projectId ──► clientProjects.id
  │     ├── messages (contextType='PROJECT', contextId=clientProjects.id)
  │     └── invoices.projectId ──► clientProjects.id
  ├── invoices.clientId ──► clients.id
  └── leads.convertedClientId ──► clients.id (logical)

leads (id PK, ref unique)
  ├── assistantSessions.capturedLeadId ──► leads.id
  └── messages (contextType='LEAD', contextId=leads.id) [future]

assistantSessions (id PK, anonId)
  └── assistantMessages.sessionId ──► assistantSessions.id

services (id PK, slug unique)
  └── (projects.serviceIds JSONB)  [logical reverse]
  └── (services.relatedProjectIds JSONB)  [logical]

projects (id PK, slug unique)         -- public portfolio
  └── testimonials.relatedProjectId ──► projects.id
  └── clientProjects.publicProjectId ──► projects.id (logical)

media (id PK, r2Key unique)
  └── referenced by URL from services/projects/insights/site_settings/... (no FK; loose coupling)

testimonials, faqs, insights, pricingPlans, products, labItems, pricingPlans
  └── no outgoing FKs (self-contained)

site_settings (key PK)
  └── ai_config is one row; other keys for general/social/availability/notifications/seo/founder

notifications (uid nullable → admin broadcast)

MISSING FKs TODAY: every relation in the schema uses varchar(36) columns WITHOUT foreign key constraints. Add them in a migration (with ON DELETE SET NULL / CASCADE as appropriate) once data is clean. This also means:
- Deleting a client does NOT delete its clientProjects (dangling rows).
- Deleting a clientProject does NOT delete its milestones/tasks/files/messages.
- Orphaned records are already possible.
```

---

## 22. Missing Database Tables/Fields Summary

Must-add for Phase 1–4:
- `ai_usage` — AI request log (see §13).
- `ai_model_stats` — rolling per-model latency/error (or compute from ai_usage).
- `audit_logs` — §15.
- `solutions` — mirror of services but for solutions (currently hardcoded).
- `tools` — tech/stack entries (currently hardcoded).
- `tasks` — **table already exists; need API routes + UI**.
- Recommended additions to existing tables:
  - `leads.assignedTo`, `leads.utmSource/Medium/Campaign`, `leads.landingPage`, `leads.duplicateOf`.
  - `leads_notes` — separate note/activity history table (rather than overwriting `notes`).
  - `media.role`, `media.visibility` (public/private), `media.projectId` (for project files reuse).
  - `projectFiles.uploadedByRole` (admin/client) and `uploadedByName`.
  - `messages.readAt` for both parties; `messages.attachments` (JSONB) already exists.
  - `invoices.stripePaystackId` for payment integration later.
  - `adminUsers.lastLoginAt`.
  - `clientUsers` is redundant — clients already has userId linking to Firebase Auth; add index.

---

## 23. Security Issues (summary, critical first)

| Severity | Issue | Fix |
|---|---|---|
| **Critical** | Client AI endpoint trusts `X-TT-Client-Email` / `X-TT-Client-Code` headers → anyone on the internet can impersonate any client once real clients exist. | Replace with signed JWT from POST /client/login; remove demo creds outside dev. |
| **Critical** | Firebase JWT signature verification is a TODO — a forged JWT (with valid exp/aud/iss shape and a known uid) is accepted as admin or client. | Implement RSA-SHA256 verify with Google certs; pin to `admin_users`/`clients` uid membership. |
| **High** | Hardcoded admin password shipped in frontend bundle; default also hardcoded in server as fallback. | Require `ADMIN_PASSWORD` Worker secret in production; rotate; move to Firebase Auth + JWT in Phase 1. |
| **High** | No FK constraints; deletion of a client leaves dangling projects/milestones/files/messages/invoices. | Add FKs + cascade rules; use soft-delete for critical entities. |
| **High** | Admin AI config save is a placebo (DB staged but server reads env). | Make server read DB config per request (§14). |
| **High** | Public site reads from Firebase which no Admin CMS writes to (split brain); AI reads from Neon, leading to contradictory answers. | Switch public site to Worker `/cms`; deprecate Firebase Firestore. |
| **Medium** | No input validation library on server; Drizzle accepts arbitrary keys via spread (`set({...b})` in PUT handlers) → mass-assignment risk (clients can set `id`, `createdAt`, `isAdmin` etc. if sent). | Whitelist updatable fields per route; use zod schema validation. |
| **Medium** | Rate limiter is in-memory per Worker isolate — not globally coordinated. Acceptable for MVP but can be bypassed by hitting many isolates. | Move to Upstash Redis or Cloudflare KV counters for production. |
| **Medium** | `uploadMedia()` in `lib/api.ts` sends the admin password header but doesn't set Content-Type length/csrf (acceptable, but note). | Already admin-gated server-side. |
| **Medium** | CORS default allows `*.netlify.app` — pre-existing, tighten for production custom domain only. | Set CORS_ORIGIN env explicitly. |
| **Low** | `sessionStorage` for admin password means XSS can exfiltrate it. | Move to httpOnly cookie JWT. |
| **Low** | No security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy) on Worker responses. | Add middleware. |

---

## 24. Implementation Phases

### PHASE 1 — Foundation (security + data source of truth)
1. **Deprecate Firebase split-brain:**
   - Write a one-shot migration script that reads Firebase Firestore DEFAULT_* documents + `services`/`projects`/`faqs`/`testimonials`/`insights`/`clients`/`clientProjects`/`milestones`/`files`/`messages`/`leads`/`media` + `settings/global` + Storage download URLs, transforms them, and upserts into Neon + re-uploads files to R2.
   - Add new Neon tables: `solutions`, `tools`, `ai_usage`, `audit_logs` (plus missing columns per §22).
   - Add real foreign-key constraints in a drizzle migration once data is clean.
2. **Fix input validation:** add zod schemas for every POST/PUT payload; whitelist updatable fields in PUT handlers to prevent mass assignment.
3. **Make server read ai_config from DB per request** (with TTL cache), so AIModelControl "Save" works live.
4. **Add missing /cms endpoints** for products/solutions/tools/insights/labs/site-settings/testimonials-featured.
5. **Authentication hardening (Phase 1a):**
   - Enforce ADMIN_PASSWORD env is set; remove hardcoded default fallback (fail closed in production).
   - Replace client header auth with POST /client/login returning signed JWT; all /client/* routes verify JWT.
   - Remove demo-code fallback outside dev env flag.
6. **Add audit-log helper + audit inserts on every mutating admin endpoint.**

### PHASE 2 — Core CMS (public site reads from Worker)
1. Build a tiny public-side API client (`lib/cms.ts`) that fetches from `/cms/*` with SWR/React Query and short TTL cache.
2. Refactor public pages to use it (replace `useData()` consumption for services, projects, FAQs, pricing, testimonials, insights, products, solutions, tools, labs, founder, social, availability, notification, SEO defaults).
3. Hardcode nothing except layout chrome; remove DEFAULT_* constants from DataContext.
4. Extend `retrievePublic` (RAG) to index insights, products, tools, solutions, testimonials.
5. Wire Contact form to POST `/leads?source=contact`; wire Estimate to `/leads?source=estimate`; add UTM capture.
6. Media picker integration in CRUD forms.
7. Set R2_PUBLIC_URL; serve all public media from R2.
8. Keep Tolesh widget as-is; verify RAG results now match the public site.
9. Remove Firestore reads from `DataContext` (leave Auth for later); remove Firebase storage usage for brand/founder — upload to R2 via Media Library.

### PHASE 3 — CRM
1. Lead activity timeline table (`lead_notes`) + UI.
2. Lead → Client conversion flow (UI + atomic endpoint).
3. Lead duplicate detection on email.
4. Follow-up date + reminders (notifications).
5. Source UTM capture.
6. Email delivery (Resend): welcome, access code, lead auto-reply, proposal, invoice emails. Templates stored as DB partials or static.

### PHASE 4 — Client Portal
1. Build real Portal UI that calls Worker `/client/*` with JWT auth (no Firebase DataContext).
2. Client-side routing; projects list, detail, milestones, files list/download, messages, send message.
3. Admin-side Messages UI (in Jobs section) — replying per project.
4. Project file upload UI on both sides (admin uploads deliverables, client uploads assets) via `/admin/project-files` + `/client/projects/:id/files`.
5. Notifications API + bell UI on both sides; polling then SSE.
6. Milestone approval by client.
7. Tasks UI (admin) + read-only tasks view (client).
8. Wire the client AI assistant into the Portal UI (it already exists on the server).
9. Mark demo client behind dev-only flag.

### PHASE 5 — Payments / Invoicing
1. Invoice CRUD on Admin (create line items, generate PDF via server-side renderer or template, upload to R2, set status SENT).
2. Client invoice list + PDF download.
3. Paystack/Stripe integration (webhook verifies signature → marks invoice PAID, inserts payment row).
4. Revenue metrics on Dashboard.
5. Final-delivery workflow: final invoice → payment → testimonial request.

### PHASE 6 — AI Hardening
1. Per-surface timeout/maxTokens/tool-access/prompt-override in DB.
2. `ai_usage` logging on every AI request (tokens, latency, fallback, tool calls, errors).
3. AI Health dashboard powered by `ai_usage` + Dahl status (p50/p95 latency, error rate, fallback %, per-surface stats).
4. Admin AI tool permissions (read + draft only; no send/delete/payment actions).
5. Client AI tool scope limited to own data (already mostly there; verify).
6. AI Lab prompt editor in Admin.
7. Implement RSA-SHA256 JWT signature verification for Firebase Auth.

### PHASE 7 — Analytics
1. `page_views` middleware (anonymized, no cookies).
2. Conversion event endpoint.
3. Dashboard analytics cards (traffic, lead funnel, per-source, AI usage, revenue).
4. Date-range filtering.
5. CSV export.

### PHASE 8 — Hardening
1. Replace password auth with Firebase Auth (or email/password via Worker) + short-lived httpOnly JWT + refresh; role-based OWNER/ADMIN/EDITOR middleware.
2. Admin-user management screen.
3. Full FK constraints + cascade rules after data audit.
4. Security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy) on Worker.
5. CSRF protection if cookies are used.
6. Rate limiting on KV/Upstash for global accuracy.
7. Backup/restore playbook for Neon + R2.
8. End-to-end tests for admin CRUD, client isolation, lead submission, AI flows.
9. Load/performance test on AI chat and media upload.
10. Production CORS tightened to the custom domain; remove *.netlify.app from production allowlist.
11. Remove Firebase from the bundle entirely or leave it only for Auth once Firestore/Storage are fully migrated out.

---

## 25. Dependency Order
1. Phase 1 unblocks everything else (must have one source of truth + validation before we extend features).
2. Phase 2 must precede marketing launches and ensures the public CMS loop works.
3. Phase 3 can start in parallel with Phase 2 but lands after Phase 1.
4. Phase 4 (Portal) depends on Phase 3 client creation + Phase 1 auth.
5. Phase 5 (payments) depends on Phase 4 (invoices shown in portal).
6. Phase 6 AI hardening depends on Phase 1 config fix; parts (usage logging) should go in with Phase 1.
7. Phases 7/8 are sequential polish.

---

## 26. Risks
- **Data migration risk:** Firebase → Neon migration must preserve relationships (lead refs, client access codes, project slugs). Test on a staging copy of Neon before cutting over.
- **R2 public URL change:** if switching from Firebase Storage URLs to R2 URLs, a redirect map or dual-read period will prevent broken images.
- **AI regressions:** switching surface-config to DB could change model routing unexpectedly; keep env defaults as fallback and log when DB config overrides.
- **JWT secret management:** the Worker needs a signing secret (JWT_SECRET); rotate on suspected compromise.
- **Email deliverability:** use a verified domain (SPF/DKIM/DMARC) for transactional email; otherwise emails will land in spam.
- **Rate-limit false positives:** IP-based rate limit can CGNAT legitimate users; combine with session id where available.
- **Client portal demo leakage:** remove the demo code before going live with real clients; keep under dev flag.
- **Worker cold start + Neon TLS:** acceptable; keep queries indexed (add composite indexes on common lookups: messages by context, projectFiles by projectId, assistantMessages by sessionId ordered by createdAt).
- **Admin password rotation:** rotating ADMIN_PASSWORD invalidates all existing sessions; acceptable for a small team.

---

## 27. Testing Requirements
- **Unit tests (Vitest or tsx):** zod validation schemas; auth token verify; rate limiter; slug generation; permission checks; AI config merge.
- **Integration tests (wrangler dev + test Neon):** every endpoint returns 401 without auth; client endpoint rejects access to other client's project; lead POST validates and generates TT-ref; cascade delete behaviour; ai_config overrides env when set; media upload round-trips to R2; public /cms returns only published.
- **IDOR test matrix:** for each client-scoped endpoint, try accessing another client's projectId; expect 404.
- **Security tests:** forged JWTs are rejected; mass-assignment of `id`/`createdAt`/`role` in PUT bodies is ignored; CORS blocks disallowed origins; upload of disallowed mime/size rejected.
- **End-to-end tests (Playwright):** login → create service → see it on /services; lead form submission creates Neon row; AI config save changes model routing for subsequent /assistant/admin call; client can only see own projects.
- **Mobile/responsive**: already covered by the current CSS refactor.
- **Load tests:** k6 against /assistant/chat (AI path) and /cms/services (cached path).

---

## 28. Recommended Final Architecture

```
BROWSER (public site + admin + client portal)
   │
   │  HTTPS (same-origin to Worker in production; /api via Vite proxy in dev)
   ▼
CLOUDFLARE WORKER (Hono, server/src)
   ├── /cms/*            → Neon, public read (published only), cache TTL
   ├── /leads            → rate limit + validation → Neon (leads insert)
   ├── /assistant/*      → rate limit + auth (none/admin/client JWT) → AI + Neon (sessions/leads via tools)
   ├── /ai-lab/*         → rate limit → AI + Neon (read-only tools)
   ├── /media/upload     → admin auth → R2 + Neon media
   ├── /client/*         → JWT auth + ownership checks → Neon (+ signed R2 URLs)
   ├── /admin/*          → admin auth → Neon CRUD + AI management + media
   ├── /healthz          → liveness/DB/AI probe
   └── audit log hook    → Neon audit_logs (fire-and-forget)
           │
           ├── Neon (Postgres, serverless)
           │     ├── 20+ tables (schema.ts)
           │     ├── Drizzle ORM, migrations via drizzle-kit
           │     └── Indexes on all foreign key + status/createdAt columns
           │
           ├── R2 (ASSETS bucket)
           │     ├── media/  brand/  founder/  projects/<id>/  invoices/<id>/
           │     └── public URL via assets.toluenetech.com; private via signed URLs
           │
           ├── Dahl AI (inference.dahl.global)
           │     └── API key as Worker secret only
           │
           ├── Resend (transactional email) — later phase
           ├── Paystack/Stripe (payments) — later phase
           └── Upstash Redis (rate limits + cache) — optional hardening

FIREBASE
   └── Authentication only (optional long-term; can replace with Worker-issued JWTs)
       └── admin_users.userId + clients.userId reference Firebase uids when present.
       NO Firestore reads/writes, NO Firebase Storage usage after migration.
```

**Core invariant after migration:** every admin edit lands in Neon; every public page reads from Neon via Worker; every AI answer reads from Neon; R2 is the only binary store. No data lives in Firebase Auth except identity. When you click "Save" in Admin, the effect must be visible on the public site and to AI within seconds.

---

**End of report.** No code changes were made in producing this audit. Ready for your instruction on which phase to begin with.
