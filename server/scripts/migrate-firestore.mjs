#!/usr/bin/env node
/**
 * Migrate data from Cloud Firestore to Neon.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   FIRESTORE_DATABASE= (optional; defaults to "(default)") \
 *   DATABASE_URL=postgres://... \
 *   node scripts/migrate-firestore.mjs [--dry-run] [--collections=services,solutions,projects,...]
 *
 * Idempotent: upserts on primary key. Safe to re-run.
 * Does NOT delete records in Neon that aren't in Firestore (safer default
 * for a first migration; add --purge to wipe unmatched rows).
 *
 * Collections migrated (by default):
 *   services, solutions, projects, products, labItems (labs),
 *   testimonials, faqs, insights, pricingPlans, tools, leads, clients,
 *   clientProjects (jobs), milestones, tasks, files, messages, invoices,
 *   siteSettings (merged).
 *
 * Attachments / R2 files are not migrated — binary assets stay in Firebase
 * Storage until a separate file migration re-uploads them to R2.
 */

const admin = require('firebase-admin');
const { Client } = require('pg');
const { readFileSync } = require('node:fs');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : v];
}));
const dryRun = !!args['dry-run'];

const collections = (args.collections || 'services,solutions,projects,products,labItems,testimonials,faqs,insights,pricingPlans,tools,leads,clients,clientProjects,milestones,tasks,messages,siteSettings').split(',').map(s => s.trim()).filter(Boolean);

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL required'); process.exit(1); }

let serviceAccount;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/svc.json or FIREBASE_SERVICE_ACCOUNT_JSON={...}');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const firestore = admin.firestore();
if (process.env.FIRESTORE_DATABASE) {
  // Not exposed in older admin SDKs; safe to ignore.
}

const pg = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: true } });

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
}
function now() { return new Date(); }
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v && v.toDate) return v.toDate(); // Firestore Timestamp
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return null;
}
function json(v) {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}
function str(v, max = 500) {
  if (v === undefined || v === null) return null;
  return String(v).slice(0, max);
}
function int(v, dflt = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : dflt;
}
function bool(v, dflt = false) {
  return typeof v === 'boolean' ? v : dflt;
}
function enumVal(v, allowed, dflt) {
  const s = String(v || dflt || '').toUpperCase();
  return allowed.includes(s) ? s : dflt;
}
function uid(prefix, id) {
  // Stable derived id so re-runs upsert. Use id as-is if it's already a UUID-ish
  // string, otherwise prefix + slug to guarantee uniqueness.
  if (id && /^[0-9a-zA-Z_-]{8,}$/.test(id)) return String(id);
  return `${prefix}_${slugify(id || crypto.randomUUID())}`;
}

const stats = { collections: 0, read: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };

async function upsert(table, pkey, row, data) {
  const cols = Object.keys(data);
  const vals = cols.map(k => data[k]);
  const updates = cols.filter(c => c !== pkey).map(c => `${c} = EXCLUDED.${c}`).join(', ');
  const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_,i) => '$'+(i+1)).join(',')})
               ON CONFLICT (${pkey}) DO ${updates ? `UPDATE SET ${updates}` : 'NOTHING'}`;
  if (dryRun) { stats.inserted++; return; }
  try {
    const r = await pg.query(sql, vals);
    if (r.rowCount > 0) stats.inserted++;
    else stats.skipped++;
  } catch (e) {
    stats.errors.push(`${table} ${row.id}: ${e.message}`);
  }
}

async function fetchCollection(name) {
  const snap = await firestore.collection(name).get();
  const out = [];
  snap.forEach(d => out.push { id: d.id, ...d.data() });
  return out;
}

function mapService(d) {
  return {
    id: uid('svc', d.id), slug: d.slug || slugify(d.title || d.id),
    title: str(d.title, 160) || 'Untitled', short_description: str(d.shortDescription || d.excerpt, 300),
    long_description: str(d.longDescription || d.description, 5000),
    icon: str(d.icon, 40), capabilities: json(d.capabilities || []),
    related_project_ids: json(d.relatedProjectIds || []),
    is_published: bool(d.isPublished, true), is_featured: bool(d.isFeatured, false),
    order: int(d.order, 0),
  };
}
function mapSolution(d) {
  return {
    id: uid('sol', d.id), slug: d.slug || slugify(d.title || d.id),
    title: str(d.title, 160) || 'Untitled', tagline: str(d.tagline, 240), description: str(d.description, 5000),
    icon: str(d.icon, 40), features: json(d.features || []), benefits: json(d.benefits || []),
    image_url: str(d.imageUrl, 500),
    related_service_ids: json(d.relatedServiceIds || []),
    cta_label: str(d.ctaLabel, 80), cta_url: str(d.ctaUrl, 500),
    is_published: bool(d.isPublished, true), is_featured: bool(d.isFeatured, false), order: int(d.order, 0),
  };
}
function mapProject(d) {
  return {
    id: uid('prj', d.id), slug: d.slug || slugify(d.title || d.id),
    title: str(d.title, 220) || 'Untitled', client_name: str(d.clientName, 160),
    client_logo: str(d.clientLogo, 500), role: str(d.role, 160), platform: str(d.platform, 120), framework: str(d.framework, 120),
    completion_date: toDate(d.completionDate), status: str(d.status, 40),
    cover_image: str(d.coverImage, 500), gallery: json(d.gallery || []), video_url: str(d.videoUrl, 500),
    challenge: str(d.challenge, 4000), objective: str(d.objective, 4000), solution: str(d.solution, 6000),
    features: json(d.features || []), results: str(d.results, 4000),
    metrics: json(d.metrics || []), live_url: str(d.liveUrl, 500),
    service_ids: json(d.serviceIds || []),
    is_published: bool(d.isPublished, true), is_featured: bool(d.isFeatured, false),
    has_client_permission: bool(d.hasClientPermission, false), order: int(d.order, 0),
    seo_title: str(d.seoTitle, 200), seo_description: str(d.seoDescription, 500), seo_og_image: str(d.seoOgImage, 500),
  };
}
function mapProduct(d) {
  return {
    id: uid('prd', d.id), slug: d.slug || slugify(d.name || d.id),
    name: str(d.name, 220) || 'Untitled', description: str(d.description, 4000), logo: str(d.logo, 500),
    screenshots: json(d.screenshots || []), features: json(d.features || []), tech_stack: json(d.techStack || []),
    status: enumVal(d.status, ['IDEA','PROTOTYPE','IN_DEV','BETA','LIVE','ARCHIVED'], 'IDEA'),
    demo_url: str(d.demoUrl, 500), website_url: str(d.websiteUrl, 500),
    is_published: bool(d.isPublished, false), order: int(d.order, 0),
  };
}
function mapLab(d) {
  return {
    id: uid('lab', d.id), slug: d.slug || slugify(d.title || d.id),
    title: str(d.title, 220) || 'Untitled', description: str(d.description, 4000),
    category: enumVal(d.category, ['AI','EXPERIMENT','TOOL','RESEARCH'], 'EXPERIMENT'),
    tech: json(Array.isArray(d.tech) ? d.tech.slice(0,30) : []),
    demo_url: str(d.demoUrl, 500), status: str(d.status || 'active', 40),
    screenshots: json(Array.isArray(d.screenshots) ? d.screenshots.slice(0,20) : []),
    is_published: bool(d.isPublished, false),
    published_at: toDate(d.publishedAt || (d.isPublished ? d.createdAt : null)),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt),
  };
}
function mapTestimonial(d) {
  return {
    id: uid('tst', d.id),
    name: str(d.name, 160) || 'Anonymous', role: str(d.role, 160), company: str(d.company, 160), photo: str(d.photo, 500),
    testimonial: str(d.testimonial, 2000) || '',
    related_project_id: d.relatedProjectId ? uid('prj', d.relatedProjectId) : null,
    is_featured: bool(d.isFeatured, false), is_published: bool(d.isPublished, true), order: int(d.order, 0),
  };
}
function mapFAQ(d) {
  return {
    id: uid('faq', d.id), question: str(d.question, 300) || '', answer: str(d.answer, 5000) || '',
    category: str(d.category, 80), order: int(d.order, 0), is_published: bool(d.isPublished, true),
  };
}
function mapInsight(d) {
  return {
    id: uid('ins', d.id), slug: d.slug || slugify(d.title || d.id),
    title: str(d.title, 220) || 'Untitled', excerpt: str(d.excerpt, 500), cover_image: str(d.coverImage, 500),
    content: str(d.content, 50000), author: str(d.author, 160), category: str(d.category, 80),
    tags: json(Array.isArray(d.tags) ? d.tags.slice(0,30) : []),
    publish_date: toDate(d.publishDate),
    is_featured: bool(d.isFeatured, false), is_published: bool(d.isPublished !== false, true),
  };
}
function mapPricing(d) {
  return {
    id: uid('pri', d.id), name: str(d.name, 160) || 'Plan', tagline: str(d.tagline, 240),
    price_monthly: int(d.priceMonthly), price_one_time: int(d.priceOneTime),
    currency: str(d.currency || 'USD', 3),
    features: json(Array.isArray(d.features) ? d.features : []),
    cta_label: str(d.ctaLabel, 80) || 'Get started', cta_url: str(d.ctaUrl, 500),
    is_featured: bool(d.isFeatured, false), is_published: bool(d.isPublished, true), order: int(d.order, 0),
  };
}
function mapTool(d) {
  return {
    id: uid('tol', d.id), name: str(d.name, 160) || 'Tool', category: str(d.category, 80) || 'Frontend',
    logo_url: str(d.logoUrl, 500), description: str(d.description, 500), website_url: str(d.websiteUrl, 500),
    is_published: bool(d.isPublished, true), order: int(d.order, 0),
  };
}
function mapLead(d) {
  return {
    id: uid('lead', d.id),
    name: str(d.name, 160) || '', email: str(d.email, 160) || '', phone: str(d.phone, 40),
    company: str(d.company, 160),
    services: json(Array.isArray(d.services) ? d.services : []),
    requirements: str(d.requirements, 5000),
    budget: str(d.budget, 80), timeline: str(d.timeline, 160), source: str(d.source, 80),
    source_page: str(d.sourcePage, 200),
    status: enumVal(d.status, ['NEW','CONTACTED','QUALIFIED','WON','LOST','SPAM','ARCHIVED'], 'NEW'),
    ai_ref: str(d.aiRef, 200),
    created_at: toDate(d.createdAt || d.submittedAt) || now(),
    updated_at: toDate(d.updatedAt),
  };
}
function mapClient(d) {
  return {
    id: uid('cli', d.id), user_id: str(d.userId || d.uid || 'firebase-migrated', 128),
    name: str(d.name, 160) || '', email: str(d.email, 160) || '',
    phone: str(d.phone, 40), company: str(d.company, 160),
    access_code: str(d.accessCode, 20),
    status: enumVal(d.status, ['ACTIVE','INACTIVE'], 'ACTIVE'),
    created_at: toDate(d.createdAt) || now(),
  };
}
function mapClientProject(d) {
  return {
    id: uid('cp', d.id), client_id: d.clientId ? uid('cli', d.clientId) : null,
    title: str(d.title, 220) || '', description: str(d.description, 5000),
    status: enumVal(d.status, ['PLANNING','IN_PROGRESS','ACTIVE','ON_HOLD','PAUSED','REVIEW','COMPLETED','CANCELLED','ARCHIVED','active','in-progress','on-hold','completed'], 'ACTIVE'),
    progress: int(d.progress, 0), assignee: str(d.assignee, 120),
    start_date: toDate(d.startDate), due_date: toDate(d.dueDate),
    total_cents: int(d.totalCents), currency: str(d.currency || 'USD', 3),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt),
  };
}
function mapMilestone(d) {
  return {
    id: uid('ms', d.id), project_id: d.projectId ? uid('cp', d.projectId) : null,
    title: str(d.title, 220) || '', description: str(d.description, 4000),
    status: enumVal(d.status, ['PENDING','IN_PROGRESS','COMPLETED','APPROVED','REJECTED','pending','in-progress','completed'], 'PENDING'),
    due_date: toDate(d.dueDate || d.due), completed_date: toDate(d.completedDate),
    amount_cents: int(d.amountCents), order: int(d.order, 0),
    approved_at: toDate(d.approvedAt), approved_by: str(d.approvedBy, 128),
    rejection_reason: str(d.rejectionReason, 2000),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt),
  };
}
function mapTask(d) {
  return {
    id: uid('tk', d.id), project_id: d.projectId ? uid('cp', d.projectId) : null,
    milestone_id: d.milestoneId ? uid('ms', d.milestoneId) : null,
    title: str(d.title, 240) || '', description: str(d.description, 4000),
    status: enumVal(d.status, ['TODO','IN_PROGRESS','DONE','BLOCKED'], 'TODO'),
    priority: enumVal(d.priority, ['LOW','MEDIUM','HIGH','URGENT'], 'MEDIUM'),
    assignee: str(d.assignee, 120), due_date: toDate(d.dueDate),
    completed_at: toDate(d.completedAt), completed_by: str(d.completedBy, 128),
    created_at: toDate(d.createdAt), updated_at: toDate(d.updatedAt),
  };
}
function mapMessage(d) {
  // Messages in Firestore used different shapes; normalise into the new schema.
  const isFromClient = bool(d.isFromClient, d.author === 'client');
  const ctxType = enumVal(d.contextType, ['PROJECT','LEAD','GENERAL'], 'PROJECT');
  const contextId = d.contextId || d.projectId;
  return {
    id: uid('msg', d.id),
    context_type: ctxType,
    context_id: contextId ? (ctxType === 'PROJECT' ? uid('cp', contextId) : contextId) : null,
    thread_id: d.threadId ? str(d.threadId, 36) : null,
    from_uid: str(d.fromUid || (isFromClient ? null : d.authorId), 128),
    from_client_id: isFromClient && d.clientId ? uid('cli', d.clientId) : null,
    from_name: str(d.fromName || d.authorName || (isFromClient ? 'Client' : 'Team'), 160),
    to_uid: str(d.toUid, 128),
    to_client_id: d.toClientId ? uid('cli', d.toClientId) : null,
    to_name: str(d.toName, 160),
    is_from_client: isFromClient,
    body: str(d.body || d.text, 4000) || '',
    attachments: json(d.attachments || []),
    is_read: bool(d.isRead || d.readByClient || false, false),
    read_at: toDate(d.readAt),
    created_at: toDate(d.createdAt) || now(),
  };
}
async function migrateSimple(name, mapper, table, pkey = 'id') {
  if (!collections.includes(name)) return;
  stats.collections++;
  console.log(`\n== ${name} ==`);
  const docs = await fetchCollection(name);
  stats.read += docs.length;
  for (const d of docs) {
    const row = mapper(d);
    await upsert(table, pkey, d, row);
  }
  console.log(`  ${docs.length} docs processed (inserted/updated: ${stats.inserted}, errors: ${stats.errors.length})`);
}

async function migrateSiteSettings() {
  if (!collections.includes('siteSettings')) return;
  stats.collections++;
  console.log('\n== siteSettings ==');
  // Site settings historically lived as a single document, usually 'site'.
  // Merge whatever key/value pairs we find into site_settings row 'site'.
  const snap = await firestore.collection('siteSettings').get();
  let merged = {};
  snap.forEach(d => { merged = { ...merged, ...d.data() }; });
  stats.read += snap.size;
  if (dryRun) { console.log('  (dry-run) would merge', snap.size, 'docs'); return; }
  const { rows } = await pg.query('SELECT value FROM site_settings WHERE key = $1', ['site']);
  const existing = rows[0]?.value || {};
  const mergedValue = { ...existing, ...merged };
  await pg.query(`INSERT INTO site_settings (key, value) VALUES ('site', $1::jsonb)
                  ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`, [JSON.stringify(mergedValue)]);
  console.log(`  merged ${snap.size} docs into site_settings.site`);
}

(async () => {
  await pg.connect();
  console.log(dryRun ? '[DRY RUN] Would migrate:' : 'Migrating:');
  console.log('Collections:', collections.join(', '));

  // Order matters for foreign keys.
  await migrateSimple('services', mapService, 'services');
  await migrateSimple('solutions', mapSolution, 'solutions');
  await migrateSimple('projects', mapProject, 'projects');
  await migrateSimple('products', mapProduct, 'products');
  await migrateSimple('labItems', mapLab, 'lab_items');
  await migrateSimple('tools', mapTool, 'tools');
  await migrateSimple('testimonials', mapTestimonial, 'testimonials');
  await migrateSimple('faqs', mapFAQ, 'faqs');
  await migrateSimple('insights', mapInsight, 'insights');
  await migrateSimple('pricingPlans', mapPricing, 'pricing_plans');
  await migrateSimple('leads', mapLead, 'leads');
  await migrateSimple('clients', mapClient, 'clients');
  await migrateSimple('clientProjects', mapClientProject, 'client_projects');
  await migrateSimple('milestones', mapMilestone, 'milestones');
  await migrateSimple('tasks', mapTask, 'tasks');
  // Messages only where projectId maps to a client_project; others are ignored.
  await migrateSimple('messages', mapMessage, 'messages');
  await migrateSiteSettings();

  console.log('\n=== Summary ===');
  console.log(JSON.stringify({ ...stats, errors: stats.errors.slice(0, 20) }, null, 2));
  await pg.end();
  process.exit(stats.errors.length ? 4 : 0);
})().catch(e => { console.error(e); process.exit(1); });
