# API Architecture

## Response envelope

Every endpoint returns JSON.

### Success
```json
{ "success": true, "data": { ... } }
```
For legacy list endpoints (CRUD lists, stats, AI config, models, status, conversations), the previous `{ items, total }` shape is preserved at the top level (not wrapped in `data`) to avoid breaking the existing Admin UI during transition. New endpoints (auth, client, files, /leads response) use the envelope.

### Error
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Name is required.", "details": { "field": "name" } } }
```
- `code` is a stable `ErrorCode` from `lib/errors.ts` (e.g. `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`).
- `message` is safe to display to users.
- `details` is present on validation errors (field-level).
- Internal errors (SQL, stack traces, upstream model errors) are NEVER returned to clients; they are logged server-side via `logError()` with request metadata.

## HTTP status mapping

| Status | Used for |
|---|---|
| 200 | Success |
| 201 | Created |
| 204 | OPTIONS preflight |
| 400 | Bad request / invalid JSON |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but insufficient role/access |
| 404 | Resource not found (or not visible to caller — IDOR safe) |
| 409 | Conflict (duplicate email, active-projects-on-delete) |
| 413 | Payload too large |
| 415 | Unsupported media type |
| 429 | Rate limited |
| 500 | Internal error (logged; generic message to client) |
| 502 | Upstream AI failure |
| 503 | Service not configured (e.g. AI provider missing) |

## Middleware

Every authenticated route follows the same chain:
```
authenticate (authAdmin/authClient/authAny)
  → authorize (role/ownership)
  → validate (body/query with lib/validate or explicit checks)
  → business logic (DB, R2, AI, fetch)
  → response (success envelope / ApiError)
```

No handler reads authentication from body parameters. No handler returns raw DB errors.

## Pagination

List endpoints accept `?q=&published=&status=&source=&clientId=&limit=` and return `{ items, total }`. `limit` is capped server-side (currently 500) to prevent scraping.

## Auditing

Mutations call `writeAudit(env, { action, entity, entityId, auth, req, meta })`. The write is non-blocking; errors are caught and console-logged so that audit failures never break the user response. The `meta` object is scrubbed via `sanitizeMeta()` which redacts any field whose name matches `/password|token|secret|apikey|authorization|cookie|jwt/i`.

## Rate limits (current)

| Route | Key | Window | Max |
|---|---|---|---|
| POST /leads | `lead:<ip>` | 60s | 5 |
| POST /assistant/chat | `chat:<ip>` | 60s | 25 |
| POST /assistant/admin | `admin-chat:<uid>:<ip>` | 60s | 30 |
| POST /assistant/client | `client-chat:<uid>:<ip>` | 60s | 30 |
| POST /ai-lab/* | `lab:<kind>:<ip>` | 60s | 10 |
| POST /auth/admin/login | `admin-login:<ip>` | 60s | 10 |
| POST /auth/client/login | `client-login:<ip>` | 60s | 15 |

Limitation: in-memory per Worker isolate. Not globally coordinated. Upgrade to Upstash Redis or Cloudflare KV counters before a launch with heavy adversarial traffic.
