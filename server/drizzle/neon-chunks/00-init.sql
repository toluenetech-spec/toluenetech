-- 00-init.sql — creates the __migrations tracker. Run after 00-reset.
CREATE TABLE IF NOT EXISTS __migrations (
  tag text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
