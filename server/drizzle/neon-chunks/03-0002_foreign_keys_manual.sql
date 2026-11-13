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
