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
