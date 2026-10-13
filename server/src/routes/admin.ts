/**
 * Admin API endpoints (auth-protected).
 *
 * CRUD for: services, projects, faqs, testimonials, insights, pricing_plans,
 *           products, leads, clients, client_projects, milestones, site_settings, media.
 *
 * AI control:
 *   GET  /ai/config, /ai/models, /ai/status, /ai/conversations, /ai/conversations/:id/messages
 *   POST /ai/config, /ai/conversations/:id/rename
 *   DEL  /ai/conversations/:id
 *
 * Phase 1 hardening:
 *   - Standardized {success, data|error} response envelope via onError.
 *   - All PUT bodies are field-whitelisted (no mass-assignment).
 *   - POST /clients generates + persists accessCode.
 *   - POST /clients/:id/regenerate-code rotates access codes.
 *   - AI config save invalidates resolveForSurface() cache immediately.
 *   - Audit logs are written for all mutations.
 *   - Input lengths constrained (mirrors public /leads constraints).
 *   - Legacy response shapes are preserved where the UI depends on them
 *     ({ items, total } for list endpoints, plain objects for gets).
 */
import { Hono } from 'hono';
import { eq, desc, asc, like, or, and, count } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { authAdmin, type AuthContext } from '../lib/auth';
import { normaliseModelId, MODEL_CATALOG } from '../ai/models';
import { ApiError, jsonError } from '../lib/errors';
import { writeAudit } from '../lib/audit';
import { pick } from '../lib/validate';
import { generateAccessCode } from './auth';
import { buildConfigSnapshot, invalidateCache } from '../ai/surface-config';

const app = new Hono<{ Bindings: Env }>();

// ---------- Middleware ----------
app.use('*', async (c, next) => {
  try {
    const a = await authAdmin(c.req.raw, c.env as Env);
    (c as any).set('auth', a);
  } catch (e) {
    if (e instanceof ApiError) return c.json({ success: false, error: { code: e.code, message: e.message } }, e.status as any);
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' } }, 401 as any);
  }
  await next();
});
app.onError((err, c) => jsonError(c, err));

function auth(c: any): AuthContext { return c.get('auth') as AuthContext; }
type DB = ReturnType<typeof getDb>;
const uid = () => crypto.randomUUID();
const now = () => new Date();

function combine(...parts: any[]): any {
  const p = parts.filter(x => x !== undefined && x !== null);
  if (p.length === 0) return undefined;
  if (p.length === 1) return p[0];
  return and(...p);
}
const searchLike = (q: string | undefined, cols: any[]) => {
  if (!q) return undefined;
  const term = `%${q}%`;
  return or(...cols.map(c => like(c, term)));
};
async function counted(db: DB, table: any, where: any, orderBy: any, limit = 500) {
  const [cnt] = await db.select({ c: count() }).from(table).where(where);
  const items = await db.select().from(table).where(where).orderBy(orderBy).limit(limit);
  return { items, total: Number(cnt.c) };
}
function pubCond(table: any, pub: string | null) {
  if (pub === 'published') return eq(table.isPublished, true);
  if (pub === 'draft') return eq(table.isPublished, false);
  return undefined;
}
function slugify(input: string, prefix: string): string {
  const base = String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base ? base.slice(0, 120) : `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
async function getOr404(db: any, table: any, id: string, msg: string = 'Not found.'): Promise<any> {
  const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: msg });
  return row;
}
function sanitizeStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

// ---------- Dashboard ----------
app.get('/stats', async (c) => {
  const db = getDb(c.env as Env);
  const [projectCount, publishedProj, leadTotal, newLeads, qualifiedLeads, wonLeads, clientCount, activeClients, serviceCount, faqCount, testimonialCount, insightCount] = await Promise.all([
    db.select({ c: count() }).from(schema.projects).then(r => r[0].c),
    db.select({ c: count() }).from(schema.projects).where(eq(schema.projects.isPublished, true)).then(r => r[0].c),
    db.select({ c: count() }).from(schema.leads).then(r => r[0].c),
    db.select({ c: count() }).from(schema.leads).where(eq(schema.leads.status, 'NEW')).then(r => r[0].c),
    db.select({ c: count() }).from(schema.leads).where(eq(schema.leads.status, 'QUALIFIED')).then(r => r[0].c),
    db.select({ c: count() }).from(schema.leads).where(eq(schema.leads.status, 'WON')).then(r => r[0].c),
    db.select({ c: count() }).from(schema.clients).then(r => r[0].c),
    db.select({ c: count() }).from(schema.clients).where(eq(schema.clients.status, 'ACTIVE')).then(r => r[0].c),
    db.select({ c: count() }).from(schema.services).then(r => r[0].c),
    db.select({ c: count() }).from(schema.faqs).then(r => r[0].c),
    db.select({ c: count() }).from(schema.testimonials).then(r => r[0].c),
    db.select({ c: count() }).from(schema.insights).then(r => r[0].c),
  ]);
  const recentLeads = await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(8);
  const recentProjects = await db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)).limit(6);
  const conversionRate = Number(leadTotal) > 0 ? Math.round((Number(wonLeads) / Number(leadTotal)) * 100) : 0;
  return c.json({
    projects: { total: Number(projectCount), published: Number(publishedProj) },
    leads: { total: Number(leadTotal), new: Number(newLeads), qualified: Number(qualifiedLeads), won: Number(wonLeads), conversionRate },
    clients: { total: Number(clientCount), active: Number(activeClients) },
    content: { services: Number(serviceCount), faqs: Number(faqCount), testimonials: Number(testimonialCount), insights: Number(insightCount) },
    recentLeads, recentProjects,
  });
});

// ======================================================================
// Generic CRUD helpers — whitelisted.
// Field lists MUST enumerate every mutable column (never id/createdAt/updatedAt).
// ======================================================================

// Services
const SERVICE_FIELDS = ['slug','title','shortDescription','longDescription','icon','capabilities','relatedProjectIds','isPublished','isFeatured','order','seoTitle','seoDescription','seoOgImage'] as const;
// Projects (public portfolio)
const PROJECT_FIELDS = ['slug','title','clientName','clientLogo','role','platform','framework','completionDate','status','coverImage','gallery','videoUrl','challenge','objective','solution','features','process','results','metrics','liveUrl','githubUrl','appStoreUrl','playStoreUrl','serviceIds','isPublished','isFeatured','hasClientPermission','order','seoTitle','seoDescription','seoOgImage'] as const;
// FAQs
const FAQ_FIELDS = ['question','answer','category','order','isPublished'] as const;
// Testimonials
const TESTIMONIAL_FIELDS = ['name','role','company','photo','testimonial','relatedProjectId','isFeatured','isPublished','order'] as const;
// Insights
const INSIGHT_FIELDS = ['slug','title','excerpt','coverImage','content','author','category','tags','publishDate','seoTitle','seoDescription','seoOgImage','isFeatured','isDraft'] as const;
// Pricing
const PRICING_FIELDS = ['name','tagline','priceMonthly','priceOneTime','currency','features','ctaLabel','ctaUrl','isFeatured','isPublished','order'] as const;
// Products
const PRODUCT_FIELDS = ['slug','name','description','logo','screenshots','features','techStack','status','demoUrl','websiteUrl','caseStudyUrl','isPublished','order'] as const;
// Leads (admin can edit status, notes, followUp, convertedClientId; never ref)
const LEAD_FIELDS = ['name','email','phone','company','services','requirements','budget','timeline','source','sourcePage','aiRef','assignedTo','notes','status','followUpDate','lastContactedAt','convertedClientId'] as const;
// Solutions
const SOLUTION_FIELDS = ['slug','title','tagline','description','icon','features','benefits','imageUrl','relatedServiceIds','ctaLabel','ctaUrl','isPublished','isFeatured','order','seoTitle','seoDescription'] as const;
// Tools
const TOOL_FIELDS = ['name','category','logoUrl','description','websiteUrl','isPublished','order'] as const;
// Clients (admin edits name/email/phone/company/status; accessCode is set via dedicated endpoint)
const CLIENT_FIELDS = ['userId','name','email','phone','company','status'] as const;
// Client projects (jobs)
const CP_FIELDS = ['clientId','publicProjectId','title','description','status','priority','progress','assignee','startDate','dueDate','totalCents','currency'] as const;
// Milestones
const MS_FIELDS = ['projectId','title','description','dueDate','status','order','amountCents'] as const;
// Tasks
const TASK_FIELDS = ['projectId','milestoneId','title','description','status','priority','assignee','dueDate'] as const;
// Lab items
const LAB_FIELDS = ['slug','title','description','category','tech','demoUrl','status','screenshots','isPublished','publishedAt'] as const;

function genCrud<List, Item>(opts: {
  entity: string;
  table: any;
  listOrder: any;
  searchCols: any[];
  fields: readonly string[];
  mapInsert?: (b: any) => any;
  slugPrefix?: string;
}) {
  const { entity, table, listOrder, searchCols, fields, mapInsert, slugPrefix } = opts;
  const whitelist = [...fields];

  app.get(`/${entity}s`, async (c) => {
    const db = getDb(c.env as Env);
    const url = new URL(c.req.url);
    const q = url.searchParams.get('q') || undefined;
    const pub = url.searchParams.get('published');
    const extra: Record<string, any> = {};
    for (const [k, col] of Object.entries(extra)) {
      const v = url.searchParams.get(k) || undefined;
      if (v) extra[k] = eq(col, v);
    }
    const w = combine(searchLike(q, searchCols), pub ? pubCond(table, pub) : undefined);
    const { items, total } = await counted(db, table, w, listOrder);
    return c.json({ items, total });
  });

  app.get(`/${entity}s/:id`, async (c) => {
    const db = getDb(c.env as Env);
    const row = await getOr404(db, table, c.req.param('id'), `${entity} not found.`);
    return c.json(row);
  });

  app.post(`/${entity}s`, async (c) => {
    const env = c.env as Env;
    const db = getDb(env);
    let b: any;
    try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON body.' }); }
    const insert = mapInsert ? mapInsert(b) : pick(b, whitelist as any);
    insert.id = uid();
    if (slugPrefix && !insert.slug) insert.slug = slugify(b.title || b.name || '', slugPrefix);
    if (!insert.slug && slugPrefix) insert.slug = `${slugPrefix}-${insert.id.slice(0, 8)}`;
    const rows = await db.insert(table).values(insert).returning() as any[];
    const row = rows[0];
    writeAudit(env, { action: 'CREATE', entity: `${entity}s`, entityId: row.id, auth: auth(c), req: c.req.raw });
    return c.json(row, 201);
  });

  app.put(`/${entity}s/:id`, async (c) => {
    const env = c.env as Env;
    const db = getDb(env);
    const id = c.req.param('id');
    await getOr404(db, table, id, `${entity} not found.`);
    let b: any;
    try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON body.' }); }
    const patch: any = { ...pick(b, whitelist as any), updatedAt: now() };
    if (Object.keys(patch).length === 1) throw new ApiError({ code: 'BAD_REQUEST', message: 'No valid fields to update.' });
    const [row] = await db.update(table).set(patch).where(eq(table.id, id)).returning();
    writeAudit(env, { action: 'UPDATE', entity: `${entity}s`, entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
    return c.json(row);
  });

  app.delete(`/${entity}s/:id`, async (c) => {
    const env = c.env as Env;
    const db = getDb(env);
    const id = c.req.param('id');
    await getOr404(db, table, id, `${entity} not found.`);
    await db.delete(table).where(eq(table.id, id));
    writeAudit(env, { action: 'DELETE', entity: `${entity}s`, entityId: id, auth: auth(c), req: c.req.raw });
    return c.json({ ok: true });
  });
}

// Services
genCrud({
  entity: 'service', table: schema.services, listOrder: asc(schema.services.order),
  searchCols: [schema.services.title, schema.services.slug, schema.services.shortDescription],
  fields: SERVICE_FIELDS, slugPrefix: 'svc',
  mapInsert: (b) => ({
    slug: b.slug || slugify(b.title || '', 'svc'),
    title: b.title || '',
    shortDescription: b.shortDescription || b.description || '',
    longDescription: b.longDescription || b.description || '',
    icon: b.icon || 'Globe',
    capabilities: Array.isArray(b.capabilities) ? b.capabilities.slice(0, 30) : [],
    relatedProjectIds: Array.isArray(b.relatedProjectIds) ? b.relatedProjectIds.slice(0, 30) : [],
    isPublished: !!b.isPublished, isFeatured: !!b.isFeatured,
    order: Number.isInteger(b.order) ? b.order : 0,
    seoTitle: b.seoTitle || null, seoDescription: b.seoDescription || null, seoOgImage: b.seoOgImage || null,
  }),
});

// Projects
genCrud({
  entity: 'project', table: schema.projects, listOrder: desc(schema.projects.createdAt),
  searchCols: [schema.projects.title, schema.projects.slug, schema.projects.clientName],
  fields: PROJECT_FIELDS, slugPrefix: 'prj',
  mapInsert: (b) => ({
    slug: b.slug || slugify(b.title || '', 'prj'),
    title: b.title || '', clientName: b.clientName || null, clientLogo: b.clientLogo || null, role: b.role || null,
    platform: b.platform || null, framework: b.framework || null,
    completionDate: b.completionDate || null,
    status: b.status || 'ACTIVE',
    coverImage: b.coverImage || null, gallery: Array.isArray(b.gallery) ? b.gallery.slice(0, 50) : [], videoUrl: b.videoUrl || null,
    challenge: b.challenge || null, objective: b.objective || null, solution: b.solution || null,
    features: Array.isArray(b.features) ? b.features.slice(0, 50) : [],
    process: Array.isArray(b.process) ? b.process.slice(0, 30) : [],
    results: b.results || null,
    metrics: Array.isArray(b.metrics) ? b.metrics.slice(0, 30) : [],
    liveUrl: b.liveUrl || null, githubUrl: b.githubUrl || null,
    appStoreUrl: b.appStoreUrl || null, playStoreUrl: b.playStoreUrl || null,
    serviceIds: Array.isArray(b.serviceIds) ? b.serviceIds.slice(0, 30) : [],
    isPublished: !!b.isPublished, isFeatured: !!b.isFeatured,
    hasClientPermission: !!b.hasClientPermission,
    order: Number.isInteger(b.order) ? b.order : 0,
    seoTitle: b.seoTitle || null, seoDescription: b.seoDescription || null, seoOgImage: b.seoOgImage || null,
  }),
});

// FAQs
genCrud({
  entity: 'faq', table: schema.faqs, listOrder: asc(schema.faqs.order),
  searchCols: [schema.faqs.question, schema.faqs.answer],
  fields: FAQ_FIELDS,
  mapInsert: (b) => ({
    question: b.question || '', answer: b.answer || '',
    category: b.category || 'General',
    order: Number.isInteger(b.order) ? b.order : 0,
    isPublished: b.isPublished !== false,
  }),
});

// Testimonials
genCrud({
  entity: 'testimonial', table: schema.testimonials, listOrder: asc(schema.testimonials.order),
  searchCols: [schema.testimonials.name, schema.testimonials.company, schema.testimonials.testimonial],
  fields: TESTIMONIAL_FIELDS,
  mapInsert: (b) => ({
    name: b.name || '', role: b.role || null, company: b.company || null, photo: b.photo || null,
    testimonial: b.testimonial || '', relatedProjectId: b.relatedProjectId || null,
    isFeatured: !!b.isFeatured, isPublished: b.isPublished !== false,
    order: Number.isInteger(b.order) ? b.order : 0,
  }),
});

// Insights (override list to include status filter + isPublished mapping)
const insightList = app.get('/insights', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const status = url.searchParams.get('status') || 'all';
  const w = combine(
    searchLike(q, [schema.insights.title, schema.insights.excerpt, schema.insights.content]),
    status === 'published' ? eq(schema.insights.isDraft, false) : status === 'draft' ? eq(schema.insights.isDraft, true) : undefined,
  );
  const { items, total } = await counted(db, schema.insights, w, desc(schema.insights.createdAt));
  return c.json({ items: items.map((i: any) => ({ ...i, isPublished: !i.isDraft })), total });
});
// Attach standard CRUD for insights manually (slug/booleans)
app.get('/insights/:id', async (c) => {
  const db = getDb(c.env as Env);
  const row = await getOr404(db, schema.insights, c.req.param('id'), 'Insight not found.');
  return c.json({ ...(row as any), isPublished: !(row as any).isDraft });
});
app.post('/insights', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const [row] = await db.insert(schema.insights).values({
    id: uid(),
    slug: b.slug || slugify(b.title || '', 'ins'),
    title: b.title || '', excerpt: b.excerpt || '', coverImage: b.coverImage || null,
    content: b.content || '', author: b.author || null,
    category: b.category || 'Technology', tags: Array.isArray(b.tags) ? b.tags.slice(0, 30) : [],
    publishDate: b.publishDate || null,
    seoTitle: b.seoTitle || null, seoDescription: b.seoDescription || null, seoOgImage: b.seoOgImage || null,
    isFeatured: !!b.isFeatured, isDraft: b.isDraft !== false,
  }).returning();
  writeAudit(env, { action: 'CREATE', entity: 'insights', entityId: row.id, auth: auth(c), req: c.req.raw });
  return c.json(row, 201);
});
app.put('/insights/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.insights, id, 'Insight not found.');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = { ...pick(b, INSIGHT_FIELDS), updatedAt: now() };
  const [row] = await db.update(schema.insights).set(patch).where(eq(schema.insights.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'insights', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
  return c.json(row);
});
app.delete('/insights/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.insights, id, 'Insight not found.');
  await db.delete(schema.insights).where(eq(schema.insights.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'insights', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

// Pricing
genCrud({
  entity: 'pricing', table: schema.pricingPlans, listOrder: asc(schema.pricingPlans.order),
  searchCols: [schema.pricingPlans.name, schema.pricingPlans.tagline],
  fields: PRICING_FIELDS,
  mapInsert: (b) => ({
    name: b.name || '', tagline: b.tagline || null,
    priceMonthly: b.priceMonthly ?? null, priceOneTime: b.priceOneTime ?? null,
    currency: b.currency || 'USD',
    features: Array.isArray(b.features) ? b.features.slice(0, 40) : [],
    ctaLabel: b.ctaLabel || 'Start a project', ctaUrl: b.ctaUrl || null,
    isFeatured: !!b.isFeatured, isPublished: b.isPublished !== false,
    order: Number.isInteger(b.order) ? b.order : 0,
  }),
});

// Products
genCrud({
  entity: 'product', table: schema.products, listOrder: desc(schema.products.createdAt),
  searchCols: [schema.products.name, schema.products.description, schema.products.slug],
  fields: PRODUCT_FIELDS, slugPrefix: 'prod',
  mapInsert: (b) => ({
    slug: b.slug || slugify(b.name || '', 'prod'),
    name: b.name || '', description: b.description || null, logo: b.logo || null,
    screenshots: Array.isArray(b.screenshots) ? b.screenshots.slice(0, 30) : [],
    features: Array.isArray(b.features) ? b.features.slice(0, 50) : [],
    techStack: Array.isArray(b.techStack) ? b.techStack.slice(0, 30) : [],
    status: b.status || 'IDEA',
    demoUrl: b.demoUrl || null, websiteUrl: b.websiteUrl || null, caseStudyUrl: b.caseStudyUrl || null,
    isPublished: !!b.isPublished, order: Number.isInteger(b.order) ? b.order : 0,
  }),
});

// ---------- Leads ----------
app.get('/leads', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const source = url.searchParams.get('source') || undefined;
  const assigned = url.searchParams.get('assigned') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const offset = (page - 1) * limit;
  const w = combine(
    q ? or(like(schema.leads.name, `%${q}%`), like(schema.leads.email, `%${q}%`), like(schema.leads.company, `%${q}%`), like(schema.leads.ref, `%${q}%`)) : undefined,
    status ? eq(schema.leads.status, status.toUpperCase() as any) : undefined,
    source ? eq(schema.leads.source, source) : undefined,
    assigned ? eq(schema.leads.assignedTo, assigned === 'me' ? (auth(c) as any).uid : assigned) : undefined,
  );
  const [cntRow] = await db.select({ c: count() }).from(schema.leads).where(w);
  const items = await db.select().from(schema.leads).where(w).orderBy(desc(schema.leads.createdAt)).limit(limit).offset(offset);
  return c.json({ items, total: Number(cntRow.c), page, limit, totalPages: Math.ceil(Number(cntRow.c) / limit) });
});
app.get('/leads/:id', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  const [row] = await db.select().from(schema.leads)
    .where(or(eq(schema.leads.id, id), eq(schema.leads.ref, id))).limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Lead not found.' });
  return c.json(row);
});
app.post('/leads', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const name = sanitizeStr(b.name, 160);
  const email = sanitizeStr(b.email, 240);
  if (!name) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Name is required.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'A valid email is required.' });
  // Generate ref.
  const recent = await db.select({ ref: schema.leads.ref }).from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(50);
  let maxN = 1000;
  for (const r of recent) { const m = String(r.ref).match(/TT-(\d+)/); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); }
  const ref = `TT-${maxN + 1}`;
  const [row] = await db.insert(schema.leads).values({
    id: uid(), ref, name, email,
    phone: sanitizeStr(b.phone, 40), company: sanitizeStr(b.company, 180),
    services: Array.isArray(b.services) ? b.services.filter((s: any) => typeof s === 'string').slice(0, 10) : [],
    requirements: sanitizeStr(b.requirements, 4000),
    budget: sanitizeStr(b.budget, 80), timeline: sanitizeStr(b.timeline, 80),
    source: sanitizeStr(b.source, 80) || 'manual',
    sourcePage: sanitizeStr(b.sourcePage, 300), aiRef: sanitizeStr(b.aiRef, 64),
    assignedTo: sanitizeStr(b.assignedTo, 128),
    notes: sanitizeStr(b.notes, 8000),
    status: (b.status || 'NEW').toUpperCase(),
    followUpDate: b.followUpDate || null,
    convertedClientId: b.convertedClientId || null,
  }).returning();
  writeAudit(env, { action: 'CREATE', entity: 'leads', entityId: row.id, auth: auth(c), req: c.req.raw, meta: { ref, source: row.source } });
  return c.json(row, 201);
});
app.put('/leads/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.leads, id, 'Lead not found.');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = { ...pick(b, LEAD_FIELDS), updatedAt: now() };
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  const [row] = await db.update(schema.leads).set(patch).where(eq(schema.leads.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'leads', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
  return c.json(row);
});
app.patch('/leads/:id/status', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  const lead = await getOr404(db, schema.leads, id, 'Lead not found.');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const next = String(b.status || '').toUpperCase();
  const allowed = ['NEW','CONTACTED','QUALIFIED','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST','ARCHIVED'];
  if (!allowed.includes(next)) throw new ApiError({ code: 'VALIDATION_ERROR', message: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  const a = auth(c);
  const patch: any = { status: next, updatedAt: now() };
  if (next === 'CONTACTED') patch.lastContactedAt = now();
  const [row] = await db.update(schema.leads).set(patch).where(eq(schema.leads.id, id)).returning();
  await db.insert(schema.leadNotes).values({
    id: uid(), leadId: id, authorType: 'admin', authorId: a.uid, authorName: a.name || a.email,
    type: 'status_change',
    body: b.note ? `Status changed ${lead.status} → ${next}. ${String(b.note).slice(0, 2000)}` : `Status changed ${lead.status} → ${next}.`,
    meta: { from: lead.status, to: next },
  });
  writeAudit(env, { action: 'UPDATE', entity: 'leads', entityId: id, auth: a, req: c.req.raw, meta: { statusChange: { from: lead.status, to: next } } });
  return c.json(row);
});
app.get('/leads/:id/notes', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  await getOr404(db, schema.leads, id, 'Lead not found.');
  const notes = await db.select().from(schema.leadNotes)
    .where(eq(schema.leadNotes.leadId, id)).orderBy(desc(schema.leadNotes.createdAt));
  return c.json({ items: notes, total: notes.length });
});
app.post('/leads/:id/notes', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.leads, id, 'Lead not found.');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const body = sanitizeStr(b.body, 8000);
  if (!body) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Note body is required.' });
  const a = auth(c);
  const [row] = await db.insert(schema.leadNotes).values({
    id: uid(), leadId: id, authorType: 'admin', authorId: a.uid, authorName: a.name || a.email,
    type: sanitizeStr(b.type, 30) || 'note', body,
    meta: b.meta && typeof b.meta === 'object' ? b.meta : {},
  }).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'leads', entityId: id, auth: a, req: c.req.raw, meta: { note: true, type: row.type } });
  return c.json(row, 201);
});
app.post('/leads/:id/convert', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const lead = await getOr404(db, schema.leads, id, 'Lead not found.');
  if (lead.convertedClientId) throw new ApiError({ code: 'CONFLICT', message: 'This lead has already been converted to a client.' });
  const email = (lead.email || '').toLowerCase().trim();
  if (!email) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Lead must have an email to convert.' });
  let [existing] = await db.select().from(schema.clients).where(eq(schema.clients.email, email)).limit(1);
  let client: any;
  if (existing && b.allowMerge !== false) { client = existing; }
  else {
    const accessCode = generateAccessCode();
    const [newClient] = await db.insert(schema.clients).values({
      id: uid(), userId: null, name: lead.name || b.name || 'Client', email,
      phone: lead.phone || null, company: lead.company || null,
      status: 'ACTIVE', accessCode,
    }).returning();
    client = newClient;
    writeAudit(env, { action: 'CREATE', entity: 'clients', entityId: client.id, auth: auth(c), req: c.req.raw, meta: { fromLead: lead.ref } });
  }
  await db.update(schema.leads).set({ status: 'WON', convertedClientId: client.id, convertedAt: now(), updatedAt: now() }).where(eq(schema.leads.id, id));
  await db.insert(schema.leadNotes).values({
    id: uid(), leadId: id, authorType: 'system', authorName: 'System', type: 'status_change',
    body: existing ? `Linked to existing client ${client.name} (${client.email}). Status set to WON.` : `Converted to new client ${client.name} (${client.email}). Status set to WON.`,
    meta: { clientId: client.id, merged: !!existing },
  });
  writeAudit(env, { action: 'LEAD_CONVERT', entity: 'leads', entityId: id, auth: auth(c), req: c.req.raw, meta: { clientId: client.id, merged: !!existing } });
  return c.json({ success: true, data: { client, status: 'WON' } });
});
app.delete('/leads/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.leads, id, 'Lead not found.');
  // Soft archive (preserve history) instead of hard delete.
  await db.update(schema.leads).set({ status: 'ARCHIVED', updatedAt: now() }).where(eq(schema.leads.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'leads', entityId: id, auth: auth(c), req: c.req.raw, meta: { softArchive: true } });
  return c.json({ ok: true });
});

// ---------- Clients ----------
app.get('/clients', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const w = q ? or(like(schema.clients.name, `%${q}%`), like(schema.clients.email, `%${q}%`), like(schema.clients.company, `%${q}%`)) : undefined;
  const { items, total } = await counted(db, schema.clients, w, desc(schema.clients.createdAt));
  return c.json({ items, total });
});
app.get('/clients/:id', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, id)).limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Client not found.' });
  const projects = await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, row.id));
  return c.json({ ...row, projects });
});
app.post('/clients', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const name = sanitizeStr(b.name, 160);
  const email = sanitizeStr(b.email, 240);
  if (!name || !email) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Name and email are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Invalid email.' });
  // Check duplicate email.
  const [existing] = await db.select().from(schema.clients).where(eq(schema.clients.email, email.toLowerCase())).limit(1);
  if (existing) throw new ApiError({ code: 'CONFLICT', message: 'A client with that email already exists.' });
  const accessCode = generateAccessCode();
  const [row] = await db.insert(schema.clients).values({
    id: uid(),
    userId: b.userId || null,
    name, email: email.toLowerCase(),
    phone: sanitizeStr(b.phone, 40), company: sanitizeStr(b.company, 180),
    status: String(b.status || 'ACTIVE').toUpperCase() as any,
    accessCode,
  }).returning();
  writeAudit(env, { action: 'CREATE', entity: 'clients', entityId: row.id, auth: auth(c), req: c.req.raw, meta: { email: row.email } });
  writeAudit(env, { action: 'ACCESS_CODE_GENERATED', entity: 'clients', entityId: row.id, auth: auth(c), req: c.req.raw });
  return c.json({ ...row, accessCode }, 201);
});
app.put('/clients/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.clients, id, 'Client not found.');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = { ...pick(b, CLIENT_FIELDS), updatedAt: now() };
  if (patch.email) patch.email = patch.email.toLowerCase();
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  const [row] = await db.update(schema.clients).set(patch).where(eq(schema.clients.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'clients', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
  return c.json(row);
});
app.post('/clients/:id/regenerate-code', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.clients, id, 'Client not found.');
  const accessCode = generateAccessCode();
  await db.update(schema.clients).set({ accessCode, updatedAt: now() }).where(eq(schema.clients.id, id));
  writeAudit(env, { action: 'ACCESS_CODE_GENERATED', entity: 'clients', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ success: true, data: { accessCode } });
});
app.delete('/clients/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.clients, id, 'Client not found.');
  // RESTRICT: refuse to delete if client has active projects (until FKs are enforced).
  const [proj] = await db.select({ c: count() }).from(schema.clientProjects)
    .where(and(eq(schema.clientProjects.clientId, id), eq(schema.clientProjects.status, 'ACTIVE')));
  if (Number(proj.c) > 0) throw new ApiError({ code: 'CONFLICT', message: 'Archive or reassign this client\'s active projects before deleting.' });
  await db.delete(schema.clients).where(eq(schema.clients.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'clients', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

// ---------- Client projects (jobs) ----------
app.get('/client-projects', async (c) => {
  const db = getDb(c.env as Env);
  const clientId = new URL(c.req.url).searchParams.get('clientId') || undefined;
  const w = clientId ? eq(schema.clientProjects.clientId, clientId) : undefined;
  const { items, total } = await counted(db, schema.clientProjects, w, desc(schema.clientProjects.createdAt));
  return c.json({ items, total });
});
app.post('/client-projects', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  if (!b.clientId || !b.title) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'clientId and title are required.' });
  // Verify client exists.
  await getOr404(db, schema.clients, b.clientId, 'Client not found.');
  const [row] = await db.insert(schema.clientProjects).values({
    id: uid(),
    clientId: b.clientId, publicProjectId: b.publicProjectId || null,
    title: String(b.title).slice(0, 220),
    description: b.description || null,
    status: String(b.status || 'ACTIVE').toUpperCase() as any,
    progress: Number.isInteger(b.progress) ? Math.max(0, Math.min(100, b.progress)) : 0,
    startDate: b.startDate || null, dueDate: b.dueDate || null,
  }).returning();
  writeAudit(env, { action: 'CREATE', entity: 'client_projects', entityId: row.id, auth: auth(c), req: c.req.raw, meta: { clientId: row.clientId } });
  return c.json(row, 201);
});
app.put('/client-projects/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.clientProjects, id, 'Project not found.');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = { ...pick(b, CP_FIELDS), updatedAt: now() };
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  if (patch.progress != null) patch.progress = Math.max(0, Math.min(100, patch.progress));
  const [row] = await db.update(schema.clientProjects).set(patch).where(eq(schema.clientProjects.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'client_projects', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
  return c.json(row);
});
app.delete('/client-projects/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.clientProjects, id, 'Project not found.');
  await db.delete(schema.clientProjects).where(eq(schema.clientProjects.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'client_projects', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

// Single project detail (includes client snapshot for admin)
app.get('/client-projects/:id', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  const [p] = await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.id, id)).limit(1);
  if (!p) throw new ApiError({ code: 'NOT_FOUND', message: 'Project not found.' });
  const [cl] = p.clientId
    ? await db.select().from(schema.clients).where(eq(schema.clients.id, p.clientId)).limit(1)
    : [null as any];
  return c.json({ item: p, client: cl || null });
});

// ---------- Milestones ----------
app.get('/milestones', async (c) => {
  const db = getDb(c.env as Env);
  const projectId = new URL(c.req.url).searchParams.get('projectId') || undefined;
  const w = projectId ? eq(schema.milestones.projectId, projectId) : undefined;
  const items = await db.select().from(schema.milestones).where(w).orderBy(asc(schema.milestones.order));
  return c.json({ items, total: items.length });
});
app.post('/milestones', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  if (!b.projectId || !b.title) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'projectId and title are required.' });
  await getOr404(db, schema.clientProjects, b.projectId, 'Project not found.');
  const [row] = await db.insert(schema.milestones).values({
    id: uid(), projectId: b.projectId, title: String(b.title).slice(0, 220),
    description: b.description || null, dueDate: b.dueDate || null,
    status: String(b.status || 'PENDING').toUpperCase() as any,
    amountCents: Number.isInteger(b.amountCents) ? b.amountCents : null,
    order: Number.isInteger(b.order) ? b.order : 0,
  }).returning();
  writeAudit(env, { action: 'CREATE', entity: 'milestones', entityId: row.id, auth: auth(c), req: c.req.raw, meta: { projectId: row.projectId } });
  return c.json(row, 201);
});
app.put('/milestones/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.milestones, id, 'Milestone not found.');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = { ...pick(b, MS_FIELDS), updatedAt: now() };
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  const [row] = await db.update(schema.milestones).set(patch).where(eq(schema.milestones.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'milestones', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
  return c.json(row);
});
app.delete('/milestones/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await getOr404(db, schema.milestones, id, 'Milestone not found.');
  await db.delete(schema.milestones).where(eq(schema.milestones.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'milestones', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

// Milestone approval history.
app.get('/milestones/:id/approvals', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  await getOr404(db, schema.milestones, id, 'Milestone not found.');
  const items = await db.select().from(schema.milestoneApprovals).where(eq(schema.milestoneApprovals.milestoneId, id)).orderBy(desc(schema.milestoneApprovals.createdAt));
  return c.json({ items });
});

// ---------- Tasks ----------
app.get('/tasks', async (c) => {
  const db = getDb(c.env as Env);
  const projectId = new URL(c.req.url).searchParams.get('projectId') || undefined;
  const milestoneId = new URL(c.req.url).searchParams.get('milestoneId') || undefined;
  const w = combine(projectId ? eq(schema.tasks.projectId, projectId) : undefined, milestoneId ? eq(schema.tasks.milestoneId, milestoneId) : undefined);
  const items = await db.select().from(schema.tasks).where(w).orderBy(asc(schema.tasks.createdAt));
  return c.json({ items, total: items.length });
});
app.post('/tasks', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  if (!b.projectId || !b.title) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'projectId and title are required.' });
  await getOr404(db, schema.clientProjects, b.projectId, 'Project not found.');
  if (b.milestoneId) await getOr404(db, schema.milestones, b.milestoneId, 'Milestone not found.');
  const [row] = await db.insert(schema.tasks).values({
    id: uid(), projectId: b.projectId, milestoneId: b.milestoneId || null,
    title: String(b.title).slice(0, 240), description: b.description || null,
    status: String(b.status || 'TODO').toUpperCase() as any,
    priority: String(b.priority || 'MEDIUM').toUpperCase() as any,
    assignee: sanitizeStr(b.assignee, 120), dueDate: b.dueDate || null,
  }).returning();
  writeAudit(env, { action: 'CREATE', entity: 'tasks', entityId: row.id, auth: auth(c), req: c.req.raw, meta: { projectId: row.projectId } });
  return c.json(row, 201);
});
app.put('/tasks/:id', async (c) => {
  const env = c.env as Env; const db = getDb(env); const id = c.req.param('id');
  await getOr404(db, schema.tasks, id, 'Task not found.');
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = { ...pick(b, TASK_FIELDS), updatedAt: now() };
  if (patch.status) {
    patch.status = String(patch.status).toUpperCase();
    if (patch.status === 'DONE') { patch.completedAt = now(); patch.completedBy = auth(c).uid; }
    else { patch.completedAt = null; patch.completedBy = null; }
  }
  if (patch.priority) patch.priority = String(patch.priority).toUpperCase();
  const [row] = await db.update(schema.tasks).set(patch).where(eq(schema.tasks.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'tasks', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
  return c.json(row);
});
app.delete('/tasks/:id', async (c) => {
  const env = c.env as Env; const db = getDb(env); const id = c.req.param('id');
  await getOr404(db, schema.tasks, id, 'Task not found.');
  await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'tasks', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

// ---------- Lab items ----------
genCrud({
  entity: 'lab', table: schema.labItems, listOrder: desc(schema.labItems.createdAt),
  searchCols: [schema.labItems.title, schema.labItems.description, schema.labItems.slug],
  fields: LAB_FIELDS, slugPrefix: 'lab',
  mapInsert: (b) => ({
    slug: b.slug || slugify(b.title || '', 'lab'),
    title: b.title || '', description: b.description || null,
    category: String(b.category || 'EXPERIMENT').toUpperCase(),
    tech: Array.isArray(b.tech) ? b.tech.slice(0, 30) : [],
    demoUrl: b.demoUrl || null,
    status: b.status || 'active',
    screenshots: Array.isArray(b.screenshots) ? b.screenshots.slice(0, 20) : [],
    isPublished: !!b.isPublished,
    publishedAt: b.publishedAt || (b.isPublished ? now() : null),
  }),
});

// ---------- Project files (admin list) ----------
app.get('/projects/:id/files', async (c) => {
  const db = getDb(c.env as Env);
  const pid = c.req.param('id');
  await getOr404(db, schema.clientProjects, pid, 'Project not found.');
  const items = await db.select().from(schema.projectFiles)
    .where(eq(schema.projectFiles.projectId, pid))
    .orderBy(desc(schema.projectFiles.createdAt));
  return c.json({ items, total: items.length });
});

// ---------- Project files (admin upload) ----------
app.post('/projects/:id/files', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  const a = auth(c);
  const pid = c.req.param('id');
  await getOr404(db, schema.clientProjects, pid, 'Project not found.');
  const bucket = env.ASSETS;
  if (!bucket) throw new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Storage not configured.' });
  const contentType = (c.req.header('content-type') || 'application/octet-stream').split(';')[0].trim();
  const contentLengthStr = c.req.header('content-length');
  const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : null;
  const filename = (c.req.query('filename') || 'upload').slice(0, 160);
  const visibility = (c.req.query('visibility') || 'PRIVATE').toUpperCase() === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
  // Re-use r2 lib allowed set & limit
  const { validateUpload, makeKey, limits } = await import('../lib/r2');
  const mimeErr = validateUpload(contentType, contentLength);
  if (mimeErr) throw new ApiError({ code: 'UNSUPPORTED_MEDIA_TYPE', message: mimeErr });
  const key = makeKey(`projects/${pid}/admin`, filename);
  const body = await c.req.raw.arrayBuffer();
  if (body.byteLength > limits.maxBytes) throw new ApiError({ code: 'PAYLOAD_TOO_LARGE', message: 'File too large.' });
  await bucket.put(key, body, { httpMetadata: { contentType } });
  // Soft-delete prior file with same filename if asked
  if (c.req.query('replace')) {
    const [old] = await db.select().from(schema.projectFiles)
      .where(and(eq(schema.projectFiles.projectId, pid), eq(schema.projectFiles.filename, filename), eq(schema.projectFiles.deletedAt, null as any)))
      .limit(1);
    if (old) await db.update(schema.projectFiles).set({ deletedAt: now() as any, updatedAt: now() }).where(eq(schema.projectFiles.id, old.id));
  }
  const [p] = await db.select({ clientId: schema.clientProjects.clientId }).from(schema.clientProjects).where(eq(schema.clientProjects.id, pid)).limit(1);
  const [file] = await db.insert(schema.projectFiles).values({
    id: uid(), projectId: pid, clientId: p.clientId,
    uploadedBy: a.uid, uploadedByRole: 'admin',
    filename, r2Key: key, sizeBytes: body.byteLength, mimeType: contentType,
    visibility: visibility as any,
  }).returning();
  writeAudit(env, { action: 'FILE_UPLOAD', entity: 'project_files', entityId: file.id, auth: a, req: c.req.raw, meta: { sizeBytes: body.byteLength, mimeType: contentType, visibility } });
  // Notify client.
  await db.insert(schema.notifications).values({
    id: uid(), clientId: p.clientId, type: 'file_uploaded',
    title: 'New file shared with you',
    body: `A new file "${filename}" was shared in your project.`,
    link: `/portal/projects/${pid}?tab=files`,
  });
  return c.json(file, 201);
});
app.delete('/projects/:id/files/:fid', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  const fid = c.req.param('fid');
  const [f] = await db.select().from(schema.projectFiles).where(eq(schema.projectFiles.id, fid)).limit(1);
  if (!f || f.projectId !== c.req.param('id')) throw new ApiError({ code: 'NOT_FOUND', message: 'File not found.' });
  // Soft delete (do not destroy R2 so audit trail remains intact).
  await db.update(schema.projectFiles).set({ deletedAt: now() as any, updatedAt: now() }).where(eq(schema.projectFiles.id, fid));
  writeAudit(env, { action: 'FILE_DELETE', entity: 'project_files', entityId: fid, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

// ---------- Project messages (admin) ----------
app.get('/projects/:id/messages', async (c) => {
  const db = getDb(c.env as Env);
  const pid = c.req.param('id');
  await getOr404(db, schema.clientProjects, pid, 'Project not found.');
  const items = await db.select().from(schema.messages)
    .where(and(eq(schema.messages.contextType, 'PROJECT'), eq(schema.messages.contextId, pid)))
    .orderBy(asc(schema.messages.createdAt));
  return c.json({ items, total: items.length });
});
app.post('/projects/:id/messages', async (c) => {
  const env = c.env as Env; const db = getDb(env); const a = auth(c);
  const pid = c.req.param('id');
  const [project] = await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.id, pid)).limit(1);
  if (!project) throw new ApiError({ code: 'NOT_FOUND', message: 'Project not found.' });
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const body = typeof b.body === 'string' ? b.body.trim().slice(0, 4000) : '';
  if (!body) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Message body is required.' });
  const threadId = typeof b.threadId === 'string' && /^[0-9a-f-]{36}$/.test(b.threadId) ? b.threadId : uid();
  const attachments = Array.isArray(b.attachments)
    ? b.attachments.filter((x: any) => x && typeof x.filename === 'string' && typeof x.r2Key === 'string').slice(0, 10).map((x: any) => ({ filename: String(x.filename).slice(0, 200), r2Key: String(x.r2Key).slice(0, 500) }))
    : [];
  const [row] = await db.insert(schema.messages).values({
    id: uid(), contextType: 'PROJECT', contextId: pid, threadId,
    fromUid: a.uid, fromClientId: null, fromName: a.name || a.email,
    toUid: null, toClientId: project.clientId, toName: null,
    isFromClient: false, body, attachments, isRead: false,
  }).returning();
  writeAudit(env, { action: 'MESSAGE_SEND', entity: 'messages', entityId: row.id, auth: a, req: c.req.raw, meta: { projectId: pid } });
  await db.insert(schema.notifications).values({
    id: uid(), clientId: project.clientId, type: 'message_new',
    title: `New message in "${project.title}"`,
    body: body.slice(0, 200),
    link: `/portal/projects/${pid}?tab=messages`,
  });
  return c.json(row, 201);
});

// ---------- Invoices (admin) ----------
app.get('/invoices', async (c) => {
  const db = getDb(c.env as Env);
  const clientId = new URL(c.req.url).searchParams.get('clientId') || undefined;
  const projectId = new URL(c.req.url).searchParams.get('projectId') || undefined;
  const status = new URL(c.req.url).searchParams.get('status') || undefined;
  const w = combine(
    clientId ? eq(schema.invoices.clientId, clientId) : undefined,
    projectId ? eq(schema.invoices.projectId, projectId) : undefined,
    status ? eq(schema.invoices.status, status.toUpperCase()) : undefined,
  );
  const { items, total } = await counted(db, schema.invoices, w, desc(schema.invoices.createdAt));
  return c.json({ items, total });
});
app.get('/invoices/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, c.req.param('id'))).limit(1);
  if (!inv) throw new ApiError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
  const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, inv.id)).orderBy(asc(schema.invoiceItems.order));
  return c.json({ item: inv, items });
});
app.post('/invoices', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  if (!b.clientId) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'clientId is required.' });
  await getOr404(db, schema.clients, b.clientId, 'Client not found.');
  if (b.projectId) await getOr404(db, schema.clientProjects, b.projectId, 'Project not found.');
  // Generate invoice number.
  const [last] = await db.select({ n: schema.invoices.number }).from(schema.invoices).orderBy(desc(schema.invoices.createdAt)).limit(1);
  const n = last?.n ? parseInt(String(last.n).replace(/\D/g, ''), 10) || 0 : 0;
  const number = `INV-${String(n + 1).padStart(5, '0')}`;
  const lineItems: any[] = Array.isArray(b.items) ? b.items : [];
  const subtotal = lineItems.reduce((s: number, li: any) => s + (Number(li.amountCents) || 0), 0);
  const tax = Number.isInteger(b.taxCents) ? b.taxCents : 0;
  const disc = Number.isInteger(b.discountCents) ? b.discountCents : 0;
  const total = Math.max(0, subtotal + tax - disc);
  const [inv] = await db.insert(schema.invoices).values({
    id: uid(), clientId: b.clientId, projectId: b.projectId || null,
    number, subtotalCents: subtotal, taxCents: tax, discountCents: disc,
    amountCents: b.amountCents ?? total,
    currency: b.currency || 'USD',
    status: b.status || 'DRAFT', dueDate: b.dueDate || null, notes: b.notes || null,
    issuedAt: b.status === 'SENT' ? now() : null,
  }).returning();
  for (let i = 0; i < lineItems.length; i++) {
    const li = lineItems[i];
    await db.insert(schema.invoiceItems).values({
      id: uid(), invoiceId: inv.id,
      kind: (String(li.kind || 'CUSTOM').toUpperCase() as any),
      description: String(li.description || '').slice(0, 500) || 'Item',
      quantity: Number(li.quantity) || 1,
      unitPriceCents: Number(li.unitPriceCents) || 0,
      amountCents: Number(li.amountCents) || 0,
      order: i,
    });
  }
  writeAudit(env, { action: 'CREATE', entity: 'invoices', entityId: inv.id, auth: auth(c), req: c.req.raw, meta: { number, status: inv.status } });
  if (inv.status === 'SENT') {
    await db.insert(schema.notifications).values({
      id: uid(), clientId: b.clientId, type: 'invoice_sent',
      title: `New invoice ${number}`,
      body: `An invoice for ${(inv.amountCents / 100).toFixed(2)} ${inv.currency} has been issued.`,
      link: `/portal/invoices/${inv.id}`,
    });
  }
  return c.json(inv, 201);
});
app.put('/invoices/:id/send', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  const id = c.req.param('id');
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1);
  if (!inv) throw new ApiError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
  const [u] = await db.update(schema.invoices).set({ status: 'SENT' as any, issuedAt: now() }).where(eq(schema.invoices.id, id)).returning();
  await db.insert(schema.notifications).values({
    id: uid(), clientId: inv.clientId, type: 'invoice_sent',
    title: `Invoice ${inv.number} sent`,
    body: `An invoice for ${(u.amountCents / 100).toFixed(2)} ${u.currency} is now available.`,
    link: `/portal/invoices/${inv.id}`,
  });
  writeAudit(env, { action: 'INVOICE_SEND', entity: 'invoices', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json(u);
});
app.put('/invoices/:id', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  const id = c.req.param('id');
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1);
  if (!inv) throw new ApiError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
  if (['PAID','CANCELLED','VOID'].includes(inv.status)) {
    throw new ApiError({ code: 'CONFLICT', message: `Cannot edit a ${inv.status} invoice.` });
  }
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = {};
  if (b.notes !== undefined) patch.notes = typeof b.notes === 'string' ? b.notes.slice(0, 2000) : null;
  if (b.dueDate !== undefined) patch.dueDate = b.dueDate || null;
  if (b.status) {
    const s = String(b.status).toUpperCase();
    if (!['DRAFT','SENT','VIEWED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','VOID'].includes(s))
      throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Invalid status.' });
    patch.status = s;
  }
  if (b.currency) patch.currency = String(b.currency).slice(0,3);
  // Recompute line items if provided
  if (Array.isArray(b.items)) {
    const subtotal = b.items.reduce((sum: number, li: any) => sum + (Number(li.amountCents) || 0), 0);
    const tax = Number.isInteger(b.taxCents) ? b.taxCents : (inv.taxCents || 0);
    const disc = Number.isInteger(b.discountCents) ? b.discountCents : (inv.discountCents || 0);
    patch.subtotalCents = subtotal;
    patch.taxCents = tax;
    patch.discountCents = disc;
    patch.amountCents = b.amountCents ?? Math.max(0, subtotal + tax - disc);
    if (Number.isInteger(b.taxCents)) patch.taxCents = b.taxCents;
    if (Number.isInteger(b.discountCents)) patch.discountCents = b.discountCents;
    // Replace line items in a tx-like sequence (delete then insert)
    await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, id));
    for (let i = 0; i < b.items.length; i++) {
      const li = b.items[i];
      await db.insert(schema.invoiceItems).values({
        id: uid(), invoiceId: id,
        kind: String(li.kind || 'CUSTOM').toUpperCase() as any,
        description: String(li.description || '').slice(0, 500) || 'Item',
        quantity: Number(li.quantity) || 1,
        unitPriceCents: Number(li.unitPriceCents) || 0,
        amountCents: Number(li.amountCents) || 0,
        order: i,
      });
    }
  } else {
    if (Number.isInteger(b.taxCents)) patch.taxCents = b.taxCents;
    if (Number.isInteger(b.discountCents)) patch.discountCents = b.discountCents;
  }
  patch.updatedAt = now();
  const [u] = await db.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'invoices', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch) } });
  return c.json(u);
});
app.delete('/invoices/:id', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  const id = c.req.param('id');
  const [inv] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).limit(1);
  if (!inv) throw new ApiError({ code: 'NOT_FOUND', message: 'Invoice not found.' });
  if (inv.status === 'PAID') throw new ApiError({ code: 'CONFLICT', message: 'Cannot delete a paid invoice. Void it instead.' });
  await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, id));
  await db.delete(schema.invoices).where(eq(schema.invoices.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'invoices', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

// Mark client messages as read (admin-side)
app.post('/projects/:id/messages/read', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  const pid = c.req.param('id');
  await getOr404(db, schema.clientProjects, pid, 'Project not found.');
  await db.update(schema.messages)
    .set({ isRead: true, readAt: now() } as any)
    .where(and(
      eq(schema.messages.contextType, 'PROJECT'),
      eq(schema.messages.contextId, pid),
      eq(schema.messages.isFromClient, true),
    ));
  return c.json({ ok: true });
});

// ---------- Site settings ----------
app.get('/settings', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.siteSettings);
  const obj: Record<string, unknown> = {};
  for (const r of rows) obj[r.key] = r.value;
  return c.json(obj);
});
app.put('/settings/:key', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const key = c.req.param('key');
  if (!/^[a-z0-9_-]{1,64}$/i.test(key)) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Invalid setting key.' });
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const value = b.value ?? b;
  const existing = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, key)).limit(1);
  if (existing.length) await db.update(schema.siteSettings).set({ value, updatedAt: now() }).where(eq(schema.siteSettings.key, key));
  else await db.insert(schema.siteSettings).values({ key, value, updatedAt: now() });
  writeAudit(env, { action: key === 'ai_config' ? 'AI_CONFIG_UPDATE' : 'SETTINGS_UPDATE', entity: 'site_settings', entityId: key, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true, key });
});

// ---------- Media ----------
app.get('/media', async (c) => {
  const db = getDb(c.env as Env);
  const { items, total } = await counted(db, schema.media, undefined, desc(schema.media.createdAt));
  return c.json({ items, total });
});
app.delete('/media/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
  if (!row) throw new ApiError({ code: 'NOT_FOUND', message: 'Media not found.' });
  if (row.r2Key) { try { await env.ASSETS.delete(row.r2Key); } catch { /* ignore */ } }
  await db.delete(schema.media).where(eq(schema.media.id, id));
  writeAudit(env, { action: 'FILE_DELETE', entity: 'media', entityId: id, auth: auth(c), req: c.req.raw, meta: { key: row.r2Key } });
  return c.json({ ok: true });
});

// =============================================================
// AI Control
// =============================================================
const SURFACES = ['public', 'admin', 'client', 'planner', 'advisor', 'idea'] as const;
type Surface = typeof SURFACES[number];

app.get('/ai/config', async (c) => {
  const env = c.env as Env;
  const snap = await buildConfigSnapshot(env);
  return c.json({
    surfaces: snap.surfaces,
    staged: snap.staged,
    catalog: Object.fromEntries(Object.entries(MODEL_CATALOG).map(([k, v]) => [k, { id: v.id, label: v.label, contextWindow: v.contextWindow, tools: v.tools, emitsThinking: v.emitsThinking }])),
    provider: env.AI_PROVIDER || 'dahl',
    aiConfigured: !!env.AI_API_KEY,
  });
});

app.get('/ai/models', async (c) => {
  const env = c.env as Env;
  if (!env.AI_API_KEY) return c.json({ models: Object.keys(MODEL_CATALOG), source: 'static' });
  try {
    const res = await fetch('https://inference.dahl.global/v1/models', { headers: { Authorization: `Bearer ${env.AI_API_KEY}` } });
    if (!res.ok) return c.json({ models: Object.keys(MODEL_CATALOG), source: 'static', error: `upstream ${res.status}` });
    const data = await res.json() as any;
    const list = Array.isArray(data?.data) ? data.data.map((m: any) => m.id).filter((id: string) => typeof id === 'string') : Object.keys(MODEL_CATALOG);
    return c.json({ models: list, source: 'dahl' });
  } catch (e) {
    return c.json({ models: Object.keys(MODEL_CATALOG), source: 'static', error: String(e) });
  }
});

app.get('/ai/status', async (c) => {
  const env = c.env as Env;
  if (!env.AI_API_KEY) return c.json({ error: 'AI not configured' }, 503);
  try {
    const res = await fetch('https://inference.dahl.global/v1/status?window=24h', { headers: { Authorization: `Bearer ${env.AI_API_KEY}` } });
    if (!res.ok) return c.json({ error: `upstream ${res.status}` }, 502);
    return c.json(await res.json());
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

app.get('/ai/conversations', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const prefix = url.searchParams.get('prefix') || undefined;
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const w = prefix ? like(schema.assistantSessions.anonId, `${prefix}%`) : undefined;
  const rows = await db.select().from(schema.assistantSessions).where(w).orderBy(desc(schema.assistantSessions.lastMessageAt)).limit(limit);
  return c.json({ items: rows });
});
app.get('/ai/conversations/:id/messages', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  const s = await db.select().from(schema.assistantSessions)
    .where(or(eq(schema.assistantSessions.id, id), eq(schema.assistantSessions.anonId, id))).limit(1);
  if (!s[0]) throw new ApiError({ code: 'NOT_FOUND', message: 'Conversation not found.' });
  const messages = await db.select().from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, s[0].id)).orderBy(asc(schema.assistantMessages.createdAt));
  return c.json({ session: s[0], messages });
});
app.post('/ai/conversations/:id/rename', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  await db.update(schema.assistantSessions).set({ name: String(b.name || '').slice(0, 120) }).where(eq(schema.assistantSessions.id, id));
  writeAudit(env, { action: 'UPDATE', entity: 'assistant_sessions', entityId: id, auth: auth(c), req: c.req.raw, meta: { rename: true } });
  return c.json({ ok: true });
});
app.delete('/ai/conversations/:id', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  const id = c.req.param('id');
  await db.delete(schema.assistantMessages).where(eq(schema.assistantMessages.sessionId, id));
  await db.delete(schema.assistantSessions).where(eq(schema.assistantSessions.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'assistant_sessions', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

app.post('/ai/config', async (c) => {
  const env = c.env as Env;
  const db = getDb(env);
  let b: any;
  try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const surfacesInput = b.surfaces || {};
  const out: Record<string, { primary: string; fallback: string | null; fallbackEnabled: boolean; timeoutMs?: number; maxTokens?: number; toolsEnabled?: string[] }> = {};
  const warnings: string[] = [];
  for (const [surface, cfg] of Object.entries(surfacesInput)) {
    if (!SURFACES.includes(surface as Surface)) { warnings.push(`unknown surface: ${surface}`); continue; }
    const cAny = cfg as any || {};
    const primary = normaliseModelId(cAny.primary || '');
    if (!primary) { warnings.push(`missing primary for ${surface}`); continue; }
    if (!MODEL_CATALOG[primary]) warnings.push(`model "${primary}" not in known catalog for ${surface}.primary (saved anyway)`);
    const fallbackEnabled = cAny.fallbackEnabled !== false;
    let fallback: string | null = null;
    if (fallbackEnabled && cAny.fallback) {
      fallback = normaliseModelId(cAny.fallback);
      if (fallback && !MODEL_CATALOG[fallback]) warnings.push(`model "${fallback}" not in known catalog for ${surface}.fallback (saved anyway)`);
      if (fallback === primary) fallback = null;
    }
    const entry: any = { primary, fallback, fallbackEnabled };
    if (typeof cAny.timeoutMs === 'number') entry.timeoutMs = Math.max(5000, Math.min(120000, cAny.timeoutMs));
    if (typeof cAny.maxTokens === 'number') entry.maxTokens = Math.max(100, Math.min(8000, cAny.maxTokens));
    if (Array.isArray(cAny.toolsEnabled)) entry.toolsEnabled = cAny.toolsEnabled.filter((t: any) => typeof t === 'string');
    out[surface] = entry;
  }
  const existing = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, 'ai_config')).limit(1);
  if (existing.length) await db.update(schema.siteSettings).set({ value: out, updatedAt: now() }).where(eq(schema.siteSettings.key, 'ai_config'));
  else await db.insert(schema.siteSettings).values({ key: 'ai_config', value: out, updatedAt: now() });
  // Immediately invalidate in-memory config cache so subsequent AI requests use the new values.
  invalidateCache();
  writeAudit(env, { action: 'AI_CONFIG_UPDATE', entity: 'site_settings', entityId: 'ai_config', auth: auth(c), req: c.req.raw, meta: { surfaces: Object.keys(out) } });
  return c.json({
    success: true,
    data: { ok: true, warnings, active: true, note: 'Configuration is live. Other Worker isolates will pick it up within 30 seconds.' },
  });
});

// ---------- Phase 2+3: Solutions & Tools ----------
genCrud({
  entity: 'solution', table: schema.solutions, listOrder: asc(schema.solutions.order),
  searchCols: [schema.solutions.title, schema.solutions.slug, schema.solutions.tagline],
  fields: SOLUTION_FIELDS, slugPrefix: 'sol',
  mapInsert: (b) => ({
    slug: b.slug || slugify(b.title || '', 'sol'),
    title: b.title || '', tagline: b.tagline || null, description: b.description || null,
    icon: b.icon || 'Globe',
    features: Array.isArray(b.features) ? b.features.slice(0, 40) : [],
    benefits: Array.isArray(b.benefits) ? b.benefits.slice(0, 40) : [],
    imageUrl: b.imageUrl || null,
    relatedServiceIds: Array.isArray(b.relatedServiceIds) ? b.relatedServiceIds.slice(0, 30) : [],
    ctaLabel: b.ctaLabel || 'Learn more', ctaUrl: b.ctaUrl || null,
    isPublished: !!b.isPublished, isFeatured: !!b.isFeatured,
    order: Number.isInteger(b.order) ? b.order : 0,
    seoTitle: b.seoTitle || null, seoDescription: b.seoDescription || null,
  }),
});

app.get('/tools', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const cat = url.searchParams.get('category') || undefined;
  const w = combine(
    q ? or(like(schema.tools.name, `%${q}%`), like(schema.tools.description as any, `%${q}%`)) : undefined,
    cat ? eq(schema.tools.category, cat) : undefined,
  );
  const { items, total } = await counted(db, schema.tools, w, asc(schema.tools.order));
  return c.json({ items, total });
});
app.get('/tools/:id', async (c) => {
  const db = getDb(c.env as Env);
  return c.json(await getOr404(db, schema.tools, c.req.param('id'), 'Tool not found.'));
});
app.post('/tools', async (c) => {
  const env = c.env as Env; const db = getDb(env);
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const name = sanitizeStr(b.name, 120);
  if (!name) throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Tool name is required.' });
  const [dup] = await db.select().from(schema.tools).where(eq(schema.tools.name, name)).limit(1);
  if (dup) throw new ApiError({ code: 'CONFLICT', message: 'A tool with that name already exists.' });
  const [row] = await db.insert(schema.tools).values({
    id: uid(), name, category: sanitizeStr(b.category, 40) || 'Development',
    logoUrl: sanitizeStr(b.logoUrl, 500), description: sanitizeStr(b.description, 2000),
    websiteUrl: sanitizeStr(b.websiteUrl, 500),
    isPublished: b.isPublished !== false, order: Number.isInteger(b.order) ? b.order : 0,
  }).returning();
  writeAudit(env, { action: 'CREATE', entity: 'tools', entityId: row.id, auth: auth(c), req: c.req.raw });
  return c.json(row, 201);
});
app.put('/tools/:id', async (c) => {
  const env = c.env as Env; const db = getDb(env); const id = c.req.param('id');
  await getOr404(db, schema.tools, id, 'Tool not found.');
  let b: any; try { b = await c.req.json(); } catch { throw new ApiError({ code: 'BAD_REQUEST', message: 'Invalid JSON.' }); }
  const patch: any = { ...pick(b, TOOL_FIELDS), updatedAt: now() };
  if (patch.name) {
    patch.name = String(patch.name).trim().slice(0, 120);
    const [dup] = await db.select().from(schema.tools).where(eq(schema.tools.name, patch.name)).limit(1);
    if (dup && dup.id !== id) throw new ApiError({ code: 'CONFLICT', message: 'A tool with that name already exists.' });
  }
  const [row] = await db.update(schema.tools).set(patch).where(eq(schema.tools.id, id)).returning();
  writeAudit(env, { action: 'UPDATE', entity: 'tools', entityId: id, auth: auth(c), req: c.req.raw, meta: { changed: Object.keys(patch).filter(k => k !== 'updatedAt') } });
  return c.json(row);
});
app.delete('/tools/:id', async (c) => {
  const env = c.env as Env; const db = getDb(env); const id = c.req.param('id');
  await getOr404(db, schema.tools, id, 'Tool not found.');
  await db.delete(schema.tools).where(eq(schema.tools.id, id));
  writeAudit(env, { action: 'DELETE', entity: 'tools', entityId: id, auth: auth(c), req: c.req.raw });
  return c.json({ ok: true });
});

export default app;
