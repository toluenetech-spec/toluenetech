import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

app.get('/services', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.services)
    .where(eq(schema.services.isPublished, true))
    .orderBy(schema.services.order);
  return c.json({ items: rows });
});

app.get('/services/:slug', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.services)
    .where(eq(schema.services.slug, c.req.param('slug'))).limit(1);
  if (!row || !row.isPublished) return c.json({ error: 'Not found' }, 404);
  return c.json({ item: row });
});

app.get('/projects', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.projects)
    .where(eq(schema.projects.isPublished, true))
    .orderBy(schema.projects.order);
  return c.json({ items: rows });
});

app.get('/projects/:slug', async (c) => {
  const db = getDb(c.env as Env);
  const [row] = await db.select().from(schema.projects)
    .where(eq(schema.projects.slug, c.req.param('slug'))).limit(1);
  if (!row || !row.isPublished) return c.json({ error: 'Not found' }, 404);
  return c.json({ item: row });
});

app.get('/faqs', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.faqs)
    .where(eq(schema.faqs.isPublished, true))
    .orderBy(schema.faqs.order);
  return c.json({ items: rows });
});

app.get('/pricing', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.pricingPlans)
    .where(eq(schema.pricingPlans.isPublished, true))
    .orderBy(schema.pricingPlans.order);
  return c.json({ items: rows });
});

app.get('/testimonials', async (c) => {
  const db = getDb(c.env as Env);
  const rows = await db.select().from(schema.testimonials)
    .where(eq(schema.testimonials.isPublished, true))
    .orderBy(schema.testimonials.order);
  return c.json({ items: rows });
});

export default app;
