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
 */
import { Hono } from 'hono';
import { eq, desc, asc, like, or, and, count } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';
import { authAdmin } from '../lib/auth';
import { normaliseModelId, MODEL_CATALOG } from '../ai/models';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  try { await authAdmin(c.req.raw, c.env as Env); }
  catch { return c.json({ error: 'Unauthorized' }, 401); }
  await next();
});

// ---------- helpers ----------
type DB = ReturnType<typeof getDb>;
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
async function counted(db: DB, table: any, where: any, orderBy: any, limit = 200) {
  const [cnt] = await db.select({ c: count() }).from(table).where(where);
  const items = await db.select().from(table).where(where).orderBy(orderBy).limit(limit);
  return { items, total: Number(cnt.c) };
}
const uid = () => crypto.randomUUID();
const now = () => new Date();
function pubCond(table: any, pub: string | null) {
  if (pub === 'published') return eq(table.isPublished, true);
  if (pub === 'draft') return eq(table.isPublished, false);
  return undefined;
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

// ---------- Services ----------
app.get('/services', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const pub = url.searchParams.get('published');
  const w = combine(searchLike(q, [schema.services.title, schema.services.slug]), pubCond(schema.services, pub));
  const { items, total } = await counted(db, schema.services, w, asc(schema.services.order));
  return c.json({ items, total });
});
app.get('/services/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.services).where(eq(schema.services.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.post('/services', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const slug = b.slug || String(b.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'svc-'+uid().slice(0,6));
  const [row] = await db.insert(schema.services).values({
    id: uid(), slug, title: b.title || '', shortDescription: b.shortDescription || b.description || '',
    longDescription: b.longDescription || b.description || '', icon: b.icon || 'Globe',
    capabilities: b.capabilities || [], relatedProjectIds: b.relatedProjectIds || [],
    isPublished: !!b.isPublished, isFeatured: !!b.isFeatured, order: b.order ?? 0,
    seoTitle: b.seoTitle || null, seoDescription: b.seoDescription || null, seoOgImage: b.seoOgImage || null,
  }).returning();
  return c.json(row, 201);
});
app.put('/services/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.update(schema.services).set({ ...b, updatedAt: now() }).where(eq(schema.services.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/services/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.services).where(eq(schema.services.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- Projects ----------
app.get('/projects', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const pub = url.searchParams.get('published');
  const w = combine(searchLike(q, [schema.projects.title, schema.projects.slug, schema.projects.clientName]), pubCond(schema.projects, pub));
  const { items, total } = await counted(db, schema.projects, w, desc(schema.projects.createdAt));
  return c.json({ items, total });
});
app.get('/projects/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.projects).where(eq(schema.projects.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.post('/projects', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const slug = b.slug || String(b.title || 'prj').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'prj-'+uid().slice(0,6));
  const [row] = await db.insert(schema.projects).values({
    id: uid(), slug, title: b.title || '', clientName: b.clientName || null, role: b.role || null,
    platform: b.platform || null, framework: b.framework || null,
    completionDate: b.completionDate || null, status: b.status || 'ACTIVE',
    coverImage: b.coverImage || null, gallery: b.gallery || [], videoUrl: b.videoUrl || null,
    challenge: b.challenge || null, objective: b.objective || null, solution: b.solution || null,
    features: b.features || [], process: b.process || [], results: b.results || null, metrics: b.metrics || [],
    liveUrl: b.liveUrl || null, githubUrl: b.githubUrl || null,
    appStoreUrl: b.appStoreUrl || null, playStoreUrl: b.playStoreUrl || null,
    serviceIds: b.serviceIds || [], isPublished: !!b.isPublished, isFeatured: !!b.isFeatured,
    hasClientPermission: !!b.hasClientPermission, order: b.order ?? 0,
    seoTitle: b.seoTitle || null, seoDescription: b.seoDescription || null, seoOgImage: b.seoOgImage || null,
  }).returning();
  return c.json(row, 201);
});
app.put('/projects/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.update(schema.projects).set({ ...b, updatedAt: now() }).where(eq(schema.projects.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/projects/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.projects).where(eq(schema.projects.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- FAQs ----------
app.get('/faqs', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const pub = url.searchParams.get('published');
  const cat = url.searchParams.get('category') || undefined;
  const w = combine(searchLike(q, [schema.faqs.question, schema.faqs.answer]), pubCond(schema.faqs, pub), cat ? eq(schema.faqs.category, cat) : undefined);
  const { items, total } = await counted(db, schema.faqs, w, asc(schema.faqs.order));
  return c.json({ items, total });
});
app.get('/faqs/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.faqs).where(eq(schema.faqs.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.post('/faqs', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.insert(schema.faqs).values({
    id: uid(), question: b.question || '', answer: b.answer || '',
    category: b.category || 'General', order: b.order ?? 0, isPublished: b.isPublished !== false,
  }).returning();
  return c.json(row, 201);
});
app.put('/faqs/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.update(schema.faqs).set(b).where(eq(schema.faqs.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/faqs/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.faqs).where(eq(schema.faqs.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- Testimonials ----------
app.get('/testimonials', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const pub = url.searchParams.get('published');
  const w = combine(searchLike(q, [schema.testimonials.name, schema.testimonials.company, schema.testimonials.testimonial]), pubCond(schema.testimonials, pub));
  const { items, total } = await counted(db, schema.testimonials, w, asc(schema.testimonials.order));
  return c.json({ items, total });
});
app.get('/testimonials/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.testimonials).where(eq(schema.testimonials.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.post('/testimonials', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.insert(schema.testimonials).values({
    id: uid(), name: b.name || '', role: b.role || null, company: b.company || null, photo: b.photo || null,
    testimonial: b.testimonial || '', relatedProjectId: b.relatedProjectId || null,
    isFeatured: !!b.isFeatured, isPublished: b.isPublished !== false, order: b.order ?? 0,
  }).returning();
  return c.json(row, 201);
});
app.put('/testimonials/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.update(schema.testimonials).set(b).where(eq(schema.testimonials.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/testimonials/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.testimonials).where(eq(schema.testimonials.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- Insights ----------
app.get('/insights', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const status = url.searchParams.get('status') || 'all'; // all|published|draft
  const w = combine(
    searchLike(q, [schema.insights.title, schema.insights.excerpt, schema.insights.content]),
    status === 'published' ? eq(schema.insights.isDraft, false) : status === 'draft' ? eq(schema.insights.isDraft, true) : undefined,
  );
  const { items, total } = await counted(db, schema.insights, w, desc(schema.insights.createdAt));
  return c.json({ items: items.map((i: any) => ({ ...i, isPublished: !i.isDraft })), total });
});
app.get('/insights/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.insights).where(eq(schema.insights.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ ...row, isPublished: !(row as any).isDraft });
});
app.post('/insights', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const slug = b.slug || String(b.title || 'insight').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'ins-'+uid().slice(0,6));
  const [row] = await db.insert(schema.insights).values({
    id: uid(), slug, title: b.title || '', excerpt: b.excerpt || '', coverImage: b.coverImage || null,
    content: b.content || '', author: b.author || null, category: b.category || 'Technology',
    tags: b.tags || [], publishDate: b.publishDate || null,
    seoTitle: b.seoTitle || null, seoDescription: b.seoDescription || null, seoOgImage: b.seoOgImage || null,
    isFeatured: !!b.isFeatured, isDraft: b.isDraft !== false,
  }).returning();
  return c.json(row, 201);
});
app.put('/insights/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.update(schema.insights).set({ ...b, updatedAt: now() }).where(eq(schema.insights.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/insights/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.insights).where(eq(schema.insights.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- Pricing ----------
app.get('/pricing', async (c) => {
  const db = getDb(c.env as Env);
  const items = await db.select().from(schema.pricingPlans).orderBy(asc(schema.pricingPlans.order));
  return c.json({ items, total: items.length });
});
app.get('/pricing/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.pricingPlans).where(eq(schema.pricingPlans.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.post('/pricing', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.insert(schema.pricingPlans).values({
    id: uid(), name: b.name || '', tagline: b.tagline || null,
    priceMonthly: b.priceMonthly ?? null, priceOneTime: b.priceOneTime ?? null,
    currency: b.currency || 'USD', features: b.features || [],
    ctaLabel: b.ctaLabel || 'Start a project', ctaUrl: b.ctaUrl || null,
    isFeatured: !!b.isFeatured, isPublished: b.isPublished !== false, order: b.order ?? 0,
  }).returning();
  return c.json(row, 201);
});
app.put('/pricing/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.update(schema.pricingPlans).set(b).where(eq(schema.pricingPlans.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/pricing/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.pricingPlans).where(eq(schema.pricingPlans.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- Products ----------
app.get('/products', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const pub = url.searchParams.get('published');
  const w = combine(searchLike(q, [schema.products.name, schema.products.description, schema.products.slug]), pubCond(schema.products, pub));
  const { items, total } = await counted(db, schema.products, w, desc(schema.products.createdAt));
  return c.json({ items, total });
});
app.get('/products/:id', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.post('/products', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const slug = b.slug || String(b.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'prod-'+uid().slice(0,6));
  const [row] = await db.insert(schema.products).values({
    id: uid(), slug, name: b.name || '', description: b.description || null,
    logo: b.logo || null, screenshots: b.screenshots || [], features: b.features || [],
    techStack: b.techStack || [], status: b.status || 'IDEA',
    demoUrl: b.demoUrl || null, websiteUrl: b.websiteUrl || null, caseStudyUrl: b.caseStudyUrl || null,
    isPublished: !!b.isPublished, order: b.order ?? 0,
  }).returning();
  return c.json(row, 201);
});
app.put('/products/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.update(schema.products).set({ ...b, updatedAt: now() }).where(eq(schema.products.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/products/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.products).where(eq(schema.products.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- Leads ----------
app.get('/leads', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const q = url.searchParams.get('q') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const source = url.searchParams.get('source') || undefined;
  const w = combine(
    q ? or(like(schema.leads.name, `%${q}%`), like(schema.leads.email, `%${q}%`), like(schema.leads.company, `%${q}%`), like(schema.leads.ref, `%${q}%`)) : undefined,
    status ? eq(schema.leads.status, status.toUpperCase() as any) : undefined,
    source ? eq(schema.leads.source, source) : undefined,
  );
  const { items, total } = await counted(db, schema.leads, w, desc(schema.leads.createdAt));
  return c.json({ items, total });
});
app.get('/leads/:id', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  const [row] = await db.select().from(schema.leads)
    .where(or(eq(schema.leads.id, id), eq(schema.leads.ref, id))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.post('/leads', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const id = uid();
  const recent = await db.select({ ref: schema.leads.ref }).from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(50);
  let maxN = 1000;
  for (const r of recent) { const m = String(r.ref).match(/TT-(\d+)/); if (m) maxN = Math.max(maxN, parseInt(m[1], 10)); }
  const ref = `TT-${maxN + 1}`;
  const [row] = await db.insert(schema.leads).values({
    id, ref, name: b.name || '', email: b.email || '', phone: b.phone || null,
    company: b.company || null, services: b.services || [], requirements: b.requirements || null,
    budget: b.budget || null, timeline: b.timeline || null, source: b.source || 'manual',
    notes: b.notes || null, status: (b.status || 'NEW').toUpperCase(),
    followUpDate: b.followUpDate || null, convertedClientId: b.convertedClientId || null,
  }).returning();
  return c.json(row, 201);
});
app.put('/leads/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const patch: any = { ...b, updatedAt: now() };
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  const [row] = await db.update(schema.leads).set(patch).where(eq(schema.leads.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/leads/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.leads).where(eq(schema.leads.id, c.req.param('id')));
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
  const [row] = await db.select().from(schema.clients).where(eq(schema.clients.id, c.req.param('id'))).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const projects = await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, row.id));
  return c.json({ ...row, projects });
});
app.post('/clients', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const id = uid();
  const accessCode = b.accessCode || Math.random().toString(36).slice(2, 8).toUpperCase();
  const [row] = await db.insert(schema.clients).values({
    id, userId: b.userId || null, name: b.name || '', email: b.email || '',
    phone: b.phone || null, company: b.company || null, status: String(b.status || 'ACTIVE').toUpperCase() as any,
  }).returning();
  return c.json({ ...row, accessCode }, 201);
});
app.put('/clients/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const patch: any = { ...b, updatedAt: now() };
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  const [row] = await db.update(schema.clients).set(patch).where(eq(schema.clients.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/clients/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.clients).where(eq(schema.clients.id, c.req.param('id')));
  return c.json({ ok: true });
});

// ---------- Client Projects (Jobs) ----------
app.get('/client-projects', async (c) => {
  const db = getDb(c.env as Env);
  const clientId = new URL(c.req.url).searchParams.get('clientId') || undefined;
  const w = clientId ? eq(schema.clientProjects.clientId, clientId) : undefined;
  const { items, total } = await counted(db, schema.clientProjects, w, desc(schema.clientProjects.createdAt));
  return c.json({ items, total });
});
app.post('/client-projects', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.insert(schema.clientProjects).values({
    id: uid(), clientId: b.clientId, title: b.title || '', description: b.description || null,
    status: String(b.status || 'ACTIVE').toUpperCase() as any, progress: b.progress ?? 0,
    startDate: b.startDate || null, dueDate: b.dueDate || null,
  }).returning();
  return c.json(row, 201);
});
app.put('/client-projects/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const patch: any = { ...b, updatedAt: now() };
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  const [row] = await db.update(schema.clientProjects).set(patch).where(eq(schema.clientProjects.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/client-projects/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.clientProjects).where(eq(schema.clientProjects.id, c.req.param('id')));
  return c.json({ ok: true });
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
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const [row] = await db.insert(schema.milestones).values({
    id: uid(), projectId: b.projectId, title: b.title || '', description: b.description || null,
    dueDate: b.dueDate || null, status: String(b.status || 'PENDING').toUpperCase() as any, order: b.order ?? 0,
  }).returning();
  return c.json(row, 201);
});
app.put('/milestones/:id', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as any;
  const patch: any = { ...b, updatedAt: now() };
  if (patch.status) patch.status = String(patch.status).toUpperCase();
  const [row] = await db.update(schema.milestones).set(patch).where(eq(schema.milestones.id, c.req.param('id'))).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});
app.delete('/milestones/:id', async (c) => {
  const db = getDb(c.env as Env);
  await db.delete(schema.milestones).where(eq(schema.milestones.id, c.req.param('id')));
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
  const db = getDb(c.env as Env);
  const key = c.req.param('key');
  const b = await c.req.json() as any;
  const value = b.value ?? b;
  const existing = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, key)).limit(1);
  if (existing.length) await db.update(schema.siteSettings).set({ value, updatedAt: now() }).where(eq(schema.siteSettings.key, key));
  else await db.insert(schema.siteSettings).values({ key, value, updatedAt: now() });
  return c.json({ ok: true, key });
});

// ---------- Media ----------
app.get('/media', async (c) => {
  const db = getDb(c.env as Env);
  const { items, total } = await counted(db, schema.media, undefined, desc(schema.media.createdAt));
  return c.json({ items, total });
});
app.delete('/media/:id', async (c) => {
  const db = getDb(c.env as Env);
  const env = c.env as Env;
  const [row] = await db.select().from(schema.media).where(eq(schema.media.id, c.req.param('id'))).limit(1);
  if (row?.r2Key) { try { await env.ASSETS.delete(row.r2Key); } catch { /* ignore */ } }
  await db.delete(schema.media).where(eq(schema.media.id, c.req.param('id')));
  return c.json({ ok: true });
});

// =============================================================
// AI Control
// =============================================================
const SURFACES = ['public', 'admin', 'client', 'planner', 'advisor', 'idea'] as const;
type Surface = typeof SURFACES[number];
const SURF_KEYS: Record<Surface, { primary: string; fallback: string; enabled: string }> = {
  public:  { primary: 'AI_MODEL_PUBLIC',   fallback: 'AI_MODEL_FALLBACK_PUBLIC',  enabled: 'AI_FALLBACK_PUBLIC_ENABLED' },
  admin:   { primary: 'AI_MODEL_REASONING',fallback: 'AI_MODEL_FALLBACK_ADMIN',   enabled: 'AI_FALLBACK_ADMIN_ENABLED' },
  client:  { primary: 'AI_MODEL_CLIENT',   fallback: 'AI_MODEL_FALLBACK_CLIENT',  enabled: 'AI_FALLBACK_CLIENT_ENABLED' },
  planner: { primary: 'AI_MODEL_PLANNER',  fallback: 'AI_MODEL_FALLBACK_PLANNER', enabled: 'AI_FALLBACK_PLANNER_ENABLED' },
  advisor: { primary: 'AI_MODEL_ADVISOR',  fallback: 'AI_MODEL_FALLBACK_ADVISOR', enabled: 'AI_FALLBACK_ADVISOR_ENABLED' },
  idea:    { primary: 'AI_MODEL_IDEA',     fallback: 'AI_MODEL_FALLBACK_IDEA',    enabled: 'AI_FALLBACK_IDEA_ENABLED' },
};
const DEFAULTS: Record<Surface, { primary: string; fallback: string }> = {
  public:  { primary: 'deepseek-ai/DeepSeek-V4-Flash-0731', fallback: 'zai-org/GLM-5.3-Flash' },
  admin:   { primary: 'MiniMaxAI/MiniMax-M2.7',             fallback: 'zai-org/GLM-5.3-Flash' },
  client:  { primary: 'MiniMaxAI/MiniMax-M2.7',             fallback: 'zai-org/GLM-5.3-Flash' },
  planner: { primary: 'deepseek-ai/DeepSeek-V4-Flash-0731', fallback: 'zai-org/GLM-5.3-Flash' },
  advisor: { primary: 'MiniMaxAI/MiniMax-M2.7',             fallback: 'zai-org/GLM-5.3-Flash' },
  idea:    { primary: 'deepseek-ai/DeepSeek-V4-Flash-0731', fallback: 'zai-org/GLM-5.3-Flash' },
};
const envStr = (env: Env, k: string): string | undefined => (env as unknown as Record<string, string | undefined>)[k];

app.get('/ai/config', async (c) => {
  const env = c.env as Env;
  const surfaces: Record<string, { primary: string; fallback: string | null; fallbackEnabled: boolean; tier: string }> = {};
  for (const s of SURFACES) {
    const keys = SURF_KEYS[s];
    const primary = normaliseModelId(envStr(env, keys.primary) || DEFAULTS[s].primary);
    const fallbackEnabled = (envStr(env, keys.enabled) ?? 'true') === 'true';
    const fallback = fallbackEnabled ? normaliseModelId(envStr(env, keys.fallback) || DEFAULTS[s].fallback) : null;
    const tier = (s === 'public' || s === 'planner' || s === 'idea') ? 'fast' : 'reasoning';
    surfaces[s] = { primary, fallback, fallbackEnabled, tier };
  }
  // Load staged overrides if present.
  const db = getDb(env);
  const staged = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, 'ai_config')).limit(1);
  return c.json({
    surfaces,
    staged: staged[0]?.value ?? null,
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
  const prefix = url.searchParams.get('prefix');
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
  if (!s[0]) return c.json({ error: 'Not found' }, 404);
  const messages = await db.select().from(schema.assistantMessages)
    .where(eq(schema.assistantMessages.sessionId, s[0].id)).orderBy(asc(schema.assistantMessages.createdAt));
  return c.json({ session: s[0], messages });
});

app.post('/ai/conversations/:id/rename', async (c) => {
  const db = getDb(c.env as Env);
  const { name } = await c.req.json() as { name?: string };
  await db.update(schema.assistantSessions).set({ name: (name || '').slice(0, 120) }).where(eq(schema.assistantSessions.id, c.req.param('id')));
  return c.json({ ok: true });
});

app.delete('/ai/conversations/:id', async (c) => {
  const db = getDb(c.env as Env);
  const id = c.req.param('id');
  await db.delete(schema.assistantMessages).where(eq(schema.assistantMessages.sessionId, id));
  await db.delete(schema.assistantSessions).where(eq(schema.assistantSessions.id, id));
  return c.json({ ok: true });
});

app.post('/ai/config', async (c) => {
  const db = getDb(c.env as Env);
  const b = await c.req.json() as { surfaces?: Record<string, { primary?: string; fallback?: string | null; fallbackEnabled?: boolean }> };
  const out: Record<string, { primary: string; fallback: string | null; fallbackEnabled: boolean }> = {};
  const warnings: string[] = [];
  for (const [surface, cfg] of Object.entries(b.surfaces || {})) {
    if (!SURFACES.includes(surface as Surface)) { warnings.push(`unknown surface: ${surface}`); continue; }
    const primary = normaliseModelId(cfg.primary || DEFAULTS[surface as Surface].primary);
    if (!MODEL_CATALOG[primary]) warnings.push(`model "${primary}" not in known catalog for ${surface}.primary (saved anyway)`);
    const fallbackEnabled = cfg.fallbackEnabled !== false;
    const fallback = fallbackEnabled && cfg.fallback ? normaliseModelId(cfg.fallback) : null;
    if (fallback && !MODEL_CATALOG[fallback]) warnings.push(`model "${fallback}" not in known catalog for ${surface}.fallback (saved anyway)`);
    out[surface] = { primary, fallback, fallbackEnabled };
  }
  const existing = await db.select().from(schema.siteSettings).where(eq(schema.siteSettings.key, 'ai_config')).limit(1);
  if (existing.length) await db.update(schema.siteSettings).set({ value: out, updatedAt: now() }).where(eq(schema.siteSettings.key, 'ai_config'));
  else await db.insert(schema.siteSettings).values({ key: 'ai_config', value: out, updatedAt: now() });
  return c.json({ ok: true, warnings, note: 'Config staged in DB. Apply to Worker env (AI_MODEL_* secrets) to make it live; restart required.' });
});

export default app;
