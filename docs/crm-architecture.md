# CRM Architecture

Neon-backed CRM: leads, lead_notes (activity timeline), clients, client_projects, milestones. Admin JWT-protected; client JWT-protected with strict ownership enforcement.

## Tables

- `leads`: contact (name/email/phone/company), project (services[]/requirements/budget/timeline), attribution (source/sourcePage/aiRef/assignedTo), state (status/followUpDate/lastContactedAt/convertedClientId/convertedAt), free-text legacy notes.
- `lead_notes`: append-only timeline entries (authorType admin|client|ai|system; type note|status_change|email|sms|ai_summary; body; meta).
- `clients`: name/email (unique, lowercase)/phone/company, accessCode (auto-generated, regeneratable), lastLoginAt, status (ACTIVE|INACTIVE).
- `client_projects`: clientId/publicProjectId (optional link to portfolio)/title/description/status/progress/startDate/dueDate.
- `milestones`: projectId/title/description/dueDate/status(PENDING|IN_PROGRESS|COMPLETED|APPROVED)/order.

## Lead list

`GET /admin/leads` supports q (name/email/company/ref), status, source, assigned (=me|<uid>), page, limit (max 100). Returns `{ items, total, page, limit, totalPages }`.

## Lead creation entry points

| Source | Endpoint | Notes |
|---|---|---|
| Public form | POST /leads | rate-limited, honeypot, dedupe |
| Tolesh (create_lead) | internal ai tool | sets source=assistant, sourcePage=/assistant, aiRef=sessionId, writes AI note, dedupes |
| Admin UI | POST /admin/leads | manual entry, source defaults to `manual` |

## Lead → Client conversion

`POST /admin/leads/:id/convert`. Safe matching: exact case-insensitive email only — never auto-merge on name/company/phone. Creates a new client with auto-generated accessCode OR links to an existing one. Sets lead status=WON, convertedClientId, convertedAt. Writes a system note and LEAD_CONVERT audit.

## Client management

List/search clients, get client + projects, create (name+email required; duplicate email rejected), update (whitelisted fields), regenerate accessCode, delete (RESTRICT if ACTIVE projects exist). Access codes are never returned by list endpoints.

## Client portal security

Every `/client/projects/:id/*` endpoint calls `assertProjectOwnership(clientId, projectId)` which returns 404 if the project doesn't exist OR if its clientId doesn't match the JWT's clientId. ClientId is never taken from request body/query for authorization.
