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
