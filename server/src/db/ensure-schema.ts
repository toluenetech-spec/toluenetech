/**
 * Idempotent schema bootstrap.
 *
 * Cloudflare Workers spin up on every cold start. We run a tiny set of
 * CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS statements on the
 * first DB call of each isolate so that:
 *   - Missing migrations don't 500 the admin dashboard.
 *   - New columns added in code (like project_categories) are present before
 *     Drizzle SELECT * pulls them out.
 *
 * This is NOT a replacement for the real migration files (server/drizzle/neon-chunks/),
 * but it acts as a safety net for incremental forward-only changes. A boolean
 * promise gate ensures we only run once per isolate.
 *
 * NOTE: Statement splitting is simple (on ';') so do NOT use DO $$ blocks or
 * semicolons inside strings here.
 */
import { sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

let bootstrapPromise: Promise<void> | null = null;

const BOOTSTRAP_STATEMENTS: string[] = [
  // Migration tracker
  `CREATE TABLE IF NOT EXISTS __migrations (
     tag varchar(16) PRIMARY KEY,
     applied_at timestamptz NOT NULL DEFAULT now()
   )`,
  // Portfolio categories
  `CREATE TABLE IF NOT EXISTS project_categories (
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
   )`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS category varchar(80)`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS category_id varchar(32)`,
  // Create index before FK so the FK creation doesn't race
  `CREATE INDEX IF NOT EXISTS prj_cat_idx ON projects(category)`,
  `CREATE INDEX IF NOT EXISTS prj_catid_idx ON projects(category_id)`,
  `CREATE INDEX IF NOT EXISTS prjcat_order_idx ON project_categories("order")`,
  // Seed default categories (ON CONFLICT DO NOTHING is safe)
  `INSERT INTO project_categories (id,slug,name,description,is_published,"order") VALUES
     ('cat_websites','websites','Websites','Marketing & business websites',true,1),
     ('cat_webapps','web-apps','Web Apps','Full-stack web applications',true,2),
     ('cat_mobile','mobile-apps','Mobile Apps','iOS & Android apps',true,3),
     ('cat_uiux','ui-ux','UI/UX','Product & interface design',true,4),
     ('cat_ai','ai','AI','AI integration & automation',true,5),
     ('cat_branding','branding','Branding','Brand identity & product design',true,6),
     ('cat_graphics','graphics','Graphics','Graphic design',true,7),
     ('cat_video','video','Video','Motion & video editing',true,8)
   ON CONFLICT (slug) DO NOTHING`,
  // FK constraint — add it idempotently. ALTER TABLE ADD CONSTRAINT IF NOT
  // EXISTS is supported in Postgres 12+ and Neon runs a recent version.
  `ALTER TABLE projects ADD CONSTRAINT IF NOT EXISTS projects_category_id_fkey
     FOREIGN KEY (category_id) REFERENCES project_categories(id) ON DELETE SET NULL`,
  // Mark migration 0006 as applied
  `INSERT INTO __migrations(tag, applied_at) VALUES ('0006', now()) ON CONFLICT (tag) DO NOTHING`,
];

export function ensureSchema(db: NeonHttpDatabase<any>): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const failures: string[] = [];
    for (const stmt of BOOTSTRAP_STATEMENTS) {
      try { await db.execute(sql.raw(stmt)); }
      catch (e) {
        // Some statements (like ADD CONSTRAINT IF NOT EXISTS on older PG or
        // duplicate column with a different nullability) may legitimately fail
        // on re-runs — log but continue so subsequent tables can be created.
        const msg = (e as Error)?.message || String(e);
        failures.push(`${stmt.slice(0, 80).replace(/\s+/g,' ')}… → ${msg.slice(0, 160)}`);
      }
    }
    if (failures.length) {
      console.warn('[db] bootstrap completed with', failures.length, 'warning(s):', failures);
    } else {
      console.log('[db] schema bootstrap complete');
    }
  })();
  return bootstrapPromise;
}
// trigger 1794607323
