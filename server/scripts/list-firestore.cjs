#!/usr/bin/env node
/** List Firestore collections + doc counts. CJS (firebase-admin friendly). */
const admin = require('firebase-admin');
const fs = require('node:fs');
const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!svcPath) { console.error('Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json'); process.exit(1); }
const svc = JSON.parse(fs.readFileSync(svcPath, 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(svc) });
const db = admin.firestore();
(async () => {
  const cols = ['services','solutions','projects','products','labItems','testimonials','faqs','insights','pricingPlans','tools','siteSettings','leads','clients','clientProjects','milestones','tasks','messages','lead_notes','media'];
  console.log('Checking Firestore collections...\n');
  let total = 0;
  for (const c of [...new Set(cols)]) {
    try {
      const snap = await db.collection(c).limit(500).get();
      console.log('  ' + c.padEnd(22) + snap.size + ' docs');
      total += snap.size;
    } catch (e) { console.log('  ' + c.padEnd(22) + 'ERROR: ' + e.message); }
  }
  try {
    const all = await db.listCollections();
    const extra = all.map(c => c.id).filter(n => !cols.includes(n));
    if (extra.length) console.log('\nOther collections found:', extra.join(', '));
  } catch {}
  console.log('\nTotal: ' + total + ' documents.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
