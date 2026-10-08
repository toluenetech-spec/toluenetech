/**
 * Public CMS read endpoints (unauthenticated, read-only).
 *
 * Phase 2: all published content is served from Neon via these routes.
 * Draft/unpublished/private records are NEVER exposed.
 */
import { Hono } from 'hono';
import { eq, desc, asc, and, or, like, count, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

const PAGE_MAX = 50;
const PAGE_DEFAULT = 12;

function paginate(url: URL) {
  const p = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const l = Math.min(PAGE_MAX, Math.max(1, parseInt(url.searchParams.get('limit') || String(PAGE_DEFAULT), 10) || PAGE_DEFAULT));
  return { page: p, limit: l, offset: (p - 1) * l };
}

function cacheHeaders(c: any) {
  c.header('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
}

app.get('/services', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.services)
    .where(eq(schema.services.isPublished, true))
    .orderBy(asc(schema.services.order), asc(schema.services.title));
  cacheHeaders(c);
  return c.json({ items: rows });
});
app.get('/services/:slug', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.services)
    .where(eq(schema.services.slug, c.req.param('slug'))).limit(1);
  if (!row || !row.isPublished) return c.json({ error: 'Not found' }, 404);
  cacheHeaders(c);
  return c.json({ item: row });
});

app.get('/solutions', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.solutions)
    .where(eq(schema.solutions.isPublished, true))
    .orderBy(asc(schema.solutions.order), asc(schema.solutions.title));
  cacheHeaders(c);
  return c.json({ items: rows });
});
app.get('/solutions/:slug', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.solutions)
    .where(eq(schema.solutions.slug, c.req.param('slug'))).limit(1);
  if (!row || !row.isPublished) return c.json({ error: 'Not found' }, 404);
  cacheHeaders(c);
  return c.json({ item: row });
});

app.get('/projects', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const { page, limit, offset } = paginate(url);
  const category = url.searchParams.get('category') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const wheres: any[] = [eq(schema.projects.isPublished, true)];
  if (category) wheres.push(eq(schema.projects.platform, category));
  if (q) {
    const t = `%${q}%`;
    wheres.push(or(like(schema.projects.title, t), like(schema.projects.challenge as any, t), like(schema.projects.results as any, t)));
  }
  const where = and(...wheres);
  const [cntRow] = await db.select({ c: count() }).from(schema.projects).where(where);
  const items = await db.select().from(schema.projects).where(where)
    .orderBy(desc(schema.projects.isFeatured), asc(schema.projects.order), desc(schema.projects.createdAt))
    .limit(limit).offset(offset);
  cacheHeaders(c);
  return c.json({ items, total: Number(cntRow.c), page, limit, totalPages: Math.ceil(Number(cntRow.c) / limit) });
});
app.get('/projects/:slug', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.projects)
    .where(eq(schema.projects.slug, c.req.param('slug'))).limit(1);
  if (!row || !row.isPublished) return c.json({ error: 'Not found' }, 404);
  cacheHeaders(c);
  return c.json({ item: row });
});

app.get('/products', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.products)
    .where(eq(schema.products.isPublished, true))
    .orderBy(asc(schema.products.order), desc(schema.products.createdAt));
  cacheHeaders(c);
  return c.json({ items: rows });
});
app.get('/products/:slug', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.products)
    .where(eq(schema.products.slug, c.req.param('slug'))).limit(1);
  if (!row || !row.isPublished) return c.json({ error: 'Not found' }, 404);
  cacheHeaders(c);
  return c.json({ item: row });
});

app.get('/tools', async (c) => {
  const db = getDb(c.env as Env);
  const category = new URL(c.req.url).searchParams.get('category') || undefined;
  const w = category ? and(eq(schema.tools.isPublished, true), eq(schema.tools.category, category)) : eq(schema.tools.isPublished, true);
  const rows = await db.select().from(schema.tools).where(w).orderBy(asc(schema.tools.order), asc(schema.tools.name));
  cacheHeaders(c);
  return c.json({ items: rows });
});

app.get('/faqs', async (c) => {
  const db = getDb(c.env as Env);
  const category = new URL(c.req.url).searchParams.get('category') || undefined;
  const w = category ? and(eq(schema.faqs.isPublished, true), eq(schema.faqs.category, category)) : eq(schema.faqs.isPublished, true);
  const rows = await db.select().from(schema.faqs).where(w).orderBy(asc(schema.faqs.category), asc(schema.faqs.order));
  cacheHeaders(c);
  return c.json({ items: rows });
});

app.get('/pricing', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.pricingPlans)
    .where(eq(schema.pricingPlans.isPublished, true))
    .orderBy(desc(schema.pricingPlans.isFeatured), asc(schema.pricingPlans.order));
  cacheHeaders(c);
  return c.json({ items: rows });
});

app.get('/testimonials', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.testimonials)
    .where(eq(schema.testimonials.isPublished, true))
    .orderBy(desc(schema.testimonials.isFeatured), asc(schema.testimonials.order));
  cacheHeaders(c);
  return c.json({ items: rows });
});

app.get('/insights', async (c) => {
  const db = getDb(c.env as Env);
  const url = new URL(c.req.url);
  const { page, limit, offset } = paginate(url);
  const category = url.searchParams.get('category') || undefined;
  const tag = url.searchParams.get('tag') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const wheres: any[] = [eq(schema.insights.isDraft, false)];
  if (category) wheres.push(eq(schema.insights.category, category));
  if (tag) wheres.push(sql`${schema.insights.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`);
  if (q) {
    const t = `%${q}%`;
    wheres.push(or(like(schema.insights.title, t), like(schema.insights.excerpt as any, t)));
  }
  const where = and(...wheres);
  const [cntRow] = await db.select({ c: count() }).from(schema.insights).where(where);
  const items = await db.select().from(schema.insights).where(where)
    .orderBy(desc(schema.insights.isFeatured), desc(schema.insights.publishDate), desc(schema.insights.createdAt))
    .limit(limit).offset(offset);
  const slim = items.map((i: any) => ({ ...i, content: undefined, isPublished: true }));
  cacheHeaders(c);
  return c.json({ items: slim, total: Number(cntRow.c), page, limit, totalPages: Math.ceil(Number(cntRow.c) / limit) });
});
app.get('/insights/:slug', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.insights)
    .where(eq(schema.insights.slug, c.req.param('slug'))).limit(1);
  if (!row || row.isDraft) return c.json({ error: 'Not found' }, 404);
  cacheHeaders(c);
  return c.json({ item: { ...(row as any), isPublished: true } });
});

app.get('/site', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.siteSettings);
  const all: Record<string, unknown> = {};
  for (const r of rows) all[r.key] = r.value;
  const publicKeys = ['company','contact','social','founder','notification','availability','hero','brand','seo_defaults'];
  const safe: Record<string, unknown> = {};
  for (const k of publicKeys) if (k in all) safe[k] = all[k];
  cacheHeaders(c);
  return c.json({ settings: safe });
});

export default app;
