-- 00-reset.sql — run ONCE before the other chunks if a prior run partially
-- created tables. Drops & recreates the public schema. Skip on a fresh DB.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
