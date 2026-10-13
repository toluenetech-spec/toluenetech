import {
  pgTable, pgEnum, text, varchar, boolean, integer, numeric,
  timestamp, jsonb, doublePrecision, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

/* ---------- Enums ---------- */
export const availabilityEnum = pgEnum('availability', ['AVAILABLE', 'LIMITED', 'UNAVAILABLE']);
export const projectStatusEnum = pgEnum('project_status', [
  'PLANNING', 'IN_PROGRESS', 'ACTIVE', 'ON_HOLD', 'PAUSED', 'REVIEW',
  'COMPLETED', 'CANCELLED', 'ARCHIVED',
]);
export const publishStateEnum = pgEnum('publish_state', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const productStatusEnum = pgEnum('product_status', ['IDEA', 'PROTOTYPE', 'IN_DEV', 'BETA', 'LIVE', 'ARCHIVED']);
export const labCategoryEnum = pgEnum('lab_category', ['AI', 'EXPERIMENT', 'TOOL', 'RESEARCH']);
export const leadStatusEnum = pgEnum('lead_status', [
  'NEW', 'CONTACTED', 'QUALIFIED', 'DISCOVERY', 'PROPOSAL',
  'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED',
]);
export const clientStatusEnum = pgEnum('client_status', ['ACTIVE', 'INACTIVE']);
export const milestoneStatusEnum = pgEnum('milestone_status', ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED']);
export const taskStatusEnum = pgEnum('task_status', ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
export const taskPriorityEnum = pgEnum('task_priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID']);
export const paymentStatusEnum = pgEnum('payment_status', ['PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED']);
export const invoiceItemKindEnum = pgEnum('invoice_item_kind', ['SERVICE', 'MILESTONE', 'HOURLY', 'PRODUCT', 'DISCOUNT', 'TAX', 'CUSTOM']);
export const messageContextEnum = pgEnum('message_context', ['PROJECT', 'LEAD', 'GENERAL']);
export const auditActionEnum = pgEnum('audit_action', [
  'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT',
  'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH',
  'AI_CONFIG_UPDATE', 'MODEL_CHANGE', 'SETTINGS_UPDATE',
  'FILE_UPLOAD', 'FILE_DELETE',
  'PERMISSION_CHANGE', 'PASSWORD_CHANGE', 'ACCESS_CODE_GENERATED',
  'LEAD_CONVERT',
  'MILESTONE_APPROVE', 'MILESTONE_REJECT',
  'INVOICE_SEND', 'INVOICE_VIEW',
  'PAYMENT_VERIFY',
  'MESSAGE_SEND', 'NOTIFICATION_READ',
]);
export const fileVisibilityEnum = pgEnum('file_visibility', ['PUBLIC', 'PRIVATE']);

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
  source: varchar('source', { length: 80 }),                // contact|service|portfolio|assistant|ai-lab|whatsapp|direct|referral|other|unknown
  sourcePage: varchar('source_page', { length: 300 }),      // the page URL where this lead originated
  aiRef: varchar('ai_ref', { length: 64 }),                 // assistant session id if AI-originated
  assignedTo: varchar('assigned_to', { length: 128 }),      // admin uid
  notes: text('notes'),
  status: leadStatusEnum('status').notNull().default('NEW'),
  followUpDate: timestamp('follow_up_date', { mode: 'date', withTimezone: true }),
  lastContactedAt: timestamp('last_contacted_at', { mode: 'date', withTimezone: true }),
  convertedClientId: varchar('converted_client_id', { length: 36 }),
  convertedAt: timestamp('converted_at', { mode: 'date', withTimezone: true }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({
  emailIdx: index('lead_email_idx').on(t.email),
  statusIdx: index('lead_status_idx').on(t.status),
}));

/* ---------- Lead notes (activity timeline) ---------- */
export const leadNotes = pgTable('lead_notes', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: varchar('lead_id', { length: 36 }).notNull(),
  authorType: varchar('author_type', { length: 16 }).notNull().default('admin'), // admin|client|ai|system
  authorId: varchar('author_id', { length: 128 }),
  authorName: varchar('author_name', { length: 160 }),
  type: varchar('type', { length: 30 }).notNull().default('note'), // note|status_change|email|sms|ai_summary
  body: text('body').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
  createdAt: now('created_at'),
}, (t) => ({ leadIdx: index('ln_lead_idx').on(t.leadId) }));

/* ---------- Solutions ---------- */
export const solutions = pgTable('solutions', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  tagline: varchar('tagline', { length: 240 }),
  description: text('description'),
  icon: varchar('icon', { length: 60 }).default('Globe'),
  features: jsonb('features').$type<string[]>().default([]),
  benefits: jsonb('benefits').$type<string[]>().default([]),
  imageUrl: varchar('image_url', { length: 500 }),
  relatedServiceIds: jsonb('related_service_ids').$type<string[]>().default([]),
  ctaLabel: varchar('cta_label', { length: 60 }).default('Learn more'),
  ctaUrl: varchar('cta_url', { length: 240 }),
  isPublished: boolean('is_published').notNull().default(false),
  isFeatured: boolean('is_featured').notNull().default(false),
  order: integer('order').notNull().default(0),
  seoTitle: varchar('seo_title', { length: 200 }),
  seoDescription: text('seo_description'),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ slugIdx: uniqueIndex('sol_slug_idx').on(t.slug) }));

/* ---------- Tools / Technology stack ---------- */
export const tools = pgTable('tools', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 120 }).notNull().unique(),
  category: varchar('category', { length: 40 }).notNull().default('Development'),
  logoUrl: varchar('logo_url', { length: 500 }),
  description: text('description'),
  websiteUrl: varchar('website_url', { length: 500 }),
  isPublished: boolean('is_published').notNull().default(true),
  order: integer('order').notNull().default(0),
  createdAt: now('created_at'),
});

/* ---------- Page views (lightweight privacy-friendly analytics) ---------- */
export const pageViews = pgTable('page_views', {
  id: varchar('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  path: varchar('path', { length: 300 }).notNull(),
  referrer: varchar('referrer', { length: 300 }),
  anonId: varchar('anon_id', { length: 64 }),
  country: varchar('country', { length: 8 }),
  userAgentHash: varchar('ua_hash', { length: 64 }),
  sessionId: varchar('session_id', { length: 64 }),
  utmSource: varchar('utm_source', { length: 80 }),
  utmMedium: varchar('utm_medium', { length: 80 }),
  utmCampaign: varchar('utm_campaign', { length: 120 }),
  createdAt: now('created_at'),
}, (t) => ({ pathIdx: index('pv_path_idx').on(t.path, t.createdAt) }));

/* ---------- Clients ---------- */
export const clients = pgTable('clients', {
  id: id('id'),
  userId: varchar('user_id', { length: 128 }).unique(),     // Firebase uid
  name: varchar('name', { length: 160 }).notNull(),
  email: varchar('email', { length: 240 }).notNull().unique(),
  phone: varchar('phone', { length: 40 }),
  company: varchar('company', { length: 180 }),
  // accessCode is the 6-char code the client uses to log in via POST /client/login.
  // Generated on create; regeneratable by admin. Stored in DB (NOT client-side).
  accessCode: varchar('access_code', { length: 32 }),
  // lastLoginAt is updated on successful client session issuance.
  lastLoginAt: timestamp('last_login_at', { mode: 'date', withTimezone: true }),
  status: clientStatusEnum('status').notNull().default('ACTIVE'),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ emailIdx: index('cl_email_idx').on(t.email) }));

/* ---------- Projects for clients (separate from public portfolio projects) ---------- */
export const clientProjects = pgTable('client_projects', {
  id: id('id'),
  clientId: varchar('client_id', { length: 36 }).notNull(),
  publicProjectId: varchar('public_project_id', { length: 36 }), // optional link to portfolio project
  title: varchar('title', { length: 220 }).notNull(),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('ACTIVE'),
  priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
  progress: integer('progress').notNull().default(0),        // 0-100
  assignee: varchar('assignee', { length: 128 }),
  startDate: timestamp('start_date', { mode: 'date', withTimezone: true }),
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  totalCents: integer('total_cents').default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  archivedAt: timestamp('archived_at', { mode: 'date', withTimezone: true }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ clientIdx: index('cp_client_idx').on(t.clientId), statusIdx: index('cp_status_idx').on(t.clientId, t.status) }));

export const milestones = pgTable('milestones', {
  id: id('id'),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  title: varchar('title', { length: 220 }).notNull(),
  description: text('description'),
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  status: milestoneStatusEnum('status').notNull().default('PENDING'),
  amountCents: integer('amount_cents'),
  approvedAt: timestamp('approved_at', { mode: 'date', withTimezone: true }),
  approvedBy: varchar('approved_by', { length: 128 }),
  rejectionReason: text('rejection_reason'),
  order: integer('order').notNull().default(0),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ projectIdx: index('ms_proj_idx').on(t.projectId), projStatusIdx: index('ms_proj_status_idx').on(t.projectId, t.status) }));

export const milestoneApprovals = pgTable('milestone_approvals', {
  id: id('id'),
  milestoneId: varchar('milestone_id', { length: 36 }).notNull(),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  clientId: varchar('client_id', { length: 36 }).notNull(),
  action: varchar('action', { length: 20 }).notNull(),          // APPROVED | REJECTED
  comment: text('comment'),
  actorType: varchar('actor_type', { length: 16 }).notNull(),   // client|admin|system
  actorId: varchar('actor_id', { length: 128 }),
  actorName: varchar('actor_name', { length: 160 }),
  createdAt: now('created_at'),
}, (t) => ({ milestoneIdx: index('ma_milestone_idx').on(t.milestoneId), projIdx: index('ma_proj_idx').on(t.projectId) }));

export const tasks = pgTable('tasks', {
  id: id('id'),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  milestoneId: varchar('milestone_id', { length: 36 }),
  title: varchar('title', { length: 240 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').notNull().default('TODO'),
  priority: taskPriorityEnum('priority').notNull().default('MEDIUM'),
  assignee: varchar('assignee', { length: 120 }),
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
  completedBy: varchar('completed_by', { length: 128 }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ projectIdx: index('tk_proj_idx').on(t.projectId), projStatusIdx: index('tk_proj_status_idx').on(t.projectId, t.status) }));

export const projectFiles = pgTable('project_files', {
  id: id('id'),
  projectId: varchar('project_id', { length: 36 }).notNull(),
  clientId: varchar('client_id', { length: 36 }),              // denormalized for quick authorization
  uploadedBy: varchar('uploaded_by', { length: 128 }),        // uid
  uploadedByRole: varchar('uploaded_by_role', { length: 16 }), // admin|client
  filename: varchar('filename', { length: 240 }).notNull(),
  r2Key: varchar('r2_key', { length: 500 }).notNull(),
  sizeBytes: integer('size_bytes'),
  mimeType: varchar('mime_type', { length: 120 }),
  visibility: fileVisibilityEnum('visibility').notNull().default('PRIVATE'),
  replaceOf: varchar('replace_of', { length: 36 }),           // id of previous version
  deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({ projectIdx: index('pf_proj_idx').on(t.projectId), clientIdx: index('pf_client_idx').on(t.clientId), projVisIdx: index('pf_proj_vis_idx').on(t.projectId, t.deletedAt) }));

export const messages = pgTable('messages', {
  id: id('id'),
  contextType: messageContextEnum('context_type').notNull().default('GENERAL'),
  contextId: varchar('context_id', { length: 36 }),           // projectId or leadId
  threadId: varchar('thread_id', { length: 36 }),
  fromUid: varchar('from_uid', { length: 128 }),              // admin uid or client id prefix
  fromClientId: varchar('from_client_id', { length: 36 }),
  fromName: varchar('from_name', { length: 160 }).notNull(),
  toUid: varchar('to_uid', { length: 128 }),                  // recipient admin uid
  toClientId: varchar('to_client_id', { length: 36 }),
  toName: varchar('to_name', { length: 160 }),
  isFromClient: boolean('is_from_client').notNull().default(false),
  body: text('body').notNull(),
  attachments: jsonb('attachments').$type<{ filename: string; r2Key: string; sizeBytes?: number; mimeType?: string }[]>().default([]),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { mode: 'date', withTimezone: true }),
  createdAt: now('created_at'),
}, (t) => ({
  ctxIdx: index('msg_ctx_idx').on(t.contextType, t.contextId),
  threadIdx: index('msg_thread_idx').on(t.threadId),
  toAdminIdx: index('msg_to_admin_idx').on(t.toUid, t.isRead),
  toClientIdx: index('msg_to_client_idx').on(t.toClientId, t.isRead),
}));

export const invoices = pgTable('invoices', {
  id: id('id'),
  clientId: varchar('client_id', { length: 36 }).notNull(),
  projectId: varchar('project_id', { length: 36 }),
  number: varchar('number', { length: 40 }).notNull().unique(),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: varchar('status', { length: 30 }).notNull().default('DRAFT'), // DRAFT/SENT/VIEWED/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED/VOID
  notes: text('notes'),
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }),
  issuedAt: timestamp('issued_at', { mode: 'date', withTimezone: true }),
  viewedAt: timestamp('viewed_at', { mode: 'date', withTimezone: true }),
  paidAt: timestamp('paid_at', { mode: 'date', withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { mode: 'date', withTimezone: true }),
  cancellationReason: text('cancellation_reason'),
  pdfR2Key: varchar('pdf_r2_key', { length: 500 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: now('created_at'),
}, (t) => ({
  clientIdx: index('inv_client_idx').on(t.clientId),
  projectIdx: index('inv_project_idx').on(t.projectId),
  statusIdx: index('inv_status_idx').on(t.status),
}));

export const invoiceItems = pgTable('invoice_items', {
  id: id('id'),
  invoiceId: varchar('invoice_id', { length: 36 }).notNull(),
  kind: invoiceItemKindEnum('kind').notNull().default('CUSTOM'),
  description: text('description').notNull(),
  quantity: doublePrecision('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  amountCents: integer('amount_cents').notNull().default(0),
  order: integer('order_idx').notNull().default(0),
  createdAt: now('created_at'),
}, (t) => ({ invoiceIdx: index('ii_invoice_idx').on(t.invoiceId) }));

export const payments = pgTable('payments', {
  id: id('id'),
  invoiceId: varchar('invoice_id', { length: 36 }),
  clientId: varchar('client_id', { length: 36 }).notNull(),
  projectId: varchar('project_id', { length: 36 }),
  provider: varchar('provider', { length: 32 }).notNull().default('flutterwave'),
  providerRef: varchar('provider_ref', { length: 160 }),
  providerTransactionId: varchar('provider_transaction_id', { length: 160 }),
  amountCents: integer('amount_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  verifiedAt: timestamp('verified_at', { mode: 'date', withTimezone: true }),
  verificationMeta: jsonb('verification_meta').$type<Record<string, unknown>>().default({}),
  failureReason: text('failure_reason'),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).unique(),
  createdAt: now('created_at'),
  updatedAt: now('updated_at'),
}, (t) => ({
  clientIdx: index('pay_client_idx').on(t.clientId),
  invoiceIdx: index('pay_invoice_idx').on(t.invoiceId),
  providerRefIdx: index('pay_provider_ref_idx').on(t.providerRef),
}));

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
  visibility: fileVisibilityEnum('visibility').notNull().default('PUBLIC'),
  // Optional tagging so media can be reused across entities
  role: varchar('role', { length: 60 }),        // e.g. 'founder_image', 'brand_cv'
  projectId: varchar('project_id', { length: 36 }), // for project-scoped private files
  clientId: varchar('client_id', { length: 36 }),
  uploadedBy: varchar('uploaded_by', { length: 128 }),
  createdAt: now('created_at'),
}, (t) => ({
  r2Idx: uniqueIndex('media_r2_idx').on(t.r2Key),
  projectIdx: index('media_proj_idx').on(t.projectId),
}));

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
  clientId: varchar('client_id', { length: 36 }),            // target client (scoped)
  type: varchar('type', { length: 40 }).notNull(),           // lead_new/message_new/...
  title: varchar('title', { length: 240 }).notNull(),
  body: text('body'),
  link: varchar('link', { length: 300 }),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: now('created_at'),
}, (t) => ({ uidIdx: index('n_uid_idx').on(t.uid), cIdx: index('n_c_idx').on(t.clientId) }));

/* ---------- Audit logs (append-only) ---------- */
export const auditLogs = pgTable('audit_logs', {
  id: id('id'),
  actorType: varchar('actor_type', { length: 16 }).notNull(), // admin|client|public|system|ai
  actorId: varchar('actor_id', { length: 128 }),
  actorRole: varchar('actor_role', { length: 32 }),
  action: auditActionEnum('action').notNull(),
  entity: varchar('entity', { length: 64 }).notNull(),
  entityId: varchar('entity_id', { length: 36 }),
  success: boolean('success').notNull().default(true),
  ip: varchar('ip', { length: 64 }),
  ua: varchar('ua', { length: 300 }),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
  createdAt: now('created_at'),
}, (t) => ({
  actorIdx: index('al_actor_idx').on(t.actorType, t.actorId),
  entityIdx: index('al_entity_idx').on(t.entity, t.entityId),
  tsIdx: index('al_ts_idx').on(t.createdAt),
}));

/* ---------- AI usage (per-request telemetry) ---------- */
export const aiUsage = pgTable('ai_usage', {
  id: id('id'),
  surface: varchar('surface', { length: 24 }).notNull(),     // public/admin/client/planner/advisor/idea
  model: varchar('model', { length: 160 }).notNull(),
  fallbackUsed: boolean('fallback_used').notNull().default(false),
  reasonFallback: varchar('reason_fallback', { length: 80 }),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  latencyMs: integer('latency_ms'),
  errorCode: varchar('error_code', { length: 80 }),
  toolCalls: jsonb('tool_calls').$type<string[]>().default([]),
  sessionId: varchar('session_id', { length: 36 }),
  clientId: varchar('client_id', { length: 36 }),
  ip: varchar('ip', { length: 64 }),
  createdAt: now('created_at'),
}, (t) => ({
  surfaceIdx: index('ai_surf_idx').on(t.surface, t.createdAt),
  modelIdx: index('ai_model_idx').on(t.model),
  sessionIdx: index('ai_sess_idx').on(t.sessionId),
}));
