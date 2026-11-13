# Staging Deploy — Neon + Cloudflare Workers

This document walks through applying migrations, migrating Firestore data, and
deploying the Worker to the staging environment. Run these commands from the
`server/` directory. Secrets are set via `wrangler secret put` and never touch
git.

## Prerequisites

- Node 20+ installed locally.
- Cloudflare account (account id in `wrangler.toml`: `5ba6343e7dbce7708785cffe6d9e55ae`).
- A Neon project and its pooled Postgres connection string
  (`postgres://user:pass@ep-xxx-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require`).
- A Firebase Admin service account JSON (Project settings → Service accounts →
  Generate new private key). This is needed to verify client JWTs in the
  Worker and to run the Firestore → Neon migration.

## 1. Apply migrations to Neon

The bundled `drizzle-kit migrate` command requires every migration to be
journaled in `drizzle/meta/_journal.json` (already fixed on this branch).
Because Neon uses HTTP/WebSocket and we want idempotent tracking, use the
bundled Node migration script instead:

```bash
cd server
DATABASE_URL="postgres://USER:PASS@ep-XXX-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  npm run db:migrate:neon
```

The script:

1. Creates a `__migrations` tracker table if it doesn't exist.
2. Applies `server/drizzle/0000_*.sql` through `0004_*.sql` in order.
3. Skips already-applied migrations.
4. Tolerates `IF NOT EXISTS` duplicate-object errors so re-runs are safe.
5. Prints the resulting public table list and confirms expected tables exist.

## 2. Seed minimal defaults (safe, idempotent)

```bash
DATABASE_URL="postgres://…" npm run db:seed
```

Inserts `site_settings.site` with company/hero/SEO defaults if empty. Does
not overwrite existing records.

## 3. Migrate Firestore → Neon

Run this on a machine with direct network access to Neon (i.e. your laptop —
CI/Arena sandboxes may block outbound Neon traffic):

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-service-account.json \
DATABASE_URL="postgres://…" \
  npm run db:migrate:firestore
```

Add `-- --dry-run` after to preview without writing. Collections covered:
services, solutions, projects, products, labItems, testimonials, faqs,
insights, pricingPlans, tools, leads, clients, clientProjects, milestones,
tasks, messages, siteSettings. Binary assets (R2/Firebase Storage) are **not**
migrated by this script — upload those to R2 separately through the admin
Media uploader.

The script upserts on primary key and is safe to re-run. It does **not**
delete Neon records that Firestore no longer contains.

## 4. Set Worker secrets

Run each of these; `wrangler` will prompt for the value:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET                 # openssl rand -hex 32
npx wrangler secret put ADMIN_PASSWORD             # choose a strong staging password
npx wrangler secret put AI_PROVIDER                # e.g. dahl / openai / deepseek
npx wrangler secret put AI_API_KEY
npx wrangler secret put FIREBASE_PROJECT_ID
# paste the Firebase service-account JSON verbatim when prompted:
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
npx wrangler secret put FLW_PUBLIC_KEY
npx wrangler secret put FLW_SECRET_KEY
npx wrangler secret put FLW_SECRET_HASH            # webhook signature from Flutterwave dashboard
# R2 signed-URL signing credentials (optional; required for client file downloads):
npx wrangler secret put R2_ENDPOINT
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_BUCKET_NAME
```

`ASSISTANT_SECRET` and `CORS_ORIGIN` and `R2_PUBLIC_URL` are plain
`[vars]` in `wrangler.toml`.

## 5. Deploy

```bash
npm run deploy
```

The Worker binds to the staging Neon database through the `DATABASE_URL`
secret. Smoke check after deploy:

```bash
curl -i https://toluene-tech-api.<your-subdomain>.workers.dev/healthz
```

## 6. Smoke-test the critical chains

1. Open `https://<deployed-worker>/admin/login` with `ADMIN_PASSWORD` —
   confirm the admin shell loads and lists clients/projects.
2. Open the Client Portal at `https://<app>/portal/login`, log in as a
   migrated client (or create a new client from `/admin/clients` first),
   confirm dashboard, milestones, files, messages, and invoices load.
3. Create an invoice, hit "Pay invoice" — should show Flutterwave inline
   checkout when `FLW_PUBLIC_KEY` is set, or a clear "not configured"
   message otherwise.
4. Post a message from admin → confirm it appears in the portal, and vice
   versa.

## 7. Rollback

If a migration needs to be rolled back, there is no automatic rollback —
drop the Neon database and restore from a Neon snapshot taken before step 1,
then re-run migrations from that point.
