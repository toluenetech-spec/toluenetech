-- 00-init.sql — creates the __migrations tracker. Run after 00-reset.
CREATE TABLE IF NOT EXISTS __migrations (
  tag text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- 00-reset.sql — run ONCE before the other chunks if a prior run partially
-- created tables. Drops & recreates the public schema. Skip on a fresh DB.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 01-0000_bouncy_warbound.sql
BEGIN;
DO $$ BEGIN CREATE TYPE availability AS ENUM('AVAILABLE', 'LIMITED', 'UNAVAILABLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE project_status AS ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE publish_state AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE product_status AS ENUM('IDEA', 'PROTOTYPE', 'IN_DEV', 'BETA', 'LIVE', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE lab_category AS ENUM('AI', 'EXPERIMENT', 'TOOL', 'RESEARCH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE lead_status AS ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE client_status AS ENUM('ACTIVE', 'INACTIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE milestone_status AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE task_status AS ENUM('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE message_context AS ENUM('PROJECT', 'LEAD', 'GENERAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "admin_users" (
	"uid" varchar(128) PRIMARY KEY NOT NULL,
	"email" varchar(240) NOT NULL,
	"name" varchar(160),
	"role" varchar(30) DEFAULT 'ADMIN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assistant_messages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "assistant_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"anon_id" varchar(64) NOT NULL,
	"name" varchar(160),
	"email" varchar(240),
	"captured_lead_id" varchar(36),
	"intent" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "client_projects" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"client_id" varchar(36) NOT NULL,
	"public_project_id" varchar(36),
	"title" varchar(220) NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'ACTIVE' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"start_date" timestamp with time zone,
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clients" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" varchar(128),
	"name" varchar(160) NOT NULL,
	"email" varchar(240) NOT NULL,
	"phone" varchar(40),
	"company" varchar(180),
	"status" "client_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE IF NOT EXISTS "faqs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" varchar(80),
	"order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "invoices" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"client_id" varchar(36) NOT NULL,
	"project_id" varchar(36),
	"number" varchar(40) NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(30) DEFAULT 'DRAFT' NOT NULL,
	"due_date" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"pdf_r2_key" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);

CREATE TABLE IF NOT EXISTS "insights" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(240) NOT NULL,
	"excerpt" text,
	"cover_image" varchar(500),
	"content" text NOT NULL,
	"author" varchar(120),
	"category" varchar(80),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"publish_date" timestamp with time zone,
	"seo_title" varchar(200),
	"seo_description" text,
	"seo_og_image" varchar(500),
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insights_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "lab_items" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text,
	"category" "lab_category" DEFAULT 'EXPERIMENT' NOT NULL,
	"tech" jsonb DEFAULT '[]'::jsonb,
	"demo_url" varchar(500),
	"status" varchar(40) DEFAULT 'active' NOT NULL,
	"screenshots" jsonb DEFAULT '[]'::jsonb,
	"published_at" timestamp with time zone,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_items_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "leads" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"ref" varchar(16) NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(240) NOT NULL,
	"phone" varchar(40),
	"company" varchar(180),
	"services" jsonb DEFAULT '[]'::jsonb,
	"requirements" text,
	"budget" varchar(80),
	"timeline" varchar(80),
	"source" varchar(80),
	"notes" text,
	"status" "lead_status" DEFAULT 'NEW' NOT NULL,
	"follow_up_date" timestamp with time zone,
	"converted_client_id" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_ref_unique" UNIQUE("ref")
);

CREATE TABLE IF NOT EXISTS "media" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"filename" varchar(240) NOT NULL,
	"r2_key" varchar(500) NOT NULL,
	"public_url" varchar(600) NOT NULL,
	"mime_type" varchar(120),
	"size_bytes" integer,
	"width" integer,
	"height" integer,
	"alt" varchar(300),
	"uploaded_by" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_r2_key_unique" UNIQUE("r2_key")
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"context_type" "message_context" DEFAULT 'GENERAL' NOT NULL,
	"context_id" varchar(36),
	"from_uid" varchar(128),
	"from_name" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "milestones" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"title" varchar(220) NOT NULL,
	"description" text,
	"due_date" timestamp with time zone,
	"status" "milestone_status" DEFAULT 'PENDING' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"uid" varchar(128),
	"type" varchar(40) NOT NULL,
	"title" varchar(240) NOT NULL,
	"body" text,
	"link" varchar(300),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pricing_plans" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"tagline" varchar(240),
	"price_monthly" integer,
	"price_one_time" integer,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"cta_label" varchar(60) DEFAULT 'Start a project' NOT NULL,
	"cta_url" varchar(240),
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"logo" varchar(500),
	"screenshots" jsonb DEFAULT '[]'::jsonb,
	"features" jsonb DEFAULT '[]'::jsonb,
	"tech_stack" jsonb DEFAULT '[]'::jsonb,
	"status" "product_status" DEFAULT 'IDEA' NOT NULL,
	"demo_url" varchar(500),
	"website_url" varchar(500),
	"case_study_url" varchar(500),
	"is_published" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "project_files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"uploaded_by" varchar(128),
	"filename" varchar(240) NOT NULL,
	"r2_key" varchar(500) NOT NULL,
	"size_bytes" integer,
	"mime_type" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "projects" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(220) NOT NULL,
	"client_name" varchar(200),
	"client_logo" varchar(500),
	"role" varchar(120),
	"platform" varchar(80),
	"framework" varchar(80),
	"completion_date" timestamp with time zone,
	"status" "project_status" DEFAULT 'ACTIVE' NOT NULL,
	"cover_image" varchar(500),
	"gallery" jsonb DEFAULT '[]'::jsonb,
	"video_url" varchar(500),
	"challenge" text,
	"objective" text,
	"solution" text,
	"features" jsonb DEFAULT '[]'::jsonb,
	"process" jsonb DEFAULT '[]'::jsonb,
	"results" text,
	"metrics" jsonb DEFAULT '[]'::jsonb,
	"live_url" varchar(500),
	"github_url" varchar(500),
	"app_store_url" varchar(500),
	"play_store_url" varchar(500),
	"service_ids" jsonb DEFAULT '[]'::jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"has_client_permission" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"seo_title" varchar(200),
	"seo_description" text,
	"seo_og_image" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "services" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(200) NOT NULL,
	"short_description" text NOT NULL,
	"long_description" text,
	"icon" varchar(60),
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"related_project_ids" jsonb DEFAULT '[]'::jsonb,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"seo_title" varchar(200),
	"seo_description" text,
	"seo_og_image" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "site_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tasks" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"project_id" varchar(36) NOT NULL,
	"milestone_id" varchar(36),
	"title" varchar(240) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'TODO' NOT NULL,
	"assignee" varchar(120),
	"due_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "testimonials" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"role" varchar(120),
	"company" varchar(160),
	"photo" varchar(500),
	"testimonial" text NOT NULL,
	"related_project_id" varchar(36),
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN CREATE INDEX "am_sess_idx" ON "assistant_messages"("session_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "as_anon_idx" ON "assistant_sessions"("anon_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "cp_client_idx" ON "client_projects"("client_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "lead_email_idx" ON "leads"("email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "lead_status_idx" ON "leads"("status"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "msg_ctx_idx" ON "messages"("context_type","context_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "ms_proj_idx" ON "milestones"("project_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "n_uid_idx" ON "notifications"("uid"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "pf_proj_idx" ON "project_files"("project_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "prj_slug_idx" ON "projects"("slug"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "svc_slug_idx" ON "services"("slug"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "tk_proj_idx" ON "tasks"("project_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO __migrations (tag) VALUES ('0000_bouncy_warbound') ON CONFLICT DO NOTHING;
COMMIT;

-- 02-0001_tearful_millenium_guard.sql
BEGIN;
DO $$ BEGIN CREATE TYPE audit_action AS ENUM('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'UNPUBLISH', 'AI_CONFIG_UPDATE', 'MODEL_CHANGE', 'SETTINGS_UPDATE', 'FILE_UPLOAD', 'FILE_DELETE', 'PERMISSION_CHANGE', 'PASSWORD_CHANGE', 'ACCESS_CODE_GENERATED', 'LEAD_CONVERT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE file_visibility AS ENUM('PUBLIC', 'PRIVATE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ai_usage" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"surface" varchar(24) NOT NULL,
	"model" varchar(160) NOT NULL,
	"fallback_used" boolean DEFAULT false NOT NULL,
	"reason_fallback" varchar(80),
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"error_code" varchar(80),
	"tool_calls" jsonb DEFAULT '[]'::jsonb,
	"session_id" varchar(36),
	"client_id" varchar(36),
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"actor_type" varchar(16) NOT NULL,
	"actor_id" varchar(128),
	"actor_role" varchar(32),
	"action" "audit_action" NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entity_id" varchar(36),
	"success" boolean DEFAULT true NOT NULL,
	"ip" varchar(64),
	"ua" varchar(300),
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "access_code" varchar(32);

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp with time zone;

ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "visibility" "file_visibility" DEFAULT 'PUBLIC' NOT NULL;

ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "role" varchar(60);

ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "project_id" varchar(36);

ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "client_id" varchar(36);

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "client_id" varchar(36);

ALTER TABLE "project_files" ADD COLUMN IF NOT EXISTS "client_id" varchar(36);

ALTER TABLE "project_files" ADD COLUMN IF NOT EXISTS "uploaded_by_role" varchar(16);

ALTER TABLE "project_files" ADD COLUMN IF NOT EXISTS "visibility" "file_visibility" DEFAULT 'PRIVATE' NOT NULL;

DO $$ BEGIN CREATE INDEX "ai_surf_idx" ON "ai_usage" USING btree ("surface","created_at"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "ai_model_idx" ON "ai_usage" USING btree ("model"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "ai_sess_idx" ON "ai_usage" USING btree ("session_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "al_actor_idx" ON "audit_logs" USING btree ("actor_type","actor_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "al_entity_idx" ON "audit_logs" USING btree ("entity","entity_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "al_ts_idx" ON "audit_logs" USING btree ("created_at"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "cl_email_idx" ON "clients" USING btree ("email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE UNIQUE INDEX "media_r2_idx" ON "media" USING btree ("r2_key"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "media_proj_idx" ON "media" USING btree ("project_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "n_c_idx" ON "notifications" USING btree ("client_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX "pf_client_idx" ON "project_files" USING btree ("client_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "clients" ADD CONSTRAINT "clients_email_unique" UNIQUE("email"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO __migrations (tag) VALUES ('0001_tearful_millenium_guard') ON CONFLICT DO NOTHING;
COMMIT;

-- 03-0002_foreign_keys_manual.sql
BEGIN;
DO $$ BEGIN ALTER TABLE "client_projects" ADD CONSTRAINT "cp_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "inv_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "project_files" ADD CONSTRAINT "pf_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "notifications" ADD CONSTRAINT "n_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "milestones" ADD CONSTRAINT "ms_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tk_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "project_files" ADD CONSTRAINT "pf_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "msg_ctx_project_fk" FOREIGN KEY ("context_id") REFERENCES "client_projects"("id") ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "invoices" ADD CONSTRAINT "inv_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "client_projects" ADD CONSTRAINT "cp_public_fk" FOREIGN KEY ("public_project_id") REFERENCES "projects"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "tasks" ADD CONSTRAINT "tk_milestone_fk" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "leads" ADD CONSTRAINT "lead_client_fk" FOREIGN KEY ("converted_client_id") REFERENCES "clients"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "assistant_sessions" ADD CONSTRAINT "as_lead_fk" FOREIGN KEY ("captured_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "testimonials" ADD CONSTRAINT "tm_proj_fk" FOREIGN KEY ("related_project_id") REFERENCES "projects"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "media" ADD CONSTRAINT "media_proj_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "media" ADD CONSTRAINT "media_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "ai_usage" ADD CONSTRAINT "au_sess_fk" FOREIGN KEY ("session_id") REFERENCES "assistant_sessions"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "ai_usage" ADD CONSTRAINT "au_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO __migrations (tag) VALUES ('0002_foreign_keys_manual') ON CONFLICT DO NOTHING;
COMMIT;

-- 04-0003_phase2_cms_crm.sql
BEGIN;
CREATE TABLE IF NOT EXISTS "solutions" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "slug" varchar(120) NOT NULL,
  "title" varchar(200) NOT NULL,
  "tagline" varchar(240),
  "description" text,
  "icon" varchar(60) DEFAULT 'Globe',
  "features" jsonb DEFAULT '[]'::jsonb,
  "benefits" jsonb DEFAULT '[]'::jsonb,
  "image_url" varchar(500),
  "related_service_ids" jsonb DEFAULT '[]'::jsonb,
  "cta_label" varchar(60) DEFAULT 'Learn more',
  "cta_url" varchar(240),
  "is_published" boolean DEFAULT false NOT NULL,
  "is_featured" boolean DEFAULT false NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "seo_title" varchar(200),
  "seo_description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "solutions_slug_unique" UNIQUE("slug")
);

CREATE TABLE IF NOT EXISTS "tools" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "name" varchar(120) NOT NULL,
  "category" varchar(40) DEFAULT 'Development' NOT NULL,
  "logo_url" varchar(500),
  "description" text,
  "website_url" varchar(500),
  "is_published" boolean DEFAULT true NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tools_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "lead_notes" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "lead_id" varchar(36) NOT NULL,
  "author_type" varchar(16) DEFAULT 'admin' NOT NULL,
  "author_id" varchar(128),
  "author_name" varchar(160),
  "type" varchar(30) DEFAULT 'note' NOT NULL,
  "body" text NOT NULL,
  "meta" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS "ln_lead_idx" ON "lead_notes" ("lead_id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "page_views" (
  "id" varchar(36) PRIMARY KEY NOT NULL,
  "path" varchar(300) NOT NULL,
  "referrer" varchar(300),
  "anon_id" varchar(64),
  "country" varchar(8),
  "ua_hash" varchar(64),
  "session_id" varchar(64),
  "utm_source" varchar(80),
  "utm_medium" varchar(80),
  "utm_campaign" varchar(120),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS "pv_path_idx" ON "page_views" ("path", "created_at"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_page varchar(300);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_ref varchar(64);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to varchar(128);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at timestamp with time zone;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at timestamp with time zone;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS lead_assigned_idx ON leads (assigned_to); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS ins_slug_idx ON insights (slug); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE UNIQUE INDEX IF NOT EXISTS tools_name_idx ON tools (name); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO __migrations (tag) VALUES ('0003_phase2_cms_crm') ON CONFLICT DO NOTHING;
COMMIT;

-- 05-0004_phase4_operations.sql
BEGIN;
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'PLANNING';

ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'IN_PROGRESS';

ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'ON_HOLD';

ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'REVIEW';

ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE milestone_status ADD VALUE IF NOT EXISTS 'REJECTED';

DO $$ BEGIN CREATE TYPE invoice_status AS ENUM('DRAFT','SENT','VIEWED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','VOID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_status AS ENUM('PENDING','SUCCESSFUL','FAILED','REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE task_priority AS ENUM('LOW','MEDIUM','HIGH','URGENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE invoice_item_kind AS ENUM('SERVICE','MILESTONE','HOURLY','PRODUCT','DISCOUNT','TAX','CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'MEDIUM';

ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS assignee varchar(128);

ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS total_cents integer DEFAULT 0;

ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'USD';

ALTER TABLE client_projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS amount_cents integer;

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS approved_at timestamptz;

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS approved_by varchar(128);

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority task_priority NOT NULL DEFAULT 'MEDIUM';

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by varchar(128);

ALTER TABLE project_files ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE project_files ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE project_files ADD COLUMN IF NOT EXISTS replace_of varchar(36);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_uid varchar(128);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_client_id varchar(36);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_name varchar(160);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id varchar(36);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_from_client boolean NOT NULL DEFAULT false;

ALTER TABLE messages DROP COLUMN IF EXISTS is_read;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS msg_thread_idx ON messages(thread_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS msg_to_admin_idx ON messages(to_uid, is_read); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS msg_to_client_idx ON messages(to_client_id, is_read); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS milestone_approvals (
  id varchar(36) PRIMARY KEY,
  milestone_id varchar(36) NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  project_id varchar(36) NOT NULL,
  client_id varchar(36) NOT NULL,
  action varchar(20) NOT NULL,        -- APPROVED | REJECTED
  comment text,
  actor_type varchar(16) NOT NULL,    -- client|admin|system
  actor_id varchar(128),
  actor_name varchar(160),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS ma_milestone_idx ON milestone_approvals(milestone_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS ma_proj_idx ON milestone_approvals(project_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS invoice_items (
  id varchar(36) PRIMARY KEY,
  invoice_id varchar(36) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind invoice_item_kind NOT NULL DEFAULT 'CUSTOM',
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  order_idx integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS ii_invoice_idx ON invoice_items(invoice_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal_cents integer NOT NULL DEFAULT 0;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_at timestamptz;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS inv_client_idx ON invoices(client_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS inv_project_idx ON invoices(project_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS inv_status_idx ON invoices(status); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS payments (
  id varchar(36) PRIMARY KEY,
  invoice_id varchar(36) REFERENCES invoices(id) ON DELETE SET NULL,
  client_id varchar(36) NOT NULL,
  project_id varchar(36),
  provider varchar(32) NOT NULL DEFAULT 'flutterwave',    -- flutterwave|manual
  provider_ref varchar(160),                              -- tx_ref / flw_ref
  provider_transaction_id varchar(160),                   -- Flutterwave transaction id
  amount_cents integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'PENDING',
  verified_at timestamptz,
  verification_meta jsonb DEFAULT '{}'::jsonb,
  failure_reason text,
  idempotency_key varchar(128) UNIQUE,                    -- for duplicate protection
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN CREATE INDEX IF NOT EXISTS pay_client_idx ON payments(client_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS pay_invoice_idx ON payments(invoice_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS pay_provider_ref_idx ON payments(provider_ref); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS ms_proj_status_idx ON milestones(project_id, status); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS tk_proj_status_idx ON tasks(project_id, status); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS pf_proj_vis_idx ON project_files(project_id, deleted_at); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE INDEX IF NOT EXISTS n_unread_client_idx ON notifications(client_id, is_read) WHERE client_id IS NOT NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'MILESTONE_APPROVE';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'MILESTONE_REJECT';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'INVOICE_SEND';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'INVOICE_VIEW';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'PAYMENT_VERIFY';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'MESSAGE_SEND';

ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'NOTIFICATION_READ';
INSERT INTO __migrations (tag) VALUES ('0004_phase4_operations') ON CONFLICT DO NOTHING;
COMMIT;

-- 06-seed.sql — default site_settings. Run last.
BEGIN;
INSERT INTO site_settings (key, value)
VALUES ('site', jsonb_build_object(
  'company', jsonb_build_object('name','Toluene Tech','email','hello@toluenetech.com'),
  'contact', jsonb_build_object('email','hello@toluenetech.com'),
  'availability', 'AVAILABLE',
  'hero', jsonb_build_object(
    'title','Ship software that actually works.',
    'subtitle','Toluene Tech designs, builds and operates production-grade web, mobile and AI systems.',
    'primaryCta','Start a project',
    'primaryCtaHref','/start-project'
  ),
  'seo_defaults', jsonb_build_object(
    'siteName','Toluene Tech',
    'defaultTitle','Toluene Tech — Web, Mobile & AI Engineering'
  )
)) ON CONFLICT (key) DO NOTHING;
COMMIT;
