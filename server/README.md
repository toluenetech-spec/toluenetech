# Toluene Tech API (Cloudflare Worker + Neon Postgres + R2)

Edge backend for Toluene Tech V2.

## Stack
- **Hono** — web framework
- **Cloudflare Workers** — edge runtime
- **Cloudflare R2** — asset/media storage
- **Neon** — serverless Postgres
- **Drizzle ORM** — typesafe SQL + migrations
- **Pluggable AI** — OpenAI / Anthropic / Gemini adapter, selected via `AI_PROVIDER`

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness + DB/AI status |
| GET | `/cms/services`, `/cms/services/:slug` | Public services |
| GET | `/cms/projects`, `/cms/projects/:slug` | Public portfolio |
| GET | `/cms/faqs` | FAQs |
| GET | `/cms/pricing` | Pricing plans |
| GET | `/cms/testimonials` | Testimonials |
| GET | `/assistant/session` | Issue anonymous session id |
| POST | `/assistant/chat` | Public AI assistant (rate-limited, RAG-grounded, lead-capture) |

Admin/Private routes (Media upload signed URLs, CRM writes, Portal messages) come in later phases.

## Setup
1. `cp .dev.vars.example .dev.vars` and fill in secrets.
2. `npm run api:dev` — starts wrangler on http://localhost:8787 (frontend Vite dev server proxies `/api` to it).
3. `npm run db:generate` — generate SQL migrations from `src/db/schema.ts`.
4. `npm run db:migrate` — apply migrations to Neon.
5. `npm run api:deploy` — publish the Worker to Cloudflare.

## Safety rules enforced in code
- No AI key is ever sent to the browser (only the Worker reads `AI_API_KEY`).
- Assistant grounded strictly on published CMS rows; system prompt forbids fabrication.
- Per-IP rate limit (15 req/min) on `/assistant/chat`.
- Input capped at 1000 chars, control characters stripped.
- Upload mime+size whitelist enforced before anything hits R2.
