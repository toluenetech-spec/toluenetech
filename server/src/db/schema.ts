import {
  pgTable, pgEnum, text, varchar, boolean, integer,
  timestamp, jsonb, doublePrecision, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

/* ---------- Enums ---------- */
export const availabilityEnum = pgEnum('availability', ['AVAILABLE', 'LIMITED', 'UNAVAILABLE']);
export const projectStatusEnum = pgEnum('project_status', ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']);
export const publishStateEnum = pgEnum('publish_state', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const productStatusEnum = pgEnum('product_status', ['IDEA', 'PROTOTYPE', 'IN_DEV', 'BETA', 'LIVE', 'ARCHIVED']);
export const labCategoryEnum = pgEnum('lab_category', ['AI', 'EXPERIMENT', 'TOOL', 'RESEARCH']);
export const leadStatusEnum = pgEnum('lead_status', [
  'NEW', 'CONTACTED', 'QUALIFIED', 'DISCOVERY', 'PROPOSAL',
  'NEGOTIATION', 'WON', 'LOST',
]);
export const clientStatusEnum = pgEnum('client_status', ['ACTIVE', 'INACTIVE']);
export const milestoneStatusEnum = pgEnum('milestone_status', ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED']);
export const taskStatusEnum = pgEnum('task_status', ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
export const messageContextEnum = pgEnum('message_context', ['PROJECT', 'LEAD', 'GENERAL']);

const id = (name: string) => varchar(name, { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID());
const now = (name: string) => timestamp(name, { mode: 'date', withTimezone: true }).notNull().defaultNow();

/* ---------- Site settings ---------- */
export const siteSettings = pgTable('site_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: now('updated_at'),
});

/* ---------- Services ---------- */
export const services = pgTable('services', {
  id: id('id'),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  shortDescription: text('short_description').notNull(),
  longDescription: text('long_description'),
  icon: varchar('icon', { length: 60 }),            // lucide icon name
  capabilities: jsonb('capabilities').$type<string[]>().default([]),
  relatedProjectIds: jsonb('related_project_ids').$type<string[]>().default([]),
  isPublished: boolean('is_published').notNull().default(false),
  isFeatured: boolean('is_featured').notNull().default(false),
  order: integer('order').notNull().default(0),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: text('seo_description'),
  seoOgImage: varchar('seo_og_image', { length: 500 }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ slugIdx: uniqueIndex('svc_slug_idx').on(t.slug) }));

/* ---------- Projects / portfolio ---------- */
export const projects = pgTable('projects', {
  id: id('id'),
  slug: varchar('slug', { length: 160 }).notNull().unique(),
  title: varchar('title', { length: 220 }).notNull(),
  clientName: varchar('client_name', { length: 200 }),       // null = anonymous (per no-fabrication rule)
  clientLogo: varchar('client_logo', { length: 500 }),
  role: varchar('role', { length: 120 }),
  platform: varchar('platform', { length: 80 }),
  framework: varchar('framework', { length: 80 }),
  completionDate: timestamp('completion_date', { mode: 'date' }),
  status: projectStatusEnum('status').notNull().default('ACTIVE'),
  coverImage: varchar('cover_image', { length: 500 }),
  gallery: jsonb('gallery').$type<string[]>().default([]),
  videoUrl: varchar('video_url', { length: 500 }),
  challenge: text('challenge'),
  objective: text('objective'),
  solution: text('solution'),
  features: jsonb('features').$type<string[]>().default([]),
  process: jsonb('process').$type<{ stage: string; description: string }[]>().default([]),
  results: text('results'),
  metrics: jsonb('metrics').$type<{ label: string; value: string }[]>().default([]), // e.g. {"label":"LCP","value":"1.2s"}
  liveUrl: varchar('live_url', { length: 500 }),
  githubUrl: varchar('github_url', { length: 500 }),
  appStoreUrl: varchar('app_store_url', { length: 500 }),
  playStoreUrl: varchar('play_store_url', { length: 500 }),
  serviceIds: jsonb('service_ids').$type<string[]>().default([]),
  isPublished: boolean('is_published').notNull().default(false),
  isFeatured: boolean('is_featured').notNull().default(false),
  hasClientPermission: boolean('has_client_permission').notNull().default(false), // controls whether client name/logo shown
  order: integer('order').notNull().default(0),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: text('seo_description'),
  seoOgImage: varchar('seo_og_image', { length: 500 }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ slugIdx: uniqueIndex('prj_slug_idx').on(t.slug) }));

/* ---------- Products ---------- */
export const products = pgTable('products', {
  id: id('id'),
  slug: varchar('slug', { length: 160 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  logo: varchar('logo', { length: 500 }),
  screenshots: jsonb('screenshots').$type<string[]>().default([]),
  features: jsonb('features').$type<string[]>().default([]),
  techStack: jsonb('tech_stack').$type<string[]>().default([]),
  status: productStatusEnum('status').notNull().default('IDEA'),
  demoUrl: varchar('demo_url', { length: 500 }),
  websiteUrl: varchar('website_url', { length: 500 }),
  caseStudyUrl: varchar('case_study_url', { length: 500 }),
  isPublished: boolean('is_published').notNull().default(false),
  order: integer('order').notNull().default(0),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
});

/* ---------- Toluene Tech Lab ---------- */
export const labItems = pgTable('lab_items', {
  id: id('id'),
  slug: varchar('slug', { length: 160 }).notNull().unique(),
  title: varchar('title', { length: 220 }).notNull(),
  description: text('description'),
  category: labCategoryEnum('category').notNull().default('EXPERIMENT'),
  tech: jsonb('tech').$type<string[]>().default([]),
  demoUrl: varchar('demo_url', { length: 500 }),
  status: varchar('status', { length: 40 }).notNull().default('active'),
  screenshots: jsonb('screenshots').$type<string[]>().default([]),
  publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
});

/* ---------- Testimonials ---------- */
export const testimonials = pgTable('testimonials', {
  id: id('id'),
  name: varchar('name', { length: 160 }).notNull(),
  role: varchar('role', { length: 120 }),
  company: varchar('company', { length: 160 }),
  photo: varchar('photo', { length: 500 }),
  testimonial: text('testimonial').notNull(),
  relatedProjectId: varchar('related_project_id', { length: 36 }),
  isFeatured: boolean('is_featured').notNull().default(false),
  isPublished: boolean('is_published').notNull().default(false),
  order: integer('order').notNull().default(0),
  createdAt: now('created_at'),
});

/* ---------- FAQs ---------- */
export const faqs = pgTable('faqs', {
  id: id('id'),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: varchar('category', { length: 80 }),
  order: integer('order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
});

/* ---------- Insights / blog ---------- */
export const insights = pgTable('insights', {
  id: id('id'),
  slug: varchar('slug', { length: 200 }).notNull().unique(),
  title: varchar('title', { length: 240 }).notNull(),
  excerpt: text('excerpt'),
  coverImage: varchar('cover_image', { length: 500 }),
  content: text('content').notNull(),                 // markdown
  author: varchar('author', { length: 120 }),
  category: varchar('category', { length: 80 }),
  tags: jsonb('tags').$type<string[]>().default([]),
  publishDate: timestamp('publish_date', { mode: 'date', withTimezone: true }),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: text('seo_description'),
  seoOgImage: varchar('seo_og_image', { length: 500 }),
  isFeatured: boolean('is_featured').notNull().default(false),
  isDraft: boolean('is_draft').notNull().default(true),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
});

/* ---------- Pricing plans ---------- */
export const pricingPlans = pgTable('pricing_plans', {
  id: id('id'),
  name: varchar('name', { length: 120 }).notNull(),
  tagline: varchar('tagline', { length: 240 }),
  priceMonthly: integer('price_monthly'),           // null = custom / contact us
  priceOneTime: integer('price_one_time'),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  features: jsonb('features').$type<string[]>().default([]),
  ctaLabel: varchar('cta_label', { length: 60 }).notNull().default('Start a project'),
  ctaUrl: varchar('cta_url', { length: 240 }),
  isFeatured: boolean('is_featured').notNull().default(false),
  isPublished: boolean('is_published').notNull().default(true),
  order: integer('order').notNull().default(0),
});

/* ---------- Leads / CRM ---------- */
export const leads = pgTable('leads', {
  id: id('id'),
  ref: varchar('ref', { length: 16 }).notNull().unique(),   // TT-0001
  name: varchar('name', { length: 160 }).notNull(),
  email: varchar('email', { length: 240 }).notNull(),
  phone: varchar('phone', { length: 40 }),
  company: varchar('company', { length: 180 }),
  services: jsonb('services').$type<string[]>().default([]),
  requirements: text('requirements'),
  budget: varchar('budget', { length: 80 }),
  timeline: varchar('timeline', { length: 80 }),
  source: varchar('source', { length: 80 }),                // website-form, assistant, referral, ...
  notes: text('notes'),
  status: leadStatusEnum('status').notNull().default('NEW'),
  followUpDate: timestamp('follow_up_date', { mode: 'date', withTimezone: true }),
  convertedClientId: varchar('converted_client_id', { length: 36 }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({
  emailIdx: index('lead_email_idx').on(t.email),
  statusIdx: index('lead_status_idx').on(t.status),
}));

/* ---------- Clients ---------- */
export const clients = pgTable('clients', {
  id: id('id'),
  userId: varchar('user_id', { length: 128 }).unique(),     // Firebase uid
  name: varchar('name', { length: 160 }).notNull(),
  email: varchar('email', { length: 240 }).notNull(),
  phone: varchar('phone', { length: 40 }),
  company: varchar('company', { length: 180 }),
  status: clientStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
});

/* ---------- Projects for clients (separate from public portfolio projects) ---------- */
export const clientProjects = pgTable('client_projects', {
  id: id('id'),
  clientId: varchar('client_id', { length: 36 }).notNull(),
  publicProjectId: varchar('public_project_id', { length: 36 }), // optional link to portfolio project
  title: varchar('title', { length: 220 }).notNull(),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('ACTIVE'),
  progress: integer('progress').notNull().default(0),        // 0-100
  startDate: timestamp('start_date', { mode: 'date', withTimezone: true }),
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ clientIdx: index('cp_client_idx').on(t.clientId) }));

export const milestones = pgTable('milestones', {
  id: id('id'),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 220 }).notNull(),
  description: text('description'),
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  status: milestoneStatusEnum('status').notNull().default('PENDING'),
  order: integer('order').notNull().default(0),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ projectIdx: index('ms_proj_idx').on(t.projectId) }));

export const tasks = pgTable('tasks', {
  id: id('id'),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  milestoneId: varchar('milestone_id', { length: 36 }),
  title: varchar('title', { length: 240 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('TODO'),
  assignee: varchar('assignee', { length: 120 }),
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ projectIdx: index('tk_proj_idx').on(t.projectId) }));

export const projectFiles = pgTable('project_files', {
  id: id('id'),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  uploadedBy: varchar('uploaded_by', { length: 128 }),        // uid
  filename: varchar('filename', { length: 240 }).notNull(),
  r2Key: varchar('r2_key', { length: 500 }).notNull(),
  sizeBytes: integer('size_bytes'),
  mimeType: varchar('mime_type', { length: 120 }),
  createdAt: now('created_at'),
}, (t) => ({ projectIdx: index('pf_proj_idx').on(t.projectId) }));

export const messages = pgTable('messages', {
  id: id('id'),
  contextType: messageContextEnum('context_type').notNull().default('GENERAL'),
  contextId: varchar('context_id', { length: 36 }),           // projectId or leadId
  fromUid: varchar('from_uid', { length: 128 }),              // null when from assistant
  fromName: varchar('from_name', { length: 160 }).notNull(),
  body: text('body').notNull(),
  attachments: jsonb('attachments').$type<{ filename: string; r2Key: string }[]>().default([]),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: now('created_at'),
}, (t) => ({ ctxIdx: index('msg_ctx_idx').on(t.contextType, t.contextId) }));

export const invoices = pgTable('invoices', {
  id: id('id'),
  clientId: varchar('client_id', { length: 36 }).notNull(),
  projectId: varchar('project_id', { length: 36 }),
  number: varchar('number', { length: 40 }).notNull().unique(),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: varchar('status', { length: 30 }).notNull().default('DRAFT'), // DRAFT/SENT/PAID/VOID
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  paidAt: timestamp('paid_at', { mode: 'date', withTimezone: true }),
  pdfR2Key: varchar('pdf_r2_key', { length: 500 }),
  createdAt: now('created_at'),
});

/* ---------- Media library ---------- */
export const media = pgTable('media', {
  id: id('id'),
  filename: varchar('filename', { length: 240 }).notNull(),
  r2Key: varchar('r2_key', { length: 500 }).notNull().unique(),
  publicUrl: varchar('public_url', { length: 600 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }),
  sizeBytes: integer('size_bytes'),
  width: integer('width'),
  height: integer('height'),
  alt: varchar('alt', { length: 300 }),
  uploadedBy: varchar('uploaded_by', { length: 128 }),
  createdAt: now('created_at'),
});

/* ---------- Assistant conversations (RAG + lead-capture context) ---------- */
export const assistantSessions = pgTable('assistant_sessions', {
  id: id('id'),
  anonId: varchar('anon_id', { length: 64 }).notNull(),      // random cookie id, not PII
  name: varchar('name', { length: 160 }),                    // only if user volunteers it
  email: varchar('email', { length: 240 }),                  // only if user volunteers it
  capturedLeadId: varchar('captured_lead_id', { length: 36 }),
  intent: varchar('intent', { length: 40 }),                 // services/pricing/start-project/other
  createdAt: now('created_at'),
  lastMessageAt: timestamp('last_message_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ anonIdx: index('as_anon_idx').on(t.anonId) }));

export const assistantMessages = pgTable('assistant_messages', {
  id: id('id'),
  sessionId: varchar('session_id', { length: 36 }).notNull(),
  role: varchar('role', { length: 16 }).notNull(),           // user | assistant | system
  content: text('content').notNull(),
  createdAt: now('created_at'),
}, (t) => ({ sessionIdx: index('am_sess_idx').on(t.sessionId) }));

/* ---------- Admin users ---------- */
export const adminUsers = pgTable('admin_users', {
  uid: varchar('uid', { length: 128 }).primaryKey(),         // Firebase uid
  email: varchar('email', { length: 240 }).notNull(),
  name: varchar('name', { length: 160 }),
  role: varchar('role', { length: 30 }).notNull().default('ADMIN'), // OWNER/ADMIN/EDITOR
  createdAt: now('created_at'),
});

/* ---------- Notification queue ---------- */
export const notifications = pgTable('notifications', {
  id: id('id'),
  uid: varchar('uid', { length: 128 }),                      // target admin uid, null = broadcast
  type: varchar('type', { length: 40 }).notNull(),           // lead_new/message_new/...
  title: varchar('title', { length: 240 }).notNull(),
  body: text('body'),
  link: varchar('link', { length: 300 }),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: now('created_at'),
}, (t) => ({ uidIdx: index('n_uid_idx').on(t.uid) }));
