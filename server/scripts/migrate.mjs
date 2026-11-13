#!/usr/bin/env node
/**
 * Apply server/drizzle/*.sql migrations against Neon in order, idempotently.
 *
 * Uses a custom undici Agent that forces IPv4 TCP connections (family: 4) and
 * passes TLS SNI correctly. This bypasses Node's broken default dual-stack
 * DNS resolution on networks where IPv6 is advertised but unreachable.
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from 'undici';
import tls from 'node:tls';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'drizzle');
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL env var is required.'); process.exit(1); }

function clean(u) { return u.replace(/[?&](sslmode|channel_binding|uselibpqcompat)=[^&]*/g, ''); }

function buildAgent() {
  // Custom connect: open a TCP socket forced to IPv4 (family:4), then upgrade
  // to TLS with proper SNI based on the real hostname (not the IP).
  return new Agent({
    connect: (opts, cb) => {
      const { hostname } = opts;
      const socket = net.connect({ host: hostname, port: opts.port || 443, family: 4 });
      socket.on('connect', () => {
        const tlsSocket = tls.connect({
          socket,
          servername: hostname,
          ALPNProtocols: ['h2', 'http/1.1'],
          ca: opts.ca,
          rejectUnauthorized: true,
        });
        cb(null, tlsSocket);
      });
      socket.on('error', (err) => cb(err));
    },
  });
}

async function connect(rawUrl) {
  const urlStr = clean(rawUrl).replace(/-pooler(\.c-)/, '$1'); // prefer non-pooler (HTTP)
  const fetchAgent = buildAgent();
  const fetchFn = (u, init) => fetch(u, { ...init, dispatcher: fetchAgent });
  const q = neon(urlStr, { fetchFunction: fetchFn });
  await q`SELECT 1 AS ok`;
  return q;
}

function splitStatements(body) {
  const out = [];
  let buf = '', inDollar = false;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('$$', i)) { inDollar = !inDollar; buf += '$$'; i++; continue; }
    if (body[i] === ';' && !inDollar) {
      const s = buf.trim();
      if (s) out.push(s);
      buf = '';
      continue;
    }
    buf += body[i];
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

(async () => {
  console.log('Connecting to Neon (forced IPv4 TLS, non-pooler HTTPS)...');
  const sql = await connect(dbUrl);
  console.log('Connected.');

  await sql`CREATE TABLE IF NOT EXISTS __migrations (
    tag text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const rows = await sql`SELECT tag FROM __migrations`;
  const applied = new Set(rows.map(r => r.tag));
  const files = readdirSync(migrationsDir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();

  let newlyApplied = 0;
  for (const f of files) {
    const tag = f.replace(/\.sql$/, '');
    if (applied.has(tag)) { console.log(`SKIP ${tag}`); continue; }
    process.stdout.write(`APPLY ${tag} ... `);
    let body = readFileSync(join(migrationsDir, f), 'utf8')
      .replace(/^\s*BEGIN;?\s*$/im, '')
      .replace(/^\s*COMMIT;?\s*$/im, '');
    const stmts = splitStatements(body);
    for (const s of stmts) {
      if (!s) continue;
      try { await sql(s); }
      catch (e) {
        const msg = String(e?.message || e);
        if (/already exists|duplicate (object|column|relation|index|constraint|table)|multiple primary keys|relation .* already exists/i.test(msg)) continue;
        console.log('FAILED');
        console.error('Statement:', s.slice(0, 400));
        console.error('Error:', msg);
        process.exit(3);
      }
    }
    await sql`INSERT INTO __migrations (tag) VALUES (${tag}) ON CONFLICT DO NOTHING`;
    console.log('OK');
    newlyApplied++;
  }

  const tables = await sql`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`;
  console.log(`\nDone. Applied ${newlyApplied} new migration(s).`);
  console.log('Public tables (' + tables.length + '):');
  for (const t of tables) console.log('  - ' + t.table_name);

  const expected = ['clients','client_projects','milestones','tasks','project_files','messages','invoices','invoice_items','payments','milestone_approvals','notifications','leads','services','projects','faqs','testimonials','site_settings','assistant_sessions','assistant_messages','lab_items','ai_usage','audit_logs','solutions','tools','page_views','lead_notes','pricing_plans','products','media','insights'];
  const names = new Set(tables.map(t => t.table_name));
  const missing = expected.filter(n => !names.has(n));
  if (missing.length) console.log('\nMissing expected tables:', missing.join(', '));
  else console.log('\n✓ All expected tables present.');
})().catch(e => { console.error(e); process.exit(1); });
