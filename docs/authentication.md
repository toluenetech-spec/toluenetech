# Authentication

Authentication is server-verified. The browser is never trusted to state who the user is.

## Mechanisms

### 1. Internal session JWT (preferred, Phase 1+)
- Issued by `POST /auth/admin/login { password }` and `POST /auth/client/login { email, accessCode }`.
- Signed HMAC-SHA256 with `JWT_SECRET` (Worker secret). If `JWT_SECRET` is not set in DEV_MODE an ephemeral key is used; **production must set `JWT_SECRET`** or sessions will reset on cold start.
- Payload: `{ sub, email?, name?, kind: 'admin'|'client', role?, clientId?, iat, exp, sid }`.
- TTLs: admin = 8 hours, client = 7 days.
- Transported in `Authorization: Bearer <token>`. Not stored in cookies.

### 2. Firebase ID token (bridge)
- Accepted in `Authorization: Bearer` for both admin and client.
- RSASSA-PKCS1-v1_5 signature verified against Google's `securetoken@system.gserviceaccount.com` X.509 certs (cached, respecting `Cache-Control: max-age`).
- Validates `exp`, `iat`, `aud` == FIREBASE_PROJECT_ID, `iss` == `https://securetoken.google.com/<pid>`, `sub` non-empty.
- Admin: uid must exist in `admin_users.uid`. Client: uid must match `clients.user_id` AND `clients.status = 'ACTIVE'`.

### 3. Legacy admin password header (DEV_MODE only in production; backward compat)
- `X-TT-Admin-Password: <ADMIN_PASSWORD>`.
- The hardcoded default `iloveesther221@@` is ONLY accepted when `DEV_MODE=true`. In production, `ADMIN_PASSWORD` must be set as a Worker secret and the default is rejected.
- All endpoints accept this header alongside Bearer tokens during the transition; clients use session JWTs after login.

### 4. Demo client shortcut (DEV_MODE only)
- `X-TT-Client-Demo: 1` bootstraps and returns the demo client session. It is accepted only when `DEV_MODE=true` AND the client `client-demo` exists (auto-created on first request).
- **Production must set `DEV_MODE=false` (or unset it).** No demo auth is possible in production.

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/admin/login` | `{ password }` | `{ token, expiresIn, user }` |
| POST | `/auth/admin/logout` | — | `{ ok }` (fire-and-forget audit; client discards token) |
| POST | `/auth/client/login` | `{ email, accessCode }` | `{ token, expiresIn, client }` |
| POST | `/auth/client/logout` | — | `{ ok }` |
| GET | `/auth/me` | — | `{ kind, uid/email/name/role }` for whichever token is presented |

## Secrets

- **Required in production:** `JWT_SECRET`, `DATABASE_URL`, `ADMIN_PASSWORD`, `AI_API_KEY` (if AI enabled), `FIREBASE_PROJECT_ID` (if Firebase Auth used).
- **Server-side only:** all of the above. The browser never sees them. The only secret ever in the browser bundle is the Firebase client `apiKey` (which is by design public for client SDK use).
- `.dev.vars.example` is the template; never commit `.dev.vars`. Production secrets set via `wrangler secret put NAME`.

## Rate limiting (auth)
- `POST /auth/admin/login`: 10 attempts / IP / minute.
- `POST /auth/client/login`: 15 attempts / IP / minute.
- Rate limiter is per Worker isolate in memory (documented limitation; replace with Upstash/KV in later phase for cross-isolate accuracy).

## What was removed
- Client-side password validation (`context/AuthContext.tsx` had a hardcoded password constant — now calls the server).
- Client-side client access-code check (`context/ClientAuthContext.tsx` verified email+code against Firebase DataContext — now calls POST /auth/client/login for a JWT).
- Structural-but-unsigned JWT acceptance: Firebase JWTs now require a valid RSA signature (previously TODO).
