# Firebase → Neon Migration

## Policy

1. Do NOT delete Firebase data. Collections remain until post-migration monitoring confirms parity.
2. Do NOT silently migrate. Each consumer is switched explicitly after verification.
3. Do NOT build a permanent hidden Firebase fallback. Fallbacks are intentional, visible in dev/test (console.warn), and time-bounded.
4. Identify → Compare → Transform → Verify → Switch → Monitor → Deprecate.

## Migration status

| Entity | Firebase | Neon | Public from Neon? | Admin from Neon? | Fallback? | Status |
|---|---|---|---|---|---|---|
| Services | services | services | YES | YES | DEFAULT_SERVICES seed | COMPLETE |
| Solutions | solutions | solutions | YES | YES | DEFAULT_SOLUTIONS | COMPLETE |
| Portfolio projects | projects | projects | YES | YES | empty list | COMPLETE |
| Products | products | products | YES | YES | — | COMPLETE |
| Tools | (hardcoded) | tools | YES | YES | DEFAULT_TOOLS | COMPLETE |
| FAQs | faqs | faqs | YES | YES | DEFAULT_FAQS | COMPLETE |
| Testimonials | testimonials | testimonials | YES | YES | — | COMPLETE |
| Pricing | (copy) | pricing_plans | YES | YES | built-in list | COMPLETE |
| Insights | insights | insights | YES | YES | — | COMPLETE |
| Site settings | settings/global | site_settings (kv) | YES (safe subset) | API ready; UI partial | INITIAL_* constants | PARTIAL |
| Media | media | media + R2 | YES via R2 | YES | — | COMPLETE |
| Leads | leads | leads + lead_notes | n/a | YES | none (Firebase dual-write removed) | COMPLETE |
| Clients | clients | clients | n/a | YES | demo client | COMPLETE |
| Client projects | clientProjects | client_projects | n/a | YES | demo project | PARTIAL |
| Milestones | milestones | milestones | n/a | YES | demo milestones | PARTIAL |
| Files | files | project_files + R2 | n/a | YES | demo files | PARTIAL |
| Messages | messages | messages | n/a | reads ready, writes partial | demo message | PARTIAL |
| Lab items | labs | lab_items | not consumed | not yet migrated | DEFAULT_LABS (empty) | NOT STARTED (Phase 4) |
| Invoices | — | invoices | n/a | not exposed | — | NOT STARTED |
| Notifications | — | notifications | n/a | not wired | — | NOT STARTED |

## Switch method

For each CMS entity: (1) Neon table + Drizzle schema, (2) `/admin/<entity>` whitelisted CRUD, (3) `/cms/<entity>` public read with published filter, (4) typed fetcher in `lib/cms.ts`, (5) DataContext switched from Firebase `loadCollection` to `loadCMSData()`, (6) typecheck + build verified.

## Fallback during transition

If `/cms/*` is unreachable the frontend catches the error, `console.warn`s, and uses built-in `DEFAULT_*` seeds so the site renders. This is intentionally visible (no silent fallback to Firebase). Firebase reads for CMS entities are removed; Firebase writes are no-ops if Firestore is unreachable; leads no longer dual-write.

## How to verify post-deploy

1. Admin → Neon → Public: edit a service; public page updates within ~60s.
2. Public → Neon → Admin: submit Start Project; new lead appears in Admin with correct source/sourcePage.
3. Admin-Client → Neon → Client UI: create client + project, login as client, only own projects visible.
4. Public AI → tool → Neon → correct response: pricing questions use pricing_plans; asks about other clients are refused.
5. IDOR: client A token requesting client B project → 404.

## Remaining work

1. Wire Admin Settings UI to `/admin/settings` keys (company, contact, social, founder, notification, availability, hero, brand, seo_defaults).
2. Client-portal writes (messages, uploads, approvals) via `/client/*` POST endpoints.
3. One-time historical backfill script (Firebase → Neon) for old leads/docs (offline, not runtime).
4. Firebase-vs-Neon compare script to validate before deprecation.
5. After 2-week clean monitoring window, remove Firebase reads from settings/client-portal and mark Firebase collections deprecated.

## Hard rules honored

No Firebase data deleted; no private client data in public projects; no draft data leaks; slug uniqueness enforced at DB; AI writes only through validated lead tool; public Tolesh has no CRM tools.
