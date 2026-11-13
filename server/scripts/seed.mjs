#!/usr/bin/env node
/** Seed minimal safe staging defaults (IPv4-forced). */
import { neon } from '@neondatabase/serverless';
import { Agent } from 'undici';
import tls from 'node:tls';
import net from 'node:net';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL required'); process.exit(1); }

function clean(u) { return u.replace(/[?&](sslmode|channel_binding|uselibpqcompat)=[^&]*/g, ''); }

function buildAgent() {
  return new Agent({
    connect: (opts, cb) => {
      const socket = net.connect({ host: opts.hostname, port: opts.port || 443, family: 4 });
      socket.on('connect', () => cb(null, tls.connect({ socket, servername: opts.hostname, ALPNProtocols: ['h2','http/1.1'], rejectUnauthorized: true })));
      socket.on('error', (err) => cb(err));
    },
  });
}
async function connect() {
  const urlStr = clean(dbUrl).replace(/-pooler(\.c-)/, '$1');
  const fetchFn = (u, init) => fetch(u, { ...init, dispatcher: buildAgent() });
  const q = neon(urlStr, { fetchFunction: fetchFn });
  await q`SELECT 1`;
  return q;
}

const DEFAULT_SETTINGS = {
  company: { name: 'Toluene Tech', email: 'hello@toluenetech.com' },
  contact: { email: 'hello@toluenetech.com' },
  availability: 'AVAILABLE',
  hero: { title: 'Ship software that actually works.', subtitle: 'Toluene Tech designs, builds and operates production-grade web, mobile and AI systems.', primaryCta: 'Start a project', primaryCtaHref: '/start-project' },
  seo_defaults: { siteName: 'Toluene Tech', defaultTitle: 'Toluene Tech — Web, Mobile & AI Engineering' },
};

(async () => {
  const sql = await connect();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM site_settings`;
  if (rows[0].n === 0) {
    await sql`INSERT INTO site_settings (key, value) VALUES ('site', ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb)`;
    console.log('Inserted default site_settings.');
  } else {
    console.log('site_settings already populated; skipping.');
  }
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
