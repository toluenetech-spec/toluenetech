# Data Source Strategy

## Declared source of truth (Phase 1+)

**Neon Postgres** = primary application data store.
**R2** = canonical file storage.
**Cloudflare Worker** (`https://toluene-tech-api.toluenetech.workers.dev`) = only API the browser talks to for mutable operations.

Firebase (Firestore + Storage) is in **read-mostly wind-down** state. It still powers the public website and Client Portal in Phase 1 (because those pages consume `context/DataContext.tsx`), but it is no longer the target of any new Admin write paths except the Settings screens that have not yet been migrated. All Phase 2 work will:

1. Replace Firebase reads in public pages with Worker `/cms/*` fetches.
2. Replace Firebase reads in Portal with Worker `/client/*` fetches.
3. Turn Firebase Auth into an optional identity provider (admin users may sign in with Firebase; their uids map to `admin_users.uid` or `clients.userId`).
4. Remove Firestore access from the bundle entirely.

## Per-entity status (end of Phase 1)

| Entity | Neon | Worker API | Admin UI writes | Public/Portal reads | Firebase use |
|---|---|---|---|---|---|
| Services | ✅ table | ✅ /admin/services, /cms/services | ✅ Neon (GenericCRUD) | ❌ Firebase DataContext | read-only until Phase 2 |
| Projects (portfolio) | ✅ | ✅ /admin/projects, /cms/projects | ✅ Neon | ❌ Firebase | read-only until Phase 2 |
| FAQs | ✅ | ✅ /admin/faqs, /cms/faqs | ✅ Neon | ❌ Firebase | read-only |
| Testimonials | ✅ | ✅ /admin/testimonials, /cms/testimonials | ✅ Neon | ❌ Firebase | read-only |
| Pricing plans | ✅ | ✅ /admin/pricing, /cms/pricing | ✅ Neon | ❌ (page likely hardcoded) | read-only |
| Insights | ✅ | ✅ /admin/insights; (no /cms yet) | ✅ Neon | ❌ Firebase | read-only |
| Products | ✅ | ✅ /admin/products; (no /cms yet) | ✅ Neon | ❌ Firebase | read-only |
| Leads | ✅ | ✅ public POST, admin CRUD | ✅ Neon; Tolesh create_lead → Neon | — | DataContext.addLead dual-writes; to be removed |
| Clients | ✅ | ✅ /admin/clients, /auth/client/login, /client/me | ✅ Neon (accessCode persisted!) | ❌ Firebase demo | Portal still uses Firebase defaults |
| Client projects | ✅ | ✅ /admin/client-projects, /client/projects (Phase 1 adds) | ✅ Neon | ❌ Firebase demo | demo data only |
| Milestones | ✅ | ✅ /admin/milestones, /client/projects/:id/milestones (Phase 1) | ✅ Neon | ❌ Firebase demo | demo data only |
| Project files | ✅ table + visibility fields | Phase 2 upload; Phase 1 adds download auth | ❌ ComingSoon | ❌ Firebase `#` links | — |
| Messages | ✅ table | Phase 2 (GET/POST) | ❌ ComingSoon | ❌ Firebase welcome msg | — |
| Invoices | ✅ table | Phase 5 | ❌ ComingSoon | — | — |
| Tasks | ✅ table | Phase 4 | ❌ | — | — |
| Media library | ✅ + visibility/role/projectId | ✅ /media/upload (admin), /admin/media, /files/media/:id | ✅ Neon + R2 | Public URLs render directly | — |
| Site settings | ✅ site_settings | ✅ /admin/settings | ⚠️ Settings screens still write Firebase (General/Social/Brand/Founder/etc.); AI Config writes Neon | Public pages read Firebase | being migrated in Phase 2 |
| Solutions | ❌ no table yet | — | ComingSoon | Firebase DEFAULT_SOLUTIONS | hardcoded |
| Tools/stack | ❌ no table yet | — | Tools section uses Firebase | Firebase DEFAULT_TOOLS | hardcoded |
| Admin users | ✅ admin_users | ✅ (login via JWT or Firebase); no management UI yet | Password login only | — | Firebase Auth used optionally |
| Assistant sessions/messages | ✅ | ✅ all three surfaces | AI Conversations UI reads Neon | — | — |
| AI config | ✅ site_settings.ai_config | ✅ GET/POST /admin/ai/config | ✅ Neon | — | **Phase 1 makes DB config live** |
| Notifications | ✅ + clientId | Phase 3 in-app; Phase 3+ email | ❌ | — | — |
| Audit logs | ✅ NEW table | Phase 8 audit UI | written automatically (Phase 1) | — | — |
| AI usage | ✅ NEW table | /admin/ai/usage endpoint in Phase 6 | — | — | — |

## Rules

1. **No new features write to Firestore.** Any new feature added in Phase 1+ targets Neon + R2.
2. **No secrets in Vite bundles.** All privileged config lives in Worker env.
3. **Dual-writes are removed, not added.** The one remaining dual-write (DataContext.addLead writing to Firestore before POSTing to /leads) will be removed when StartProject switches to `submitLead()` exclusively.
4. **Cache-TTL strategy:** once the public site reads from /cms/*, those endpoints can be cached at the CDN/Edge for 60 seconds; admin endpoints are never cached; mutating endpoints return `Cache-Control: no-store`.
5. **Content preview:** editors need to preview drafts without publishing — add `?preview=<token>` in Phase 2 (signed short-lived preview URLs). For now drafts remain admin-only.
