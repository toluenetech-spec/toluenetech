# CMS Architecture

The CMS is the Neon → Cloudflare Worker → browser pipeline for all public-facing content. Phase 2 source of truth for marketing pages, portfolio, blog, pricing, FAQs, testimonials, tools, solutions, products, and site-wide settings.

## Core Rule

Neon (Postgres) + the Cloudflare Worker API are the single source of truth. The browser never connects directly to the database; it talks to `/cms/*` on the Worker. Firebase is NOT a permanent fallback — built-in DEFAULT_* seed constants are used only when the Worker is unreachable, with a `console.warn` so dev/test sees fallback use.

## Layers

| Layer | Technology | Responsibility |
|---|---|---|
| Database | Neon (Postgres 16) | Persistent storage; enforces types / enums / unique constraints |
| ORM / Schema | Drizzle ORM (`server/src/db/schema.ts`) | Table definitions, migrations |
| Admin API | Worker `/admin/*` (JWT-protected) | CRUD for services, solutions, projects, products, testimonials, FAQs, insights, pricingPlans, tools, siteSettings, media |
| Public API | Worker `/cms/*` (unauthenticated, read-only) | Published-only reads with caching headers |
| Client Library | `lib/cms.ts` | Typed fetcher with 60-second in-memory cache |
| UI | `context/DataContext.tsx` (uses `loadCMSData`) and `components/admin/sections/*` | Admin editors (GenericCRUD) + public page consumption |
| Cache | Cloudflare edge + browser in-memory | 60s s-maxage, 5min stale-while-revalidate; admin responses are `no-store` |

## Data Model

Tables: `services`, `solutions`, `projects` (public portfolio), `products`, `tools`, `faqs`, `testimonials`, `pricingPlans`, `insights`, `site_settings`. All share `isPublished` (boolean) and `order` (integer). Insights use `isDraft`. Projects have a separate `client_projects` table for private work. Projects only expose `clientName` when `hasClientPermission = true`.

## Public API (`/cms/*`)

All endpoints unauthenticated, read-only, enforce `isPublished = true`, return 404 for unpublished/missing, and set `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=300`.

Endpoints: `/services`, `/services/:slug`, `/solutions`, `/solutions/:slug`, `/projects` (paginated, `page/limit/category/q`), `/projects/:slug`, `/products`, `/products/:slug`, `/tools` (optional `?category`), `/faqs` (optional `?category`), `/pricing`, `/testimonials`, `/insights` (paginated, content stripped in list), `/insights/:slug`, `/site` (public-safe subset of site_settings).

## Admin API (`/admin/*`)

JWT required. All mutations whitelist mutable fields, validate types/lengths/enums server-side, auto-generate slugs, enforce uniqueness, and write append-only `audit_logs`. Leads are soft-archived (status = ARCHIVED), never hard-deleted.

## Validation

Required fields, string max lengths, enums, email format, slug patterns, array slice limits. Drizzle uses parameterized queries (no SQL injection). React-side validation is cosmetic only.

## Security

- Public endpoints never emit `isPublished = false` rows.
- Admin endpoints reject unauthenticated / wrong-role with 401.
- Client endpoints enforce ownership via `assertProjectOwnership(clientId, projectId)` deriving clientId from the JWT (never from request body/query).
- Tolesh tool surfaces are partitioned by `ctx.kind` (public/admin/client). Public Tolesh has no CRM tools.

## Migrations

`server/drizzle/0003_phase2_cms_crm.sql` adds `solutions`, `tools`, `lead_notes`, `page_views`, ARCHIVED status, and lead attribution fields.
