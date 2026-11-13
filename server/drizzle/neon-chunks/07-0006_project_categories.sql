-- 07-0006_project_categories.sql
-- Adds:
--   * project_categories table (user-managed portfolio categories)
--   * projects.category_id FK + legacy "category" varchar column
-- This is non-destructive and idempotent.
BEGIN;

CREATE TABLE IF NOT EXISTS project_categories (
  id varchar(32) PRIMARY KEY,
  slug varchar(120) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  description text,
  color varchar(16),
  icon varchar(60),
  is_published boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  seo_title varchar(200),
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Legacy: projects table has no category column yet (frontend expects one).
-- We keep both: category (free-text, legacy/quick) and category_id (FK, managed).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category varchar(80);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category_id varchar(32) REFERENCES project_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS prj_cat_idx ON projects(category);
CREATE INDEX IF NOT EXISTS prj_catid_idx ON projects(category_id);
CREATE INDEX IF NOT EXISTS prjcat_order_idx ON project_categories("order");

-- Seed the 8 default categories from the frontend PROJECT_CATEGORY_ORDER.
INSERT INTO project_categories (id, slug, name, description, is_published, "order") VALUES
  ('cat_websites',   'websites',   'Websites',   'Marketing & business websites', true, 1),
  ('cat_webapps',    'web-apps',   'Web Apps',   'Full-stack web applications',   true, 2),
  ('cat_mobile',     'mobile-apps','Mobile Apps','iOS & Android apps',            true, 3),
  ('cat_uiux',       'ui-ux',      'UI/UX',      'Product & interface design',    true, 4),
  ('cat_ai',         'ai',         'AI',         'AI integration & automation',   true, 5),
  ('cat_branding',   'branding',   'Branding',   'Brand identity & product design', true, 6),
  ('cat_graphics',   'graphics',   'Graphics',   'Graphic design',                true, 7),
  ('cat_video',      'video',      'Video',      'Motion & video editing',        true, 8)
ON CONFLICT (slug) DO NOTHING;

-- Track migration
INSERT INTO __migrations(tag, applied_at) VALUES ('0006', now())
  ON CONFLICT (tag) DO NOTHING;

COMMIT;
