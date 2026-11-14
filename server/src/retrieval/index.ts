import { ilike, or, eq, desc, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db';

type DB = ReturnType<typeof getDb>;

export interface RetrievedDoc {
  kind: 'service' | 'project' | 'faq' | 'pricing' | 'testimonial' | 'insight' | 'setting';
  id: string;
  title: string;
  snippet: string;
  url?: string;
}

function clip(s: string | null | undefined, n = 320): string {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}
function tokens(q: string): string[] {
  return (q || '').toLowerCase().replace(/[^a-z0-9\s#-]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
}

export async function retrievePublic(db: DB, query: string, opts: { limit?: number } = {}): Promise<RetrievedDoc[]> {
  const limit = opts.limit ?? 5;
  const tk = tokens(query); if (!tk.length) return [];
  const likes = tk.map(t => `%${t}%`);
  const [services, projects, faqs, plans, testimonials, insights] = await Promise.all([
    db.select({
      id: schema.services.id, title: schema.services.title,
      shortDescription: schema.services.shortDescription, longDescription: schema.services.longDescription,
      capabilities: schema.services.capabilities, slug: schema.services.slug,
    }).from(schema.services).where(and(eq(schema.services.isPublished, true),
      or(...tk.flatMap(t => [
        ilike(schema.services.title, `%${t}%`),
        ilike(schema.services.shortDescription, `%${t}%`),
        ilike(schema.services.longDescription, `%${t}%`),
      ])),
    )).limit(limit),
    db.select({
      id: schema.projects.id, title: schema.projects.title,
      challenge: schema.projects.challenge, objective: schema.projects.objective,
      solution: schema.projects.solution, results: schema.projects.results,
      clientName: schema.projects.clientName, platform: schema.projects.platform,
      framework: schema.projects.framework, slug: schema.projects.slug,
      hasClientPermission: schema.projects.hasClientPermission,
    }).from(schema.projects).where(and(eq(schema.projects.isPublished, true),
      or(...tk.flatMap(t => [
        ilike(schema.projects.title, `%${t}%`),
        ilike(schema.projects.challenge, `%${t}%`),
        ilike(schema.projects.objective, `%${t}%`),
        ilike(schema.projects.solution, `%${t}%`),
        ilike(schema.projects.results, `%${t}%`),
      ])),
    )).limit(limit),
    db.select({ id: schema.faqs.id, question: schema.faqs.question, answer: schema.faqs.answer })
      .from(schema.faqs).where(and(eq(schema.faqs.isPublished, true),
        or(...tk.flatMap(t => [ilike(schema.faqs.question, `%${t}%`), ilike(schema.faqs.answer, `%${t}%`)]))
      )).limit(limit),
    db.select().from(schema.pricingPlans).where(and(eq(schema.pricingPlans.isPublished, true),
      or(...tk.flatMap(t => [ilike(schema.pricingPlans.name, `%${t}%`), ilike(schema.pricingPlans.tagline, `%${t}%`)]))
    )).limit(3),
    db.select().from(schema.testimonials).where(and(eq(schema.testimonials.isPublished, true),
      or(...tk.flatMap(t => [ilike(schema.testimonials.testimonial, `%${t}%`)]))
    )).limit(2),
    db.select({
      id: schema.insights.id, title: schema.insights.title, excerpt: schema.insights.excerpt,
      content: schema.insights.content, slug: schema.insights.slug,
    }).from(schema.insights).where(and(eq(schema.insights.isDraft, false),
      or(...tk.flatMap(t => [ilike(schema.insights.title, `%${t}%`), ilike(schema.insights.excerpt, `%${t}%`), ilike(schema.insights.content, `%${t}%`)]))
    )).limit(3),
  ]);
  const out: RetrievedDoc[] = [];
  for (const s of services) out.push({ kind: 'service', id: s.id, title: s.title,
    snippet: clip(`${s.shortDescription ?? ''} ${s.longDescription ?? ''} Capabilities: ${(s.capabilities ?? []).join(', ')}.`),
    url: `/services/${s.slug}` });
  for (const p of projects) out.push({ kind: 'project', id: p.id,
    title: p.hasClientPermission && p.clientName ? `${p.title} for ${p.clientName}` : p.title,
    snippet: clip(`${p.challenge ?? ''} ${p.objective ?? ''} ${p.solution ?? ''} ${p.results ?? ''} ${p.platform ?? ''} ${p.framework ?? ''}`),
    url: `/project/${p.slug}` });
  for (const f of faqs) out.push({ kind: 'faq', id: f.id, title: f.question, snippet: clip(f.answer) });
  for (const p of plans) {
    const price = p.priceMonthly != null ? `$${p.priceMonthly}/mo` : p.priceOneTime != null ? `from $${p.priceOneTime}` : 'custom';
    out.push({ kind: 'pricing', id: p.id, title: `${p.name} (${price})`, snippet: clip(`${p.tagline ?? ''} Features: ${(p.features ?? []).join(', ')}.`) });
  }
  for (const t of testimonials) out.push({ kind: 'testimonial', id: t.id, title: `${t.name}${t.role ? `, ${t.role}` : ''}${t.company ? ` at ${t.company}` : ''}`, snippet: clip(t.testimonial) });
  for (const i of insights) out.push({ kind: 'insight', id: i.id, title: i.title, snippet: clip(i.excerpt ?? i.content), url: `/insights/${i.slug}` });
  return out.slice(0, 8);
}


export async function basePublicContext(db: DB): Promise<string> {
  const [services, faqs, plans, settingsRows] = await Promise.all([
    db.select().from(schema.services).where(eq(schema.services.isPublished, true)).orderBy(schema.services.order),
    db.select().from(schema.faqs).where(eq(schema.faqs.isPublished, true)).orderBy(schema.faqs.order),
    db.select().from(schema.pricingPlans).where(eq(schema.pricingPlans.isPublished, true)).orderBy(schema.pricingPlans.order),
    db.select().from(schema.siteSettings),
  ]);
  const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value])) as Record<string, any>;
  const servicesText = services.map((s: any) => `- ${s.title}: ${s.shortDescription ?? ''}`).join('\n') || '(none)';
  const pricingText = plans.map((p: any) => {
    const price = p.priceMonthly != null ? `$${p.priceMonthly}/mo` : p.priceOneTime != null ? `from $${p.priceOneTime}` : 'custom';
    return `- ${p.name} (${price}): ${(p.features ?? []).slice(0,6).join(', ')}`;
  }).join('\n') || '(custom — all work quoted per project)';
  const faqText = faqs.slice(0, 8).map((f: any) => `Q: ${f.question}\nA: ${clip(f.answer, 220)}`).join('\n\n') || '(none)';
  const availability = (settings.availability as any) ?? 'AVAILABLE';
  return `BUSINESS: Toluene Tech is an independent technology studio based in Lagos, Nigeria, working remotely with clients worldwide.
AVAILABILITY: ${availability}.
SERVICES:
${servicesText}
PRICING:
${pricingText}
FAQ (selected):
${faqText}`;
}

export async function adminSummary(db: DB) {
  const [{ c: newLeads } = { c: 0 }] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.leads).where(eq(schema.leads.status, 'NEW'));
  const [{ c: totalLeads } = { c: 0 }] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.leads);
  const [{ c: totalProjects } = { c: 0 }] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.clientProjects);
  const latestLeads = await db.select({
    ref: schema.leads.ref, name: schema.leads.name, email: schema.leads.email,
    status: schema.leads.status, source: schema.leads.source,
    requirements: schema.leads.requirements, budget: schema.leads.budget, timeline: schema.leads.timeline,
    createdAt: schema.leads.createdAt,
  }).from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(8);
  return { newLeads, totalLeads, totalProjects, latestLeads };
}
