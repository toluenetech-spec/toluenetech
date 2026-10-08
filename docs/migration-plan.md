# Firebase → Neon Migration Plan

Phase 1 builds the foundation; **data is NOT migrated in Phase 1.** This document defines the per-collection migration that Phase 2+ will execute.

## Migration method

1. **Take Neon backup.** Use Neon's point-in-time branching to create a migration branch, run migration dry-runs there before applying to main.
2. **Run `scripts/migrate-firestore.mjs`** (to be written in Phase 2) using Firebase Admin SDK against a service account key. The script reads every document, transforms fields according to the table below, inserts into Neon with idempotency keys (Firebase doc ID → Neon id where stable; otherwise new UUID and a `migrated_from_firebase` flag).
3. **Re-run with upsert semantics** until Firestore reads are zero; final cutover flips feature flags.
4. **Rollback plan:** switch feature flags back to Firebase reads; Neon writes are safe to discard (no Neon data has been served yet during early phases). Once public site reads 100% from Worker, Firestore can be set to read-only and finally deleted.

## Per-collection mapping

| Firebase collection / constant | Neon table | ID mapping | Transformations | Duplicates | Risk |
|---|---|---|---|---|---|
| `services` (DEFAULT_SERVICES hardcoded + any docs) | `services` | `svc_<slug>` or UUID; preserve slugs | capabilites/relatedProjectIds as JSONB arrays; timestamps | Slug conflict → append suffix | Low |
| `projects` (portfolio) | `projects` | `prj_<slug>` or UUID | clientName shown only if `hasClientPermission=true`; gallery URLs rehosted to R2 (see files row) | Low | Med (gallery images may be on 3rd-party hosts) |
| `faqs` (DEFAULT_FAQS) | `faqs` | UUID | category defaults to "General"; order preserved | Low | Low |
| `testimonials` | `testimonials` | UUID | relatedProjectId matches Neon project by slug where possible | Low | Low |
| `insights` | `insights` | `ins-<slug>` or UUID | markdown content unchanged; tags as array | Low | Low |
| `pricingPlans` (none in Firebase defaults) | `pricing_plans` | UUID | priceMonthly/priceOneTime in USD cents | Low | Low |
| `products` | `products` | `prod-<slug>` or UUID | screenshots rehosted to R2; status enum mapping | Low | Low |
| `solutions` (DEFAULT_SOLUTIONS hardcoded) | NEW `solutions` table (Phase 2) | `sol-<slug>` | same shape as services | Low | Low |
| `tools` (DEFAULT_TOOLS devicon URLs) | NEW `tools` table (Phase 2) | UUID; preserve name + devicon class | name/url/category | Low | Low |
| `labs` | `lab_items` | UUID | category enum defaults to 'EXPERIMENT' | Low | Low |
| `leads` (DEFAULT_LEADS none; any existing Firestore leads) | `leads` | new UUID; preserve existing TT-ref if present | source → 'firebase-import'; merge on email+created_at within 5min to avoid duplicates with Neon leads | **Check duplicates on (email,created_at window)**; TT-ref collisions resolved by appending suffix | Medium (don't want duplicate TT refs) |
| `clients` (DEFAULT demo + any Firestore docs) | `clients` | Use 'client-demo' for demo; otherwise new UUID with `migrated_from_firebase=true` | Generate fresh accessCode (and reset on first login) per client; email uniqueness enforced | **Email duplicates** between demo and imported clients | Medium (access codes; must notify clients) |
| `clientProjects` (DEFAULT demo + any) | `client_projects` | Use 'cp-demo-1' for demo; link to client-demo; new UUID for others | clientId mapped to Neon client.id; status enum normalization | Low | Medium (must remap clientId foreign keys) |
| `milestones` (DEFAULT demo) | `milestones` | 'ms-1'..'ms-4' for demo; new UUID for others | projectId mapped | Low | Medium |
| `files` (DEFAULT demo with `#` links) | `project_files` + media entries | New UUID; no file data exists to migrate (URLs were `#`) | No binary migration needed (these were placeholders) | Low | Low (broken links become 404 after migration) |
| `messages` (DEFAULT welcome) | `messages` | New UUID; preserve demo welcome | contextType=PROJECT, contextId mapped to Neon projectId | Low | Low |
| `media` (Firebase Storage metadata) | `media` | new UUID; download binary from Firebase Storage, re-upload to R2 with `makeKey('uploads', filename)` | Compute sizeBytes, mimeType from upload; visibility PUBLIC | Low | Med (binary migration; handle 404s and record in migration report) |
| `settings/global` (doc) | `site_settings` (keyed by domain) | split document into separate keys: `general`, `social`, `availability`, `notification`, `seo`, `founder` | shape validated; businessName/tagline/etc. mapped to general | Low | Low |
| `socialLinks` (inside settings doc) | site_settings key `social` | — | email/WhatsApp/social URLs preserved | Low | Low |
| `founderNote`, `founderImageData` | site_settings key `founder`; founder image → media row (role='founder_image') | new UUID for media; | download founder image from Firebase Storage, upload to R2/brand prefix, set role | Low | Med (binary) |
| `brandProfileData`, `pricingGuideData`, `portfolioHighlightData` (Firebase Storage URLs) | media rows with role `brand_cv`, `pricing_guide`, `portfolio_highlight` | new UUID per file; visibility=PUBLIC | reupload bytes to R2/brand prefix | Low | Med |
| `siteNotification` | site_settings key `notification` | — | map shape to { isActive, message, link, linkText } | Low | Low |

## Files / Storage migration
For every Firebase Storage object referenced by Firestore docs (founder image, brand PDFs, existing uploads):
1. GET object bytes via Firebase Admin SDK.
2. Determine mime type and size.
3. PUT to R2 under the appropriate prefix using `makeKey()`.
4. Insert `media` row with `visibility=PUBLIC`, correct `role`, `publicUrl`.
5. Replace all references in Neon rows with the new R2 public URL.
6. Do NOT delete Firebase Storage objects until Phase 2 cutover is validated and a backup exists.

## Validation after migration
For each entity:
- Count: Neon count ≥ Firebase count (accounting for demo seed records).
- Spot-check slugs resolve (GET /cms/<entity>/<slug> 200).
- Media URLs return 200 with Content-Length > 0.
- Lead refs are unique and sequential.
- Client emails are unique.
- `client_projects.clientId` all resolve to a Neon client.
- `milestones.projectId` all resolve to a Neon project.
- No orphaned records remain; or they are reported before FK migration 0002 is applied.

## Rollback
- All migration scripts are idempotent (upsert by stable key or `migrated_from_firebase` flag).
- Rollback is: set `VITE_DATA_SOURCE=firebase` (runtime flag to be added in Phase 2), restart deploy; no Neon data deletion is needed.
- Firebase project is left intact until Phase 8 (hardening) when Firestore reads are confirmed at zero for 30 days.

## NOT in scope for Phase 1
- Firebase Auth users are not migrated. Admin users log in with ADMIN_PASSWORD until Firebase Auth is wired to admin_users (already scaffolded; signature-verified JWTs work once users exist in admin_users table). Clients use email+accessCode via POST /auth/client/login.
- Storage rules are not audited/changed. After Firestore dependency is removed, restrict Firebase Security Rules to disallow public client reads/writes.
