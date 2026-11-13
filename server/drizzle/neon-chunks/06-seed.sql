-- 06-seed.sql — default site_settings. Run last.
BEGIN;
INSERT INTO site_settings (key, value)
VALUES ('site', jsonb_build_object(
  'company', jsonb_build_object('name','Toluene Tech','email','hello@toluenetech.com'),
  'contact', jsonb_build_object('email','hello@toluenetech.com'),
  'availability', 'AVAILABLE',
  'hero', jsonb_build_object(
    'title','Ship software that actually works.',
    'subtitle','Toluene Tech designs, builds and operates production-grade web, mobile and AI systems.',
    'primaryCta','Start a project',
    'primaryCtaHref','/start-project'
  ),
  'seo_defaults', jsonb_build_object(
    'siteName','Toluene Tech',
    'defaultTitle','Toluene Tech — Web, Mobile & AI Engineering'
  )
)) ON CONFLICT (key) DO NOTHING;
COMMIT;
