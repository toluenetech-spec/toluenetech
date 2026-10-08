# Authorization

Authorization is enforced server-side on every request. Frontend route guards are purely cosmetic.

## Principles

1. **Never trust IDs from the client for authorization.** Every client-scoped query derives `clientId` from the verified session token and verifies the resource belongs to that client before returning data.
2. **Deny by default.** Missing auth → 401. Wrong role → 403. Resource not owned by the caller → 404 (we do not leak existence of resources belonging to other tenants).
3. **Whitelist mutable fields.** PUT handlers use `lib/validate.pick()` to accept only the columns the caller is allowed to change. Attackers cannot mass-assign `id`, `createdAt`, `role`, `status` escalation, etc.
4. **Log mutations.** Every admin/client mutation writes a row to `audit_logs` with actor, action, entity, changed fields, IP, user agent.

## Middleware

- `authAny(req, env)` returns an `AuthContext` for any authenticated caller (admin or client) or throws UNAUTHORIZED.
- `authAdmin(req, env)` requires `kind === 'admin'`.
- `authClient(req, env)` requires `kind === 'client'` with a valid `clientId`.
- `requireRole(ctx, 'OWNER'|'ADMIN'|'EDITOR')` enforces role rank (OWNER=3 > ADMIN=2 > EDITOR=1).
- `assertProjectOwnership(env, clientId, projectId)` loads the project and returns 404 if it doesn't exist OR doesn't belong to the client. Used by every child-resource access (milestones, files, messages, invoices).
- `findClientByEmail(env, email)` and `verifyAccessCode(expected, provided)` use constant-time compare for access codes.

## Route protections (Phase 1)

| Route | Auth | Resource checks |
|---|---|---|
| `GET /healthz`, `GET /admin/_ping` | none | — |
| `GET /cms/*` | none | only `isPublished=true` rows returned |
| `POST /leads` | none; IP rate-limit 5/min, validated | — |
| `POST /media/upload` | admin auth, mime+size validated, audit logged | — |
| `GET /files/media/:id` | none if visibility=PUBLIC; admin if PRIVATE | — |
| `GET /files/project/:id` | admin OR client (with ownership) | assertProjectOwnership for clients |
| `POST /assistant/chat`, `/assistant/session` | none; IP rate-limit 25/min | public tools only |
| `POST /assistant/admin` | admin auth; per-uid/IP rate-limit 30/min | ADMIN_TOOLS set (read + draft_reply only) |
| `POST /assistant/client` | client auth; per-uid/IP rate-limit | CLIENT_TOOLS filtered by clientId via authProject() |
| `POST /ai-lab/*` | none; IP rate-limit 10/min | public read-only tools (list_services, search_services, get_pricing) |
| `POST /auth/admin/login`, `/auth/client/login` | none; IP rate-limit | credentials checked constant-time |
| `POST /auth/*/logout`, `GET /auth/me` | any auth | returns identity tied to token |
| `/client/*` | client auth | every route re-asserts project ownership for project-scoped endpoints |
| `/admin/*` | admin auth | CRUD fields whitelisted; DELETE guarded (e.g. client deletion blocked if ACTIVE projects exist) |

## IDOR tests (run these manually before every production deploy)

- Authenticate as Client A; GET `/client/projects/<clientB_project_id>` → must return 404.
- Authenticate as Client A; GET `/client/projects/<clientB_project_id>/milestones` → 404.
- Authenticate as Client A; GET `/files/project/<clientB_file_id>` → 404.
- Send an unauthenticated POST `/media/upload` → 401.
- Send a PUT `/admin/services/:id` with body `{ isPublished: true, id: 'attacker-id' }` → `id` is ignored (whitelist).
- Send a POST `/admin/clients` setting `accessCode: 'AAAAAA'` in the body → accessCode is generated server-side and returned; the body value is ignored.
- Send a forged Bearer token to `/client/projects` → 401.
- Send an expired Bearer token → 401.
- DEV_MODE off: send `X-TT-Client-Demo: 1` → 401.
- DEV_MODE off: send default password in `X-TT-Admin-Password` → 401.

## Future enhancements
- Role-based granularity (EDITOR cannot delete clients; OWNER can manage admin users). Schema already has `role` column.
- Session revocation list (KV/DB) for logout-before-expiry. With short TTLs this is low priority.
- CSRF tokens: unnecessary while auth is via Authorization header (not cookies), revisit if we switch to httpOnly cookies.
