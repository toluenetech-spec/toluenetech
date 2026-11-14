# Lead Lifecycle

## States

`NEW → CONTACTED → QUALIFIED → DISCOVERY → PROPOSAL → NEGOTIATION → WON` (or `LOST` / `ARCHIVED` from any state). ARCHIVED is the soft-delete terminal state (rows preserved for audit).

| State | Meaning | Entry action |
|---|---|---|
| NEW | Freshly submitted | TT-XXXX ref auto-generated; optional AI note if created by Tolesh |
| CONTACTED | First outreach made | `lastContactedAt` set automatically |
| QUALIFIED | Fit confirmed | Status note logged |
| DISCOVERY | Scoping in progress | — |
| PROPOSAL | Proposal sent | — |
| NEGOTIATION | Contract / pricing discussion | — |
| WON | Closed-won; converted to client | Triggered only via `/convert` → sets convertedClientId + convertedAt; creates/links Client |
| LOST | Closed-lost | Status note logged |
| ARCHIVED | Soft-deleted | Triggered by UI Delete; no row removal |

Transitions go through `PATCH /admin/leads/:id/status` which validates the new status is in the enum, applies the update, and appends a `lead_notes` row of type `status_change` authored by the acting admin. Previous status is recorded in `meta.from`, new status in `meta.to`.

## Attribution

- `source`: `contact|service|portfolio|assistant|ai-lab|whatsapp|direct|referral|other|unknown|website-form|manual|spam`. Public form coerces unrecognised values to `unknown` (never fabricated).
- `sourcePage`: URL path the lead came from (e.g. `/start-project`, `/services/ai-integration`).
- `aiRef`: assistant session id when lead originated from Tolesh.
- `assignedTo`: admin uid.

## Activity timeline (`lead_notes`)

Created on every status change, every admin note, every AI summary, and on conversion. `GET /admin/leads/:id/notes` returns them newest first.

## Retention

"Delete" performs a soft archive. Hard deletion is not exposed.
