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
