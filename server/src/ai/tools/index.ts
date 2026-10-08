import { ilike, or, eq, desc, and, gte, sql } from 'drizzle-orm';
import { getDb, schema } from '../../db';
import type { ToolSpec, ToolHandler, ToolContext } from '../client';
import { rateLimit } from '../../lib/rate-limit';

type DB = ReturnType<typeof getDb>;

/* ---------- Shared public tools ---------- */

export const toolSearchServices: ToolSpec = {
  name: 'search_services',
  description: 'Search published Toluene Tech services by keyword.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
};
export const toolSearchProjects: ToolSpec = {
  name: 'search_projects',
  description: 'Search published portfolio projects by keyword (client names only shown when permitted).',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
};
export const toolSearchFaqs: ToolSpec = {
  name: 'search_faqs',
  description: 'Search FAQs about pricing, timeline, process, support.',
  parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
};
export const toolGetPricing: ToolSpec = {
  name: 'get_pricing',
  description: 'Get all published pricing plans.',
  parameters: { type: 'object', properties: {}, required: [] },
};
export const toolListServices: ToolSpec = {
  name: 'list_services',
  description: 'List all published services.',
  parameters: { type: 'object', properties: {}, required: [] },
};

function tokens(q: string): string[] {
  return String(q ?? '').toLowerCase().split(/\s+/).filter(s => s.length >= 2).slice(0, 8);
}

export const searchServicesHandler: ToolHandler = async (args, ctx) => {
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const q = String(args.query ?? '').slice(0, 120);
  const tk = tokens(q); if (!tk.length) return { result: [] };
  const likes = tk.map(t => `%${t}%`);
  const rows = await db.select({
    slug: schema.services.slug, title: schema.services.title,
    short: schema.services.shortDescription, caps: schema.services.capabilities,
  }).from(schema.services).where(and(
    eq(schema.services.isPublished, true),
    or(...likes.flatMap((l: string) => [
      ilike(schema.services.title, l), ilike(schema.services.shortDescription, l), ilike(schema.services.longDescription, l),
    ])),
  )).limit(6);
  return { result: rows.map((r: any) => ({ title: r.title, slug: r.slug, short: r.short, capabilities: (r.caps ?? []).slice(0, 6) })) };
};

export const searchProjectsHandler: ToolHandler = async (args, ctx) => {
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const q = String(args.query ?? '').slice(0, 120);
  const tk = tokens(q); if (!tk.length) return { result: [] };
  const likes = tk.map(t => `%${t}%`);
  const rows = await db.select({
    slug: schema.projects.slug, title: schema.projects.title, clientName: schema.projects.clientName,
    challenge: schema.projects.challenge, solution: schema.projects.solution, results: schema.projects.results,
    platform: schema.projects.platform, framework: schema.projects.framework,
    hasClientPermission: schema.projects.hasClientPermission,
  }).from(schema.projects).where(and(
    eq(schema.projects.isPublished, true),
    or(...likes.flatMap((l: string) => [
      ilike(schema.projects.title, l), ilike(schema.projects.challenge, l),
      ilike(schema.projects.solution, l), ilike(schema.projects.results, l),
    ])),
  )).limit(5);
  return {
    result: rows.map((r: any) => ({
      title: r.hasClientPermission && r.clientName ? `${r.title} (${r.clientName})` : r.title,
      slug: r.slug,
      summary: `${r.challenge ?? ''} ${r.solution ?? ''} ${r.results ?? ''}`.trim().slice(0, 400),
      tech: [r.platform, r.framework].filter(Boolean).join(', '),
    })),
  };
};

export const searchFaqsHandler: ToolHandler = async (args, ctx) => {
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const q = String(args.query ?? '').slice(0, 120);
  const tk = tokens(q); if (!tk.length) return { result: [] };
  const likes = tk.map(t => `%${t}%`);
  const rows = await db.select({ q: schema.faqs.question, a: schema.faqs.answer })
    .from(schema.faqs).where(and(
      eq(schema.faqs.isPublished, true),
      or(...likes.flatMap((l: string) => [ilike(schema.faqs.question, l), ilike(schema.faqs.answer, l)])),
    )).limit(4);
  return { result: rows };
};

export const getPricingHandler: ToolHandler = async (_args, ctx) => {
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rows = await db.select().from(schema.pricingPlans).where(eq(schema.pricingPlans.isPublished, true)).orderBy(schema.pricingPlans.order);
  return { result: rows.map((p: any) => ({
    name: p.name, tagline: p.tagline,
    priceMonthly: p.priceMonthly, priceOneTime: p.priceOneTime, currency: p.currency,
    features: (p.features ?? []).slice(0, 10),
  })) };
};

export const listServicesHandler: ToolHandler = async (_args, ctx) => {
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rows = await db.select({ title: schema.services.title, short: schema.services.shortDescription, slug: schema.services.slug })
    .from(schema.services).where(eq(schema.services.isPublished, true)).orderBy(schema.services.order);
  return { result: rows };
};

/* ---------- Public: lead creation ---------- */

export const toolCreateLead: ToolSpec = {
  name: 'create_lead',
  description: 'Create a new lead when the visitor is ready to start a project. Requires name, email, requirements. Returns TT-XXXX reference.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      company: { type: 'string' },
      services: { type: 'array', items: { type: 'string' } },
      requirements: { type: 'string' },
      budget: { type: 'string' },
      timeline: { type: 'string' },
      summary: { type: 'string', description: 'Internal summary for the team.' },
      intent: { type: 'string', enum: ['start-project', 'pricing'] },
    },
    required: ['name', 'email', 'requirements', 'summary'],
  },
};

export const createLeadHandler: ToolHandler = async (args, ctx) => {
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rl = rateLimit(`lead-create:${ctx.ip}`, { windowMs: 60_000, max: 3 });
  if (!rl.ok) return { result: { error: 'Rate limited — try again in a moment.' } };

  const name = String(args.name ?? '').trim().slice(0, 160);
  const email = String(args.email ?? '').trim().toLowerCase().slice(0, 240);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { result: { error: 'Missing or invalid name/email — ask the visitor to confirm.' } };
  }
  const requirements = String(args.requirements ?? '').trim().slice(0, 4000);
  const budget = args.budget ? String(args.budget).slice(0, 80) : null;
  const timeline = args.timeline ? String(args.timeline).slice(0, 80) : null;
  const company = args.company ? String(args.company).slice(0, 180) : null;
  const phone = args.phone ? String(args.phone).slice(0, 40) : null;
  const services = Array.isArray(args.services) ? args.services.map((s: any) => String(s).slice(0, 120)).slice(0, 10) : [];
  const summary = String(args.summary ?? '').slice(0, 2000);

  const [lastRow] = await db.select({ ref: schema.leads.ref }).from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(1);
  const n = lastRow?.ref ? parseInt(lastRow.ref.replace(/\D/g, ''), 10) || 0 : 0;
  const ref = `TT-${String(n + 1).padStart(4, '0')}`;

  // Dedupe: don't create a second lead for the same email within 24h, and don't
  // create if the session already captured a lead.
  if (ctx.session?.capturedLeadId) {
    return { result: { ok: true, ref: 'existing', alreadyCaptured: true }, stop: false };
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [dup] = await db.select().from(schema.leads)
    .where(and(eq(schema.leads.email, email), gte(schema.leads.createdAt, dayAgo)))
    .orderBy(desc(schema.leads.createdAt)).limit(1);
  let lead;
  if (dup && dup.status !== 'LOST' && dup.status !== 'ARCHIVED') {
    lead = dup;
  } else {
    [lead] = await db.insert(schema.leads).values({
      ref, name, email,
      phone: phone ?? undefined, company: company ?? undefined,
      requirements, budget: budget ?? undefined, timeline: timeline ?? undefined,
      services, source: 'assistant', sourcePage: '/assistant',
      aiRef: ctx.session?.id ?? null,
      status: 'NEW', notes: summary || null,
    }).returning();
  }

  if (ctx.session?.id) {
    await db.update(schema.assistantSessions)
      .set({ capturedLeadId: lead.id, intent: (args.intent as string) ?? 'start-project', email, name })
      .where(eq(schema.assistantSessions.id, ctx.session.id));
  }
  await db.insert(schema.leadNotes).values({
    id: crypto.randomUUID(), leadId: lead.id,
    authorType: 'ai', authorName: 'Tolesh (public)',
    type: 'note', body: summary || `Lead captured from assistant chat. Brief: ${requirements.slice(0, 400)}`,
    meta: { source: 'assistant', intent: args.intent ?? 'start-project' },
  });

  return {
    result: { ok: true, ref: lead.ref },
    stop: true,
    reply: `Your enquiry has been logged as **${lead.ref}**. I've passed your brief to the team and we'll reply to **${email}** within a few hours on business days.\n\n**What I captured:**\n- Name: ${name}\n- Project: ${requirements.slice(0, 280)}${requirements.length > 280 ? '…' : ''}\n${budget ? `- Budget: ${budget}\n` : ''}${timeline ? `- Timeline: ${timeline}\n` : ''}\nIf anything is wrong, just tell me and I'll correct it.`,
  };
};

/* ---------- Admin tools ---------- */

export const toolAdminListLeads: ToolSpec = {
  name: 'admin_list_leads',
  description: 'List recent leads (newest first).',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['NEW','CONTACTED','QUALIFIED','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST','ALL'] },
      limit: { type: 'number' },
    },
    required: [],
  },
};
export const toolAdminGetLead: ToolSpec = {
  name: 'admin_get_lead',
  description: 'Get a lead by TT-XXXX reference.',
  parameters: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] },
};
export const toolAdminStats: ToolSpec = {
  name: 'admin_stats',
  description: 'Lead and project counts by status.',
  parameters: { type: 'object', properties: {}, required: [] },
};
export const toolAdminDraftReply: ToolSpec = {
  name: 'admin_draft_reply',
  description: 'Draft a reply to a lead (NOT sent — for admin review).',
  parameters: {
    type: 'object',
    properties: { ref: { type: 'string' }, tone: { type: 'string', enum: ['professional','friendly','formal'] }, purpose: { type: 'string' } },
    required: ['ref', 'purpose'],
  },
};
export const toolAdminSearchProjects: ToolSpec = {
  name: 'admin_search_projects',
  description: 'Search all portfolio projects (including drafts).',
  parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
};

export const adminListLeadsHandler: ToolHandler = async (args, ctx) => {
  if (ctx.kind !== 'admin') return { result: { error: 'Unauthorized' } };
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const status = String(args.status ?? 'ALL');
  const limit = Math.min(20, Math.max(1, Number(args.limit) || 10));
  const rows = await (status === 'ALL'
    ? db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt)).limit(limit)
    : db.select().from(schema.leads).where(eq(schema.leads.status, status as any)).orderBy(desc(schema.leads.createdAt)).limit(limit));
  return { result: rows.map((l: any) => ({
    ref: l.ref, name: l.name, email: l.email, status: l.status, source: l.source,
    budget: l.budget, timeline: l.timeline,
    createdAt: new Date(l.createdAt).toISOString().slice(0, 10),
    requirements: (l.requirements ?? '').slice(0, 180),
  })) };
};
export const adminGetLeadHandler: ToolHandler = async (args, ctx) => {
  if (ctx.kind !== 'admin') return { result: { error: 'Unauthorized' } };
  const ref = String(args.ref ?? '').trim().toUpperCase();
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const [l] = await db.select().from(schema.leads).where(eq(schema.leads.ref, ref)).limit(1);
  if (!l) return { result: { error: `No lead with ref ${ref}.` } };
  return { result: {
    ref: l.ref, name: l.name, email: l.email, phone: l.phone, company: l.company,
    status: l.status, source: l.source, services: l.services,
    requirements: l.requirements, budget: l.budget, timeline: l.timeline, notes: l.notes,
    createdAt: new Date(l.createdAt).toISOString(),
  } };
};
export const adminStatsHandler: ToolHandler = async (_args, ctx) => {
  if (ctx.kind !== 'admin') return { result: { error: 'Unauthorized' } };
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const byStatus = await db.select({ status: schema.leads.status, c: sql<number>`count(*)::int` }).from(schema.leads).groupBy(schema.leads.status);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.leads);
  const [{ projects }] = await db.select({ projects: sql<number>`count(*)::int` }).from(schema.clientProjects);
  return { result: { totalLeads: total, totalProjects: projects, byStatus } };
};
export const adminDraftReplyHandler: ToolHandler = async (args, ctx) => {
  if (ctx.kind !== 'admin') return { result: { error: 'Unauthorized' } };
  const ref = String(args.ref ?? '').trim().toUpperCase();
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const [l] = await db.select().from(schema.leads).where(eq(schema.leads.ref, ref)).limit(1);
  if (!l) return { result: { error: `Lead ${ref} not found.` } };
  return {
    result: {
      lead: { ref: l.ref, name: l.name, email: l.email, requirements: l.requirements, budget: l.budget, timeline: l.timeline },
      purpose: args.purpose, tone: args.tone ?? 'professional',
    },
    followUp: 'Draft a reply. Prefix with "DRAFT REPLY (not sent):" and keep it under 120 words. End with one clear CTA.',
  };
};
export const adminSearchProjectsHandler: ToolHandler = async (args, ctx) => {
  if (ctx.kind !== 'admin') return { result: { error: 'Unauthorized' } };
  const q = String(args.query ?? '').slice(0, 120);
  const tk = tokens(q); if (!tk.length) return { result: [] };
  const likes = tk.map(t => `%${t}%`);
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rows = await db.select({ slug: schema.projects.slug, title: schema.projects.title, isPublished: schema.projects.isPublished })
    .from(schema.projects)
    .where(or(...likes.flatMap((l: string) => [ilike(schema.projects.title, l), ilike(schema.projects.challenge, l)])))
    .limit(10);
  return { result: rows };
};

/* ---------- Client tools ---------- */

export const toolClientProjects: ToolSpec = { name: 'client_projects', description: "List the authenticated client's projects.", parameters: { type: 'object', properties: {}, required: [] } };
export const toolClientMilestones: ToolSpec = { name: 'client_milestones', description: 'List milestones for a project (requires projectId from client_projects).', parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } };
export const toolClientMessages: ToolSpec = { name: 'client_messages', description: 'Recent messages for a project.', parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } };
export const toolClientFiles: ToolSpec = { name: 'client_files', description: 'List files for a project.', parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } };

function clientIdFrom(ctx: ToolContext): string | null { return ctx.auth?.clientId ?? null; }

export const clientProjectsHandler: ToolHandler = async (_args, ctx) => {
  if (ctx.kind !== 'client') return { result: { error: 'Unauthorized' } };
  const cid = clientIdFrom(ctx); if (!cid) return { result: { error: 'No client identity' } };
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rows = await db.select().from(schema.clientProjects).where(eq(schema.clientProjects.clientId, cid));
  return { result: rows.map((r: any) => ({
    id: r.id, title: r.title, status: r.status, progress: r.progress,
    startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0,10) : null,
    dueDate: r.dueDate ? new Date(r.dueDate).toISOString().slice(0,10) : null,
  })) };
};
async function authProject(ctx: ToolContext, projectId: string) {
  if (ctx.kind !== 'client') return { error: 'Unauthorized' };
  const cid = clientIdFrom(ctx); if (!cid) return { error: 'No client identity' };
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const [p] = await db.select().from(schema.clientProjects).where(and(eq(schema.clientProjects.id, projectId), eq(schema.clientProjects.clientId, cid))).limit(1);
  if (!p) return { error: 'Project not found or not accessible.' };
  return { project: p };
}
export const clientMilestonesHandler: ToolHandler = async (args, ctx) => {
  const r = await authProject(ctx, String(args.projectId ?? ''));
  if ('error' in r) return { result: r };
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rows = await db.select().from(schema.milestones).where(eq(schema.milestones.projectId, (r as any).project.id)).orderBy(schema.milestones.order);
  return { result: { project: (r as any).project.title, milestones: rows.map((m: any) => ({
    id: m.id, title: m.title, status: m.status,
    dueDate: m.dueDate ? new Date(m.dueDate).toISOString().slice(0,10) : null,
    description: m.description,
  })) } };
};
export const clientMessagesHandler: ToolHandler = async (args, ctx) => {
  const r = await authProject(ctx, String(args.projectId ?? ''));
  if ('error' in r) return { result: r };
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rows = await db.select().from(schema.messages)
    .where(and(eq(schema.messages.contextType, 'PROJECT'), eq(schema.messages.contextId, (r as any).project.id)))
    .orderBy(desc(schema.messages.createdAt)).limit(15);
  return { result: { project: (r as any).project.title, messages: rows.slice().reverse().map((m: any) => ({
    from: m.fromName, body: m.body.slice(0, 500), at: new Date(m.createdAt).toISOString(),
  })) } };
};
export const clientFilesHandler: ToolHandler = async (args, ctx) => {
  const r = await authProject(ctx, String(args.projectId ?? ''));
  if ('error' in r) return { result: r };
  if (!ctx.db) return { result: { error: 'database unavailable' } };
  const db = ctx.db as DB;
  const rows = await db.select().from(schema.projectFiles).where(eq(schema.projectFiles.projectId, (r as any).project.id)).orderBy(desc(schema.projectFiles.createdAt)).limit(20);
  return { result: { project: (r as any).project.title, files: rows.map((f: any) => ({
    name: f.filename, size: f.sizeBytes, type: f.mimeType,
  })) } };
};

/* ---------- Tool-set bundles ---------- */

export const PUBLIC_TOOLS: ToolSpec[] = [
  toolSearchServices, toolSearchProjects, toolSearchFaqs, toolGetPricing, toolListServices, toolCreateLead,
];
export const ADMIN_TOOLS: ToolSpec[] = [
  toolSearchServices, toolSearchProjects, toolSearchFaqs, toolGetPricing, toolListServices,
  toolAdminListLeads, toolAdminGetLead, toolAdminStats, toolAdminDraftReply, toolAdminSearchProjects,
];
export const CLIENT_TOOLS: ToolSpec[] = [
  toolClientProjects, toolClientMilestones, toolClientMessages, toolClientFiles,
];

export function buildHandlers(ctx: ToolContext): Record<string, ToolHandler> {
  const common: Record<string, ToolHandler> = {
    search_services: searchServicesHandler,
    search_projects: searchProjectsHandler,
    search_faqs: searchFaqsHandler,
    get_pricing: getPricingHandler,
    list_services: listServicesHandler,
  };
  if (ctx.kind === 'public') return { ...common, create_lead: createLeadHandler };
  if (ctx.kind === 'admin') return {
    ...common,
    admin_list_leads: adminListLeadsHandler,
    admin_get_lead: adminGetLeadHandler,
    admin_stats: adminStatsHandler,
    admin_draft_reply: adminDraftReplyHandler,
    admin_search_projects: adminSearchProjectsHandler,
  };
  return {
    client_projects: clientProjectsHandler,
    client_milestones: clientMilestonesHandler,
    client_messages: clientMessagesHandler,
    client_files: clientFilesHandler,
  };
}
