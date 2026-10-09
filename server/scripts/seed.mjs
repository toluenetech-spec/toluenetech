#!/usr/bin/env node
/**
 * Seed minimal, safe staging defaults into Neon.
 * Inserts only site_settings (if empty) and does NOT overwrite any existing
 * CMS rows (services, projects, etc.) — those come from Firestore or manual
 * admin entry.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/seed.mjs
 */
const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL required'); process.exit(1); }

const DEFAULT_SETTINGS = {
  company: { name: 'Toluene Tech', email: 'hello@toluenetech.com' },
  contact: { email: 'hello@toluenetech.com' },
  availability: 'AVAILABLE',
  hero: { title: 'Ship software that actually works.', subtitle: 'Toluene Tech designs, builds and operates production-grade web, mobile and AI systems.', primaryCta: 'Start a project', primaryCtaHref: '/start-project' },
  seo_defaults: { siteName: 'Toluene Tech', defaultTitle: 'Toluene Tech — Web, Mobile & AI Engineering' },
};

(async () => {
  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: true } });
  await c.connect().catch(e => { console.error('Connect failed:', e.message); process.exit(2); });

  const { rows } = await c.query('SELECT COUNT(*)::int AS n FROM site_settings');
  if (rows[0].n === 0) {
    await c.query('INSERT INTO site_settings (key, value) VALUES ($1, $2::jsonb)', ['site', DEFAULT_SETTINGS]);
    console.log('Inserted default site_settings.');
  } else {
    console.log('site_settings already populated; skipping.');
  }

  // Ensure at least one admin client for login testing? NO — access codes
  // come from /admin/clients. Leave blank so the admin must create them.
  console.log('Done.');
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
