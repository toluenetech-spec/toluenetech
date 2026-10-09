#!/usr/bin/env node
/**
 * Apply server/drizzle/*.sql migrations against Neon in order, idempotently.
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host/db node scripts/migrate.mjs
 *
 * Safe to re-run: tracks applied migrations in __migrations; tolerates
 * "already exists" errors from IF NOT EXISTS guards. Uses a TCP (pg) client
 * so it works from any Node environment (including the `psql`-free sandbox).
 */
const { Client } = require('pg');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const migrationsDir = join(__dirname, '..', 'drizzle');
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL env var is required.');
  process.exit(1);
}

(async () => {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: true },
  });
  await client.connect().catch((err) => {
    console.error('Could not connect to Neon:', err.message);
    process.exit(2);
  });
  console.log('Connected to Neon.');

  await client.query(`
    CREATE TABLE IF NOT EXISTS __migrations (
      tag text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);

  const { rows } = await client.query('SELECT tag FROM __migrations');
  const applied = new Set(rows.map((r) => r.tag));

  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();

  let newlyApplied = 0;
  for (const f of files) {
    const tag = f.replace(/\.sql$/, '');
    if (applied.has(tag)) { console.log(`SKIP ${tag}`); continue; }
    process.stdout.write(`APPLY ${tag} ... `);
    let sql = readFileSync(join(migrationsDir, f), 'utf8');
    sql = sql.replace(/^\s*BEGIN;?\s*$/im, '').replace(/^\s*COMMIT;?\s*$/im, '');
    try {
      await client.query(sql);
      await client.query('INSERT INTO __migrations (tag) VALUES ($1)', [tag]);
      console.log('OK');
      newlyApplied++;
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (/already exists|duplicate (object|column|relation|index|constraint)|multiple primary keys|cannot add multiple primary keys/i.test(msg)) {
        console.log('OK (safe duplicate: ' + msg.slice(0, 100).replace(/\s+/g, ' ') + ')');
        await client.query('INSERT INTO __migrations (tag) VALUES ($1) ON CONFLICT DO NOTHING', [tag]);
        newlyApplied++;
      } else {
        console.log('FAILED');
        console.error('\nFailing migration:', tag);
        console.error('Error:', msg);
        console.error('\nFirst 600 chars of migration:\n' + sql.slice(0, 600));
        await client.end();
        process.exit(3);
      }
    }
  }

  const { rows: tables } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name`);
  console.log(`\nDone. Applied ${newlyApplied} new migration(s).`);
  console.log('Public tables (' + tables.length + '):');
  for (const t of tables) console.log('  - ' + t.table_name);

  const expected = ['clients','client_projects','milestones','tasks','project_files','messages','invoices','invoice_items','payments','milestone_approvals','notifications','leads','services','projects','faqs','testimonials','site_settings','assistant_sessions','assistant_messages','lab_items'];
  const names = new Set(tables.map((t) => t.table_name));
  const missing = expected.filter((n) => !names.has(n));
  if (missing.length) console.log('\nMissing expected tables:', missing.join(', '));
  else console.log('\n✓ All expected tables present.');

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
