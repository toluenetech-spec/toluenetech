// Quick Neon connectivity diagnostic. Run from server/:
//   DATABASE_URL="..." NODE_OPTIONS="--dns-result-order=ipv4first" node scripts/test-neon.mjs
import { neon } from '@neondatabase/serverless';

const urls = [
  process.env.DATABASE_URL,
  // non-pooler variant (swap -pooler out)
  process.env.DATABASE_URL?.replace('-pooler', ''),
];
const clean = (u) => u.replace(/[?&](sslmode|channel_binding|uselibpqcompat)=[^&]*/g, '');
const masked = (u) => u.replace(/:[^:@]+@/, ':***@');

async function tryFetch(u) {
  console.log('\n-- fetch GET to host:', new URL(u.replace('postgresql://', 'https://')).origin);
  try {
    const r = await fetch(new URL(u.replace('postgresql://', 'https://')).origin, { method: 'GET' });
    console.log('   fetch status:', r.status);
  } catch (e) {
    console.log('   fetch error:', e.cause?.code || e.code || e.message);
    console.log('   cause:', e.cause?.message || '');
  }
}

for (const u of urls) {
  if (!u) continue;
  console.log('\n=== Trying:', masked(clean(u)));
  await tryFetch(u);
  try {
    const sql = neon(clean(u));
    const r = await sql`SELECT 1 AS ok, current_database() AS db, version() AS v`;
    console.log('   NEON OK:', r);
  } catch (e) {
    console.log('   NEON FAILED:', e.message);
    console.log('   cause:', e.cause?.code || e.cause?.message || '');
  }
}
