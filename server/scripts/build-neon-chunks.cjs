#!/usr/bin/env node
/**
 * Build neon-chunks/00..06.sql from the migration source files.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'drizzle');
const OUT = path.join(__dirname, '..', 'drizzle', 'neon-chunks');
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();

function transform(sql) {
  sql = sql
    .replace(/^\s*BEGIN;?\s*$/gim, '')
    .replace(/^\s*COMMIT;?\s*$/gim, '')
    .replace(/--> statement-breakpoint/g, '');

  // Guard CREATE TYPE (skip statements already wrapped in DO $$ BEGIN … END $$,
  // e.g. from 0004_phase4_operations.sql). Negative-lookbehind won't work across
  // multi-line input so we detect & skip inline with a two-pass approach.
  // First, collapse any existing DO $$ BEGIN CREATE TYPE … END $$; blocks by
  // replacing the inner CREATE TYPE marker with a placeholder, apply guard to
  // any remaining bare CREATE TYPE, then restore.
  sql = sql.replace(
    /DO \$\$ BEGIN\s+CREATE TYPE\s+(\w+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);\s+EXCEPTION WHEN duplicate_object THEN NULL;\s+END \$\$;/g,
    (_, name, body) => `__KEEP_DO_TYPE_${name}__${body.trim()}__KEEP_END__`
  );
  sql = sql.replace(
    /CREATE TYPE\s+(?:"public"\.)?"?(\w+)"?\s+AS\s+ENUM\s*\(([\s\S]*?)\);/g,
    (_, name, body) => `DO $$ BEGIN CREATE TYPE ${name} AS ENUM(${body.trim()}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  );
  sql = sql.replace(
    /__KEEP_DO_TYPE_(\w+)__([\s\S]*?)__KEEP_END__/g,
    (_, name, body) => `DO $$ BEGIN CREATE TYPE ${name} AS ENUM(${body.trim()}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  );

  // CREATE TABLE -> IF NOT EXISTS
  sql = sql.replace(/CREATE TABLE\s+"(\w+)"\s*\(/g, 'CREATE TABLE IF NOT EXISTS "$1" (');
  sql = sql.replace(/CREATE TABLE\s+(\w+)\s*\(/g, 'CREATE TABLE IF NOT EXISTS $1 (');

  // ADD COLUMN -> IF NOT EXISTS (avoid double)
  sql = sql.replace(
    /ALTER TABLE\s+"(\w+)"\s+ADD COLUMN\s+(?!IF NOT EXISTS\s+)"(\w+)"\s+([^;]+);/g,
    'ALTER TABLE "$1" ADD COLUMN IF NOT EXISTS "$2" $3;\n'
  );
  sql = sql.replace(
    /ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(?!IF NOT EXISTS\s+)(\w+)\s+([^;]+);/g,
    'ALTER TABLE $1 ADD COLUMN IF NOT EXISTS $2 $3;\n'
  );

  // Guard ADD CONSTRAINT (ensure space before UNIQUE/FOREIGN/CHECK)
  sql = sql.replace(
    /ALTER TABLE\s+"(\w+)"\s+ADD CONSTRAINT\s+"(\w+)"([\s\S]*?);/g,
    (_, tbl, con, rest) => {
      const body = rest.replace(/^\s+/, ' ').replace(/\s*$/, '');
      return `DO $$ BEGIN ALTER TABLE "${tbl}" ADD CONSTRAINT "${con}" ${body.trim()}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`;
    }
  );
  sql = sql.replace(
    /ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+(\w+)([\s\S]*?);/g,
    (_, tbl, con, rest) => {
      const body = rest.replace(/^\s+/, ' ').replace(/\s*$/, '');
      return `DO $$ BEGIN ALTER TABLE ${tbl} ADD CONSTRAINT ${con} ${body.trim()}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`;
    }
  );

  // Guard CREATE INDEX
  sql = sql.replace(
    /CREATE (UNIQUE )?INDEX\s+"(\w+)"\s+([\s\S]*?);/g,
    (_, uniq, name, rest) => {
      if (/IF NOT EXISTS/i.test(rest)) return `CREATE ${uniq || ''}INDEX "${name}" ${rest.trim()};\n`;
      return `DO $$ BEGIN CREATE ${uniq || ''}INDEX "${name}" ${rest.trim()}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`;
    }
  );
  sql = sql.replace(
    /CREATE (UNIQUE )?INDEX\s+(\w+)\s+([\s\S]*?);/g,
    (_, uniq, name, rest) => {
      if (/IF NOT EXISTS/i.test(rest)) return `CREATE ${uniq || ''}INDEX ${name} ${rest.trim()};\n`;
      return `DO $$ BEGIN CREATE ${uniq || ''}INDEX ${name} ${rest.trim()}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`;
    }
  );

  return sql;
}

function splitStatements(sql) {
  // Strip full-line comments to avoid their content confusing splits, then
  // split on ; that are not inside $$ ... $$.
  const lines = sql.split('\n').filter(l => !/^\s*--/.test(l));
  sql = lines.join('\n');

  const out = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < sql.length; i++) {
    if (sql.startsWith('$$', i)) { inDollar = !inDollar; buf += '$$'; i++; continue; }
    if (sql[i] === ';' && !inDollar) {
      const s = buf.trim() + ';';
      if (s.replace(/;$/, '').trim().length > 0) out.push(s);
      buf = '';
      continue;
    }
    buf += sql[i];
  }
  const tail = buf.trim();
  if (tail) out.push(tail + (tail.endsWith(';') ? '' : ';'));
  return out;
}

function getCreateTableName(s) {
  const m = s.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?(\w+)"?\s*\(/i);
  return m ? m[1] : null;
}
function getCreateTableRefs(s) {
  const refs = new Set();
  const re = /REFERENCES\s+"?(\w+)"?\s*\(/g;
  let m;
  while ((m = re.exec(s))) refs.add(m[1]);
  return [...refs];
}

function topoSortChunk01(stmts) {
  // Split into three buckets: CREATE TYPE (must come first, since tables use them),
  // CREATE TABLE (topo-sorted by inline REFERENCES), and everything else (indexes etc.)
  const types = [];
  const tables = [];
  const others = [];
  for (const s of stmts) {
    if (/^DO \$\$ BEGIN CREATE TYPE\b/i.test(s) || /^CREATE TYPE\b/i.test(s)) types.push(s);
    else {
      const n = getCreateTableName(s);
      if (n) tables.push({ name: n, stmt: s, refs: getCreateTableRefs(s) });
      else others.push(s);
    }
  }
  const byName = new Map(tables.map(t => [t.name, t]));
  const indeg = new Map();
  const rev = new Map();
  for (const t of tables) {
    indeg.set(t.name, 0);
  }
  for (const t of tables) {
    for (const r of t.refs) {
      if (!byName.has(r) || r === t.name) continue;
      indeg.set(t.name, (indeg.get(t.name) || 0) + 1);
      if (!rev.has(r)) rev.set(r, []);
      rev.get(r).push(t.name);
    }
  }
  const q = tables.filter(t => (indeg.get(t.name) || 0) === 0).map(t => t.name);
  const ordered = [];
  while (q.length) {
    const n = q.shift();
    const t = byName.get(n);
    ordered.push(t.stmt);
    for (const child of (rev.get(n) || [])) {
      indeg.set(child, indeg.get(child) - 1);
      if (indeg.get(child) === 0) q.push(child);
    }
  }
  for (const t of tables) if (!ordered.includes(t.stmt)) ordered.push(t.stmt);
  return [...types, ...ordered, ...others];
}

function topoSortCreateTables(stmts) {
  return topoSortChunk01(stmts);
}

// 00-reset
fs.writeFileSync(path.join(OUT, '00-reset.sql'),
`-- 00-reset.sql — run ONCE before the other chunks if a prior run partially
-- created tables. Drops & recreates the public schema. Skip on a fresh DB.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
`);

// 00-init
fs.writeFileSync(path.join(OUT, '00-init.sql'),
`-- 00-init.sql — creates the __migrations tracker. Run after 00-reset.
CREATE TABLE IF NOT EXISTS __migrations (
  tag text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`);

files.forEach((f, i) => {
  const tag = f.replace(/\.sql$/, '');
  const num = String(i + 1).padStart(2, '0');
  const raw = fs.readFileSync(path.join(SRC, f), 'utf8');
  const body = transform(raw);
  let stmts = splitStatements(body);
  if (i === 0) stmts = topoSortCreateTables(stmts);
  const out =
`-- ${num}-${tag}.sql
BEGIN;
${stmts.join('\n\n')}
INSERT INTO __migrations (tag) VALUES ('${tag}') ON CONFLICT DO NOTHING;
COMMIT;
`;
  fs.writeFileSync(path.join(OUT, `${num}-${tag}.sql`), out);
});

fs.writeFileSync(path.join(OUT, '06-seed.sql'),
`-- 06-seed.sql — default site_settings. Run last.
BEGIN;
INSERT INTO site_settings (key, value)
VALUES ('site', jsonb_build_object(
  'company', jsonb_build_object('name','Toluene Tech','email','hello@toluenetech.com'),
  'contact', jsonb_build_object('email','hello@toluenetech.com'),
  'availability', 'AVAILABLE',
  'hero', jsonb_build_object(
    'title','Ship software that actually works.',
    'subtitle','Toluene Tech designs, builds and operates production-grade web, mobile and AI systems.',
    'primaryCta','Start a project',
    'primaryCtaHref','/start-project'
  ),
  'seo_defaults', jsonb_build_object(
    'siteName','Toluene Tech',
    'defaultTitle','Toluene Tech — Web, Mobile & AI Engineering'
  )
)) ON CONFLICT (key) DO NOTHING;
COMMIT;
`);

// all-in-one
const all = fs.readdirSync(OUT).filter(f => f.endsWith('.sql') && !f.startsWith('README')).sort()
  .map(f => fs.readFileSync(path.join(OUT, f), 'utf8'))
  .join('\n');
fs.writeFileSync(path.join(SRC, 'neon-staging-all.sql'), all);

// verify
let ok = true;
for (const fn of fs.readdirSync(OUT).sort()) {
  if (!fn.endsWith('.sql')) continue;
  const p = path.join(OUT, fn);
  const c = fs.readFileSync(p, 'utf8');
  const doB = (c.match(/DO \$\$ BEGIN/g) || []).length;
  const doE = (c.match(/END \$\$;/g) || []).length;
  const doubleIf = (c.match(/IF NOT EXISTS\s+IF NOT EXISTS/g) || []).length;
  const uniqSpc = (c.match(/"\w+_unique"UNIQUE/g) || []).length;
  // check every BEGIN; has a matching COMMIT; (excluding 00-reset/00-init which have no BEGIN)
  const beginC = (c.match(/^BEGIN;/gm) || []).length;
  const commitC = (c.match(/^COMMIT;/gm) || []).length;
  const bad = doB !== doE || doubleIf || uniqSpc || beginC !== commitC;
  if (bad) ok = false;
  console.log(`${bad ? '❌' : '✓'} ${fn}: lines=${c.split('\n').length} DO=${doB}/${doE} txn=${beginC}/${commitC} doubleIf=${doubleIf} uniqSpace=${uniqSpc}`);
}
process.exit(ok ? 0 : 1);
