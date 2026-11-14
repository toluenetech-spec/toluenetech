# Neon Staging — Chunked SQL (mobile-friendly)

Two of the chunks had bugs that caused the rollback you saw. I've fixed both and
pushed a new commit (`b6a7e89`). Start over — **reset first, then re-run** all
chunks in order.

## Order (each is its own transaction; paste → Run → wait for green Success)

0. **00-reset.sql** — ONLY if previous chunks partially created tables/types.
   Wipes the public schema so migrations start clean. Skip if your DB is empty.
1. **00-init.sql** — creates `__migrations` tracker.
2. **01-0000_bouncy_warbound.sql** — 22 tables + enums.
3. **02-0001_tearful_millenium_guard.sql** — audit logs, ai_usage, extra columns/indexes.
4. **03-0002_foreign_keys_manual.sql** — foreign keys.
5. **04-0003_phase2_cms_crm.sql** — solutions/tools/lead_notes/page_views + ARCHIVED status.
6. **05-0004_phase4_operations.sql** — milestone approvals / invoice items / payments.
7. **06-seed.sql** — default site_settings.

## What was wrong before

- Chunk 04 had `ALTER TABLE leads ADD COLUMN IF NOT EXISTS IF NOT EXISTS …`
  (double "IF NOT EXISTS" from my regex) → syntax error → rollback. Fixed.
- Earlier chunk 01 potentially failed on a table-create order dependency.
  Regenerated with proper topological ordering and verified every chunk has
  matching BEGIN/COMMIT and balanced `$$` blocks.

## After all chunks succeed, run this verification query:

```sql
SELECT count(*) AS tables FROM information_schema.tables
 WHERE table_schema='public' AND table_type='BASE TABLE';
-- expect ~33 (including __migrations)
SELECT tag FROM __migrations ORDER BY tag;
-- expect 5 rows: 0000 through 0004
```

If any chunk errors, stop and send me the full error text (scroll up in the
editor, there's usually a red detail line above the ROLLBACK message).
