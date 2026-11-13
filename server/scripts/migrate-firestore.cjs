#!/usr/bin/env node
/**
 * Migrate data from Cloud Firestore to Neon (CJS for firebase-admin compatibility).
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin.json \
 *   DATABASE_URL="postgres://neondb_owner:npg_xxx@ep-xxx.c-14.aws.neon.tech/neondb?sslmode=require" \
 *     node scripts/migrate-firestore.cjs --dry-run
 */
const admin = require('firebase-admin');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');
const { Agent } = require('undici');
const tls = require('node:tls');
const net = require('node:net');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const dryRun = !!args['dry-run'];
const collections = (args.collections || 'services,solutions,projects,products,labItems,testimonials,faqs,insights,pricingPlans,tools,leads,clients,clientProjects,milestones,tasks,messages,siteSettings').split(',').map(s => s.trim()).filter(Boolean);

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1); }
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) { console.error('GOOGLE_APPLICATION_CREDENTIALS required'); process.exit(1); }

const svc = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(svc) });
const firestore = admin.firestore();

function clean(u) { return u.replace(/[?&](sslmode|channel_binding|uselibpqcompat)=[^&]*/g, ''); }
function buildAgent() {
  return new Agent({
    connect: (opts, cb) => {
      const s = net.connect({ host: opts.hostname, port: opts.port || 443, family: 4 });
      s.on('connect', () => cb(null, tls.connect({ socket: s, servername: opts.hostname, ALPNProtocols: ['h2','http/1.1'], rejectUnauthorized: true })));
      s.on('error', e => cb(e));
    }
  });
}
function makeSql(urlStr) {
  const fetchFn = (u, init) => fetch(u, { ...init, dispatcher: buildAgent() });
  return neon(urlStr, { fetchFunction: fetchFn });
}
const directUrl = clean(process.env.DATABASE_URL).replace(/-pooler(\.c-)/, '$1');
let sql;
try { sql = makeSql(directUrl); sql`SELECT 1`; console.log('Neon connected via direct (non-pooler) host.'); }
catch (e1) {
  try { sql = makeSql(clean(process.env.DATABASE_URL)); sql`SELECT 1`; console.log('Neon connected via pooler host.'); }
  catch (e2) { console.error('Could not connect to Neon:', e2.message); process.exit(2); }
}

function slugify(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120); }
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v && v.toDate) return v.toDate();
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return null;
}
const json = v => v === undefined || v === null ? null : JSON.stringify(v);
const str = (v, n=500) => v === undefined || v === null ? null : String(v).slice(0,n);
const int = (v, d=null) => { const n=Number(v); return Number.isFinite(n) ? Math.round(n) : d; };
const bool = (v, d=false) => typeof v === 'boolean' ? v : d;
function enumVal(v, allowed, d) { const s = String(v||d||'').toUpperCase(); return allowed.includes(s) ? s : d; }
function uid(prefix, id) {
  if (id && /^[0-9a-zA-Z_-]{8,}$/.test(id)) return String(id);
  return prefix + '_' + slugify(id || crypto.randomUUID());
}

const stats = { collections: 0, read: 0, inserted: 0, errors: [] };
async function upsert(table, pkey, data) {
  const cols = Object.keys(data);
  const vals = cols.map(k => data[k]);
  const setClauses = cols.filter(c => c !== pkey).map(c => '"'+c+'" = EXCLUDED."'+c+'"').join(', ');
  const placeholders = cols.map((_,i)=>'$'+(i+1)).join(',');
  const q = `INSERT INTO "${table}" (${cols.map(c=>'"'+c+'"').join(',')}) VALUES (${placeholders}) ON CONFLICT ("${pkey}") DO ${setClauses ? `UPDATE SET ${setClauses}` : 'NOTHING'}`;
  if (dryRun) { stats.inserted++; return; }
  try { await sql(q, vals); stats.inserted++; }
  catch (e) { stats.errors.push(table+': '+e.message); }
}
async function fetchCollection(name) {
  const snap = await firestore.collection(name).get();
  const out = []; snap.forEach(d => out.push({ id: d.id, ...d.data() })); return out;
}

const mappers = {
  services: d => ({
    id: uid('svc',d.id), slug: d.slug||slugify(d.title||d.id), title: str(d.title,160)||'Untitled',
    short_description: str(d.shortDescription||d.excerpt,300), long_description: str(d.longDescription||d.description,5000),
    icon: str(d.icon,40), capabilities: json(d.capabilities||[]), related_project_ids: json(d.relatedProjectIds||[]),
    is_published: bool(d.isPublished,true), is_featured: bool(d.isFeatured,false), order: int(d.order,0)
  }),
  solutions: d => ({
    id: uid('sol',d.id), slug: d.slug||slugify(d.title||d.id), title: str(d.title,160)||'Untitled',
    tagline: str(d.tagline,240), description: str(d.description,5000), icon: str(d.icon,40),
    features: json(d.features||[]), benefits: json(d.benefits||[]), image_url: str(d.imageUrl,500),
    related_service_ids: json(d.relatedServiceIds||[]), cta_label: str(d.ctaLabel,80), cta_url: str(d.ctaUrl,500),
    is_published: bool(d.isPublished,true), is_featured: bool(d.isFeatured,false), order: int(d.order,0)
  }),
  projects: d => ({
    id: uid('prj',d.id), slug: d.slug||slugify(d.title||d.id), title: str(d.title,220)||'Untitled',
    client_name: str(d.clientName,160), client_logo: str(d.clientLogo,500), role: str(d.role,160),
    platform: str(d.platform,120), framework: str(d.framework,120),
    completion_date: toDate(d.completionDate), status: str(d.status,40),
    cover_image: str(d.coverImage,500), gallery: json(d.gallery||[]), video_url: str(d.videoUrl,500),
    challenge: str(d.challenge,4000), objective: str(d.objective,4000), solution: str(d.solution,6000),
    features: json(d.features||[]), results: str(d.results,4000), metrics: json(d.metrics||[]),
    live_url: str(d.liveUrl,500), service_ids: json(d.serviceIds||[]),
    is_published: bool(d.isPublished,true), is_featured: bool(d.isFeatured,false),
    has_client_permission: bool(d.hasClientPermission,false), order: int(d.order,0),
    seo_title: str(d.seoTitle,200), seo_description: str(d.seoDescription,500), seo_og_image: str(d.seoOgImage,500)
  }),
  products: d => ({
    id: uid('prd',d.id), slug: d.slug||slugify(d.name||d.id), name: str(d.name,220)||'Untitled',
    description: str(d.description,4000), logo: str(d.logo,500), screenshots: json(d.screenshots||[]),
    features: json(d.features||[]), tech_stack: json(d.techStack||[]),
    status: enumVal(d.status,['IDEA','PROTOTYPE','IN_DEV','BETA','LIVE','ARCHIVED'],'IDEA'),
    demo_url: str(d.demoUrl,500), website_url: str(d.websiteUrl,500), is_published: bool(d.isPublished,false), order: int(d.order,0)
  }),
  labItems: d => ({
    id: uid('lab',d.id), slug: d.slug||slugify(d.title||d.id), title: str(d.title,220)||'Untitled',
    description: str(d.description,4000), category: enumVal(d.category,['AI','EXPERIMENT','TOOL','RESEARCH'],'EXPERIMENT'),
    tech: json(Array.isArray(d.tech)?d.tech.slice(0,30):[]), demo_url: str(d.demoUrl,500), status: str(d.status||'active',40),
    screenshots: json(Array.isArray(d.screenshots)?d.screenshots.slice(0,20):[]), is_published: bool(d.isPublished,false),
    published_at: toDate(d.publishedAt||(d.isPublished?d.createdAt:null)),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt)
  }),
  testimonials: d => ({
    id: uid('tst',d.id), name: str(d.name,160)||'Anonymous', role: str(d.role,160), company: str(d.company,160),
    photo: str(d.photo,500), testimonial: str(d.testimonial,2000)||'',
    related_project_id: d.relatedProjectId?uid('prj',d.relatedProjectId):null,
    is_featured: bool(d.isFeatured,false), is_published: bool(d.isPublished,true), order: int(d.order,0)
  }),
  faqs: d => ({
    id: uid('faq',d.id), question: str(d.question,300)||'', answer: str(d.answer,5000)||'',
    category: str(d.category,80), order: int(d.order,0), is_published: bool(d.isPublished,true)
  }),
  insights: d => ({
    id: uid('ins',d.id), slug: d.slug||slugify(d.title||d.id), title: str(d.title,220)||'Untitled',
    excerpt: str(d.excerpt,500), cover_image: str(d.coverImage,500), content: str(d.content,50000),
    author: str(d.author,160), category: str(d.category,80),
    tags: json(Array.isArray(d.tags)?d.tags.slice(0,30):[]), publish_date: toDate(d.publishDate),
    is_featured: bool(d.isFeatured,false), is_published: bool(d.isPublished!==false,true)
  }),
  pricingPlans: d => ({
    id: uid('pri',d.id), name: str(d.name,160)||'Plan', tagline: str(d.tagline,240),
    price_monthly: int(d.priceMonthly), price_one_time: int(d.priceOneTime),
    currency: str(d.currency||'USD',3), features: json(Array.isArray(d.features)?d.features:[]),
    cta_label: str(d.ctaLabel,80)||'Get started', cta_url: str(d.ctaUrl,500),
    is_featured: bool(d.isFeatured,false), is_published: bool(d.isPublished,true), order: int(d.order,0)
  }),
  tools: d => ({
    id: uid('tol',d.id), name: str(d.name,160)||'Tool', category: str(d.category,80)||'Frontend',
    logo_url: str(d.logoUrl,500), description: str(d.description,500), website_url: str(d.websiteUrl,500),
    is_published: bool(d.isPublished,true), order: int(d.order,0)
  }),
  leads: d => ({
    id: uid('lead',d.id), name: str(d.name,160)||'', email: str(d.email,160)||'', phone: str(d.phone,40),
    company: str(d.company,160), services: json(Array.isArray(d.services)?d.services:[]),
    requirements: str(d.requirements,5000), budget: str(d.budget,80), timeline: str(d.timeline,160), source: str(d.source,80),
    source_page: str(d.sourcePage,200), status: enumVal(d.status,['NEW','CONTACTED','QUALIFIED','WON','LOST','SPAM','ARCHIVED'],'NEW'),
    ai_ref: str(d.aiRef,200), created_at: toDate(d.createdAt||d.submittedAt)||new Date(), updated_at: toDate(d.updatedAt)
  }),
  clients: d => ({
    id: uid('cli',d.id), user_id: str(d.userId||d.uid||'firebase-migrated',128),
    name: str(d.name,160)||'', email: str(d.email,160)||'', phone: str(d.phone,40), company: str(d.company,160),
    access_code: str(d.accessCode,20), status: enumVal(d.status,['ACTIVE','INACTIVE'],'ACTIVE'),
    created_at: toDate(d.createdAt)||new Date()
  }),
  clientProjects: d => ({
    id: uid('cp',d.id), client_id: d.clientId?uid('cli',d.clientId):null, title: str(d.title,220)||'',
    description: str(d.description,5000),
    status: enumVal(d.status,['PLANNING','IN_PROGRESS','ACTIVE','ON_HOLD','PAUSED','REVIEW','COMPLETED','CANCELLED','ARCHIVED'],'ACTIVE'),
    progress: int(d.progress,0), assignee: str(d.assignee,120),
    start_date: toDate(d.startDate), due_date: toDate(d.dueDate),
    total_cents: int(d.totalCents), currency: str(d.currency||'USD',3),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt)
  }),
  milestones: d => ({
    id: uid('ms',d.id), project_id: d.projectId?uid('cp',d.projectId):null,
    title: str(d.title,220)||'', description: str(d.description,4000),
    status: enumVal(d.status,['PENDING','IN_PROGRESS','COMPLETED','APPROVED','REJECTED'],'PENDING'),
    due_date: toDate(d.dueDate||d.due), completed_date: toDate(d.completedDate),
    amount_cents: int(d.amountCents), order: int(d.order,0),
    approved_at: toDate(d.approvedAt), approved_by: str(d.approvedBy,128),
    rejection_reason: str(d.rejectionReason,2000),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt)
  }),
  tasks: d => ({
    id: uid('tk',d.id), project_id: d.projectId?uid('cp',d.projectId):null,
    milestone_id: d.milestoneId?uid('ms',d.milestoneId):null,
    title: str(d.title,240)||'', description: str(d.description,4000),
    status: enumVal(d.status,['TODO','IN_PROGRESS','DONE','BLOCKED'],'TODO'),
    priority: enumVal(d.priority,['LOW','MEDIUM','HIGH','URGENT'],'MEDIUM'),
    assignee: str(d.assignee,120), due_date: toDate(d.dueDate),
    completed_at: toDate(d.completedAt), completed_by: str(d.completedBy,128),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt)
  }),
  messages: d => {
    const isFromClient = bool(d.isFromClient, d.author==='client');
    const ctxType = enumVal(d.contextType,['PROJECT','LEAD','GENERAL'],'PROJECT');
    const contextId = d.contextId||d.projectId;
    return {
      id: uid('msg',d.id), context_type: ctxType,
      context_id: contextId?(ctxType==='PROJECT'?uid('cp',contextId):contextId):null,
      thread_id: d.threadId?str(d.threadId,36):null,
      from_uid: str(d.fromUid||(isFromClient?null:d.authorId),128),
      from_client_id: isFromClient&&d.clientId?uid('cli',d.clientId):null,
      from_name: str(d.fromName||d.authorName||(isFromClient?'Client':'Team'),160),
      to_uid: str(d.toUid,128), to_client_id: d.toClientId?uid('cli',d.toClientId):null,
      to_name: str(d.toName,160), is_from_client: isFromClient,
      body: str(d.body||d.text,4000)||'', attachments: json(d.attachments||[]),
      is_read: bool(d.isRead||d.readByClient||false,false), read_at: toDate(d.readAt),
      created_at: toDate(d.createdAt)||new Date()
    };
  }
};
const tableFor = { services:'services', solutions:'solutions', projects:'projects', products:'products', labItems:'lab_items', testimonials:'testimonials', faqs:'faqs', insights:'insights', pricingPlans:'pricing_plans', tools:'tools', leads:'leads', clients:'clients', clientProjects:'client_projects', milestones:'milestones', tasks:'tasks', messages:'messages' };

async function migrateSiteSettings() {
  if (!collections.includes('siteSettings')) return;
  stats.collections++;
  console.log('\n== siteSettings ==');
  const snap = await firestore.collection('siteSettings').get();
  let merged = {};
  snap.forEach(d => { merged = { ...merged, ...d.data() }; });
  stats.read += snap.size;
  if (dryRun) { console.log('  (dry-run) would merge', snap.size, 'docs'); return; }
  const rows = await sql`SELECT value FROM site_settings WHERE key='site'`;
  const existing = rows[0]?.value || {};
  const mergedValue = { ...existing, ...merged };
  await sql`INSERT INTO site_settings (key,value) VALUES ('site', ${JSON.stringify(mergedValue)}::jsonb) ON CONFLICT (key) DO UPDATE SET value=${JSON.stringify(mergedValue)}::jsonb`;
  console.log('  merged', snap.size, 'docs into site_settings.site');
}

(async () => {
  console.log(dryRun?'[DRY RUN] Would migrate:':'Migrating:');
  console.log('Collections:', collections.join(', '));
  for (const name of collections) {
    if (name==='siteSettings') continue;
    const mapper=mappers[name], table=tableFor[name];
    if (!mapper||!table) { console.log('\n== '+name+' ==  SKIPPED (no mapper)'); continue; }
    stats.collections++;
    console.log('\n== '+name+' ==');
    const docs = await fetchCollection(name);
    stats.read += docs.length;
    for (const d of docs) await upsert(table,'id',mapper(d));
    console.log('  '+docs.length+' docs processed (inserted: '+stats.inserted+', errors: '+stats.errors.length+')');
  }
  await migrateSiteSettings();
  console.log('\n=== Summary ===');
  console.log(JSON.stringify({...stats, errors: stats.errors.slice(0,20)}, null, 2));
  process.exit(stats.errors.length?4:0);
})().catch(e => { console.error(e); process.exit(1); });
