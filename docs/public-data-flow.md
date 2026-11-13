# Public Data Flow

```
Browser (React) → lib/cms.ts (60s in-memory cache)
                → Cloudflare Worker (/cms/*)
                → Neon (published-only rows + cache headers)
```

## Lead capture
Contact / Start Project / Tolesh → `lib/api.submitLead(...)` → `POST /leads` (rate-limited 5/min/IP, honeypot, source whitelist with UNKNOWN default, sourcePage/aiRef captured, 24-hour email dedupe) → Neon `leads` (status=NEW).

## Page-by-page status

| Page | Data | API | Status |
|---|---|---|---|
| Home | services, projects, testimonials, hero/settings | `/cms/services`, `/cms/projects?limit=6`, `/cms/testimonials`, `/cms/site` | COMPLETE |
| Services | services, social | `/cms/services`, `/cms/site` | COMPLETE |
| Service Detail | service, related projects | `/cms/services/:slug`, `/cms/projects` | COMPLETE |
| Solutions | solutions | `/cms/solutions` | COMPLETE |
| Portfolio | projects (paginated) | `/cms/projects` | COMPLETE |
| Project Detail | project, testimonials | `/cms/projects/:slug`, `/cms/testimonials` | COMPLETE |
| Products | products | `/cms/products` | COMPLETE |
| Technology | tools | `/cms/tools` | COMPLETE |
| Pricing | pricing plans, social | `/cms/pricing`, `/cms/site` | COMPLETE |
| FAQ | faqs | `/cms/faqs` | COMPLETE |
| Testimonials | testimonials | `/cms/testimonials` | COMPLETE |
| Insights | insights (paginated) | `/cms/insights` | COMPLETE |
| Insight Detail | insight | `/cms/insights/:slug` | COMPLETE |
| About | founder/social | `/cms/site` | COMPLETE |
| Contact | social/contact/availability | `/cms/site` | COMPLETE |
| Start Project | services; POST lead | `/cms/services`, POST `/leads` | COMPLETE |
| Estimate | services; POST lead | `/cms/services`, POST `/leads` | COMPLETE |
| Downloads | asset URLs | `/cms/site` (brand) | PARTIAL |
| Labs | lab items | *not migrated in Phase 2* | NOT STARTED |

## Tolesh public
RAG over services / projects / faqs / pricing / testimonials / insights with published-only filters (`retrieval/index.ts → retrievePublic()`). Pricing answers are drawn from `pricing_plans` verbatim (never invented).
