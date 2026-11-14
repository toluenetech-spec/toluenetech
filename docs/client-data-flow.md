# Client Data Flow

Client portal: login (email + accessCode) → JWT → own-data-only endpoints.

## Auth

`POST /auth/client/login` with email + accessCode → short-lived JWT containing `{ clientId, uid, email }`. Access codes generated/rotated in Admin (6-char; shown once at creation). No passwords stored.

## Data flow

```
Admin creates client (Neon.clients) + accessCode
Admin creates client_projects (clientId = client.id)
Client logs in → JWT
  GET /client/me        → clients WHERE id = JWT.clientId
  GET /client/projects  → client_projects WHERE clientId = JWT.clientId
  GET /client/projects/:id (assertProjectOwnership checks clientId)
  GET /client/projects/:id/milestones → milestones WHERE projectId = <owned>
  GET /client/projects/:id/files      → project_files WHERE projectId = <owned>
  GET /client/projects/:id/messages   → messages WHERE contextType=PROJECT AND contextId=<owned>
  GET /client/invoices                → invoices WHERE clientId = JWT.clientId
  GET /client/notifications           → notifications WHERE clientId = JWT.clientId
```

## Ownership enforcement (IDOR protection)

- `authClient()` extracts clientId from JWT.
- Every project-scoped endpoint calls `assertProjectOwnership(env, clientId, projectId)` — looks up project by id and verifies its clientId matches the token. Returns 404 on any mismatch or missing project.
- Queries for invoices and notifications filter directly by JWT clientId.
- ClientId/projectId from the request body is NEVER used for authorization.

## Public portfolio vs private client projects

Two tables, never joined in public endpoints:

- `projects` — public portfolio, visible when `isPublished`. Contains NO private client data; clientName only shown if `hasClientPermission`.
- `client_projects` — private client work, NEVER exposed publicly. Optionally linked via `publicProjectId` to a portfolio record.

`/cms/projects` queries `projects` only. `/client/projects` queries `client_projects` only. Public Tolesh only sees `projects`.

## Phase 3 scope

Implemented foundation: auth, own-data reads for projects/milestones/files/messages/invoices/notifications. Client-sent messages, uploads, milestone approvals, and invoice payment flows are deferred to later phases.
