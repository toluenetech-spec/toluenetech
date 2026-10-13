-- FOREIGN KEYS (APPLY AFTER DATA INTEGRITY AUDIT)
--
-- This script is NOT applied automatically by drizzle-kit migrate. It contains
-- foreign-key constraints that will FAIL if orphan records exist. Before running
-- this in production:
--   1. Run scripts/audit-orphans.sh (or the SQL below) to report orphans.
--   2. Either soft-delete or re-parent orphans.
--   3. Apply this migration manually against Neon.
--
-- Cascade policy summary:
--   Deleting a client     -> RESTRICT if ACTIVE projects exist;
--                            SET NULL on leads (lead remains but loses link);
--                            CASCADE on client-only data (notifications scoped to client).
--   Deleting a project    -> CASCADE milestones/tasks/files/messages.
--   Deleting a milestone  -> SET NULL task.milestone_id (tasks remain).
--   Deleting a lead       -> SET NULL assistant_sessions.captured_lead_id.
--   Public portfolio projects (projects table) are independent of clients;
--   client_projects.public_project_id is SET NULL on project delete.

-- 1. Client identity
ALTER TABLE "client_projects"
  ADD CONSTRAINT "cp_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;

ALTER TABLE "invoices"
  ADD CONSTRAINT "inv_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;

ALTER TABLE "project_files"
  ADD CONSTRAINT "pf_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;

ALTER TABLE "notifications"
  ADD CONSTRAINT "n_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;

-- 2. Client projects
ALTER TABLE "milestones"
  ADD CONSTRAINT "ms_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tk_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE;

ALTER TABLE "project_files"
  ADD CONSTRAINT "pf_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE CASCADE;

ALTER TABLE "messages"
  ADD CONSTRAINT "msg_ctx_project_fk" FOREIGN KEY ("context_id") REFERENCES "client_projects"("id") ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "invoices"
  ADD CONSTRAINT "inv_project_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE SET NULL;

ALTER TABLE "client_projects"
  ADD CONSTRAINT "cp_public_fk" FOREIGN KEY ("public_project_id") REFERENCES "projects"("id") ON DELETE SET NULL;

-- 3. Milestones
ALTER TABLE "tasks"
  ADD CONSTRAINT "tk_milestone_fk" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL;

-- 4. Leads
ALTER TABLE "leads"
  ADD CONSTRAINT "lead_client_fk" FOREIGN KEY ("converted_client_id") REFERENCES "clients"("id") ON DELETE SET NULL;

-- Note: assistant_sessions.captured_lead_id references leads but messages.contextId
-- can point to leads too; we add those as FK once leads/convertedClientId is clean.
ALTER TABLE "assistant_sessions"
  ADD CONSTRAINT "as_lead_fk" FOREIGN KEY ("captured_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;

-- 5. Testimonials -> portfolio project
ALTER TABLE "testimonials"
  ADD CONSTRAINT "tm_proj_fk" FOREIGN KEY ("related_project_id") REFERENCES "projects"("id") ON DELETE SET NULL;

-- 6. Media (project-scoped files) -> client projects
ALTER TABLE "media"
  ADD CONSTRAINT "media_proj_fk" FOREIGN KEY ("project_id") REFERENCES "client_projects"("id") ON DELETE SET NULL;
ALTER TABLE "media"
  ADD CONSTRAINT "media_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;

-- 7. Ai usage -> assistant_sessions
ALTER TABLE "ai_usage"
  ADD CONSTRAINT "au_sess_fk" FOREIGN KEY ("session_id") REFERENCES "assistant_sessions"("id") ON DELETE SET NULL;
ALTER TABLE "ai_usage"
  ADD CONSTRAINT "au_client_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;

-- Orphan-reporting queries (run first; counts must all be 0 before FKs apply):
--   SELECT COUNT(*) FROM client_projects cp LEFT JOIN clients c ON c.id = cp.client_id WHERE c.id IS NULL;
--   SELECT COUNT(*) FROM milestones m    LEFT JOIN client_projects p ON p.id = m.project_id WHERE p.id IS NULL;
--   SELECT COUNT(*) FROM tasks t         LEFT JOIN client_projects p ON p.id = t.project_id WHERE p.id IS NULL;
--   SELECT COUNT(*) FROM project_files f LEFT JOIN client_projects p ON p.id = f.project_id WHERE p.id IS NULL;
--   SELECT COUNT(*) FROM messages m
--     WHERE m.context_type = 'PROJECT' AND m.context_id IS NOT NULL
--       AND NOT EXISTS (SELECT 1 FROM client_projects p WHERE p.id = m.context_id);
--   SELECT COUNT(*) FROM invoices i      LEFT JOIN clients c ON c.id = i.client_id WHERE c.id IS NULL;
--   SELECT COUNT(*) FROM leads l WHERE l.converted_client_id IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = l.converted_client_id);
--   SELECT COUNT(*) FROM testimonials t WHERE t.related_project_id IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = t.related_project_id);
