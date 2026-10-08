-- Phase 2+3 migration: CMS + CRM foundation.
-- Apply after 0002_foreign_keys_manual.sql. Safe for existing databases; uses
-- IF NOT EXISTS / ADD VALUE IF NOT EXISTS throughout.

-- 1. New CMS tables.
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
--> statement-breakpoint
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
--> statement-breakpoint
-- 2. Lead notes (activity timeline).
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ln_lead_idx" ON "lead_notes" ("lead_id");
--> statement-breakpoint
-- 3. Page views (privacy-friendly analytics).
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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pv_path_idx" ON "page_views" ("path", "created_at");
--> statement-breakpoint
-- 4. Add ARCHIVED to lead_status enum (safe additive change).
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'ARCHIVED';
--> statement-breakpoint
-- 5. Extend leads with attribution + assignment fields.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_page varchar(300);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_ref varchar(64);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to varchar(128);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at timestamp with time zone;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS lead_assigned_idx ON leads (assigned_to);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ins_slug_idx ON insights (slug);
CREATE UNIQUE INDEX IF NOT EXISTS tools_name_idx ON tools (name);
