-- Toluene Tech V2 — baseline content seed
-- Run this in Neon SQL Editor AFTER neon-init.sql.
-- Idempotent (ON CONFLICT DO UPDATE) so it's safe to run more than once.

-- ---------- Services ----------
INSERT INTO services (id, slug, title, short_description, long_description, icon, capabilities, "order", is_published, is_featured) VALUES
  ('svc-web-design','web-design','Web Design','Premium websites and landing pages that blend beautiful design with fast, SEO-ready engineering.','Establish a credible digital presence that converts visitors into customers.','Globe','["Responsive design","CMS integration","SEO optimization","Performance tuning","Conversion-focused layouts","Analytics setup"]'::jsonb,1,true,true),
  ('svc-frontend','frontend-development','Frontend Development','Scalable, high-performance frontend architecture built on React and modern web standards.','Keep your application fast, interactive, and easy to scale.','Code','["React / Next.js apps","State management","API integration","Design systems","Accessibility","Performance audits"]'::jsonb,2,true,true),
  ('svc-uiux','ui-ux-design','UI/UX Design','User-centric interfaces designed for clarity, usability, and measurable outcomes.','Reduce friction for your users and drive higher adoption.','Layout','["Wireframing","Prototyping","User research","Design systems","Usability audits","Accessibility reviews"]'::jsonb,3,true,true),
  ('svc-app-design','app-design','App Design','Beautiful, intuitive mobile and web app interfaces that feel native on every device.','Deliver app experiences users love.','PenTool','["iOS & Android UI","User flows","Interactive prototypes","Design handoff"]'::jsonb,4,true,false),
  ('svc-app-dev','app-development','App Development','Cross-platform and web applications engineered for speed and stability.','Turn your app idea into a polished product ready to ship.','Smartphone','["React-based apps","API & backend integration","Offline support","App store prep","Push notifications"]'::jsonb,5,true,false),
  ('svc-graphic','graphic-design','Graphic Design','Visual identity and digital design assets that tell your brand story consistently.','Build a cohesive brand image across every channel.','Layers','["Branding & logos","Iconography","Marketing assets","Digital brochures","Social media kits"]'::jsonb,6,true,false),
  ('svc-video','video-editing','Video Editing','Engaging motion graphics and polished video editing for brands that want to stand out.','Capture attention and explain complex ideas quickly.','Video','["Explainer videos","Logo reveals","Social media shorts","Lottie animations","Product demos"]'::jsonb,7,true,false),
  ('svc-ai','ai-integration','AI Integration & Automation','Build smarter digital experiences by integrating AI into websites, applications and business workflows.','Turn artificial intelligence into practical, revenue-driving digital solutions.','BrainCircuit','["AI chatbots & assistants","LLM / OpenAI & Gemini integrations","RAG & knowledge bases","AI search & recommendations","Business workflow automation","AI forms, dashboards & agents","AI document processing"]'::jsonb,8,true,true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description,
  icon = EXCLUDED.icon,
  capabilities = EXCLUDED.capabilities,
  "order" = EXCLUDED."order",
  is_published = EXCLUDED.is_published,
  is_featured = EXCLUDED.is_featured,
  updated_at = now();

-- ---------- FAQs ----------
INSERT INTO faqs (id, question, answer, category, "order", is_published) VALUES
  ('faq-1','Where is Toluene Tech based?','We operate remotely, with our primary base in Lagos, Nigeria, and work with clients globally.','General',1,true),
  ('faq-2','How long does a typical project take?','Most marketing websites ship in 2–4 weeks. Web apps, mobile apps, and AI integrations typically take 6–12 weeks depending on scope.','Projects',2,true),
  ('faq-3','Do you offer fixed-price or hourly pricing?','We offer custom quotes after discovery. Well-scoped work can be fixed-price; ongoing development is typically hourly or retainer-based.','Pricing',3,true),
  ('faq-4','Can you integrate AI into our existing website or app?','Yes — AI integration is one of our core services. We work with OpenAI, Gemini and Anthropic models over retrieval-augmented generation grounded in your data.','AI',4,true),
  ('faq-5','Do you provide ongoing support after launch?','Yes — maintenance retainers and continuous improvement packages are available.','Support',5,true)
ON CONFLICT (id) DO UPDATE SET
  question = EXCLUDED.question,
  answer = EXCLUDED.answer,
  category = EXCLUDED.category,
  "order" = EXCLUDED."order",
  is_published = EXCLUDED.is_published;

-- ---------- Pricing (starter baseline — you can edit via admin CMS later) ----------
INSERT INTO pricing_plans (id, name, tagline, price_one_time, currency, features, cta_label, cta_url, is_featured, is_published, "order") VALUES
  ('plan-landing','Landing Page','Single-page marketing site to launch fast.',1500,'USD','["Up to 5 sections","Responsive design","CMS-ready","SEO setup","1 round of revisions","Launch in 2 weeks"]'::jsonb,'Start a project','/start-project',false,true,1),
  ('plan-website','Website','Multi-page marketing site for established businesses.',4500,'USD','["Up to 8 pages","Custom design","CMS integration","Analytics + SEO","Contact form","3 rounds of revisions","4 weeks delivery"]'::jsonb,'Start a project','/start-project',true,true,2),
  ('plan-webapp','Web Application','Custom product, dashboard or SaaS build.',null,'USD','["Discovery & scoping","Design system","Frontend + backend","Admin panel","Hosting setup","Ongoing support available"]'::jsonb,'Request a quote','/start-project',false,true,3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_one_time = EXCLUDED.price_one_time,
  features = EXCLUDED.features,
  cta_label = EXCLUDED.cta_label,
  cta_url = EXCLUDED.cta_url,
  is_featured = EXCLUDED.is_featured,
  is_published = EXCLUDED.is_published,
  "order" = EXCLUDED."order";
