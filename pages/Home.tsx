import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Download, Sparkles, PenTool, Workflow, CheckCircle2,
  Smartphone, BrainCircuit, Globe, Code2, Bot, MessageSquare, HelpCircle,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { ProjectCard, ServiceCard } from '../components/UI';
import { resolveIcon } from '../lib/icons';
import {
  Reveal, StaggerGroup, StaggerItem, AnimatedHeadline, Magnetic, Counter, motion,
} from '../components/motion';
import { Aurora, FloatingShapes, GlowButton, Pill } from '../components/Premium';
import { AvailabilityBadge } from '../components/Sections';

const CAPABILITIES = [
  { icon: PenTool, title: 'Design', desc: 'UI/UX, brand, graphic and motion design built around your product goals.', items: ['UI/UX', 'Brand Identity', 'App Design', 'Video & Motion'] },
  { icon: Code2, title: 'Development', desc: 'Websites, web applications and mobile apps engineered with React & modern standards.', items: ['Websites', 'Web Apps', 'Mobile Apps', 'APIs & Integrations'] },
  { icon: BrainCircuit, title: 'Intelligence', desc: 'Practical AI integrations and automations that solve real business problems.', items: ['AI Chatbots', 'LLM Integrations', 'Workflow Automation', 'AI Search'] },
];

const Home: React.FC = () => {
  const { projects, services, testimonials, products, siteSettings, socialLinks, insights } = useData();
  const featured = projects.filter(p => p.isFeatured && p.isPublished).slice(0, 6);
  const publishedServices = services.filter(s => s.isPublished).slice(0, 8);
  const featuredTestimonials = testimonials.filter(t => t.isFeatured && t.isPublished).slice(0, 3);
  const aiService = services.find(s => s.slug === 'ai-integration');
  const latestInsights = insights.filter(i => i.isPublished).slice(0, 3);

  const whatsappMsg = encodeURIComponent("Hi Toluene Tech, I'd like to start a project.");
  const whatsappLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappMsg}`;

  return (
    <div className="overflow-x-hidden">
      {/* HERO */}
      <section className="tt-noise relative overflow-hidden pb-24 pt-14 md:pt-20">
        <Aurora variant="hero" />
        <div className="tt-grid-bg absolute inset-0" />
        <FloatingShapes />

        <div className="relative z-10 mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 flex justify-center">
              <AvailabilityBadge />
            </div>
            <Pill className="mb-8">
              <Sparkles className="h-3.5 w-3.5" /> {siteSettings.tagline}
            </Pill>
          </motion.div>

          <AnimatedHeadline
            as="h1"
            text={siteSettings.heroHeading || 'Design, develop & automate digital products'}
            highlight="automate"
            className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-6xl md:text-7xl"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}
            className="mx-auto mt-8 max-w-3xl text-lg leading-relaxed text-slate-600 dark:text-slate-300"
          >
            {siteSettings.heroSubheading}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            {['Design', 'Websites', 'Web Apps', 'Mobile Apps', 'AI', 'Automation'].map(r => (
              <span key={r} className="tt-glass rounded-full px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">{r}</span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Magnetic strength={0.25}>
              <GlowButton to="/start-project">
                {siteSettings.heroCtaPrimary || 'Start a Project'} <ArrowRight className="h-4 w-4" />
              </GlowButton>
            </Magnetic>
            <Magnetic strength={0.25}>
              <GlowButton to="/portfolio" variant="ghost">
                {siteSettings.heroCtaSecondary || 'Explore Our Work'}
              </GlowButton>
            </Magnetic>
          </motion.div>
        </div>

        {/* Code / product preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto mt-16 max-w-4xl px-4 sm:px-6"
        >
          <div className="tt-glass tt-glow-border overflow-hidden rounded-2xl shadow-card">
            <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-400/80" />
              <span className="ml-3 font-mono text-xs text-slate-500">toluenetech / studio.ts</span>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <pre className="overflow-hidden p-6 font-mono text-xs leading-relaxed text-slate-600 dark:text-slate-300">
{`const studio = build({
  design:  'premium, brand-led',
  web:     'fast, accessible sites',
  apps:    'web + mobile products',
  ai:      'practical automations',
});

export default studio;`}
              </pre>
              <div className="flex flex-col justify-center gap-3 border-t border-white/5 p-6 md:border-l md:border-t-0">
                {[
                  'Performance-first architecture',
                  'Accessibility AA by default',
                  'Production-ready AI integrations',
                  'Clear communication, fast delivery',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-brand-500" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <StaggerGroup className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { value: publishedServices.length, suffix: '', label: 'Core Services' },
            { value: projects.filter(p => p.isPublished).length, suffix: '+', label: 'Projects Delivered' },
            { value: 98, suffix: '%', label: 'Client Retention' },
            { value: 24, suffix: '/7', label: 'Support' },
          ].map(s => (
            <StaggerItem key={s.label}>
              <div className="tt-glass rounded-2xl p-6 text-center">
                <Counter to={s.value} suffix={s.suffix} className="font-display text-4xl font-bold tt-gradient-text md:text-5xl" />
                <span className="mt-2 block text-sm text-slate-500 dark:text-slate-400">{s.label}</span>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* WHAT WE DO */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <Reveal>
            <Pill className="mx-auto mb-4">What we do</Pill>
            <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
              One studio. Three disciplines.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
              We design, build and automate digital products from first idea to launch and beyond.
            </p>
          </Reveal>
        </div>
        <StaggerGroup className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {CAPABILITIES.map(c => {
            const Icon = c.icon;
            return (
              <StaggerItem key={c.title}>
                <div className="tt-glass tt-glow-border h-full rounded-3xl p-8 transition-all duration-500 hover:-translate-y-1.5">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-transparent ring-1 ring-brand-400/20">
                    <Icon className="h-6 w-6 text-brand-500" />
                  </div>
                  <h3 className="mb-2 font-display text-xl font-bold text-slate-900 dark:text-white">{c.title}</h3>
                  <p className="mb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.desc}</p>
                  <ul className="space-y-2">
                    {c.items.map(i => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {i}
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </section>

      {/* FEATURED WORK */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Reveal>
              <Pill className="mb-4">Selected work</Pill>
              <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
                Featured projects
              </h2>
            </Reveal>
          </div>
          <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:gap-3 dark:text-brand-300">
            View all work <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.08}><ProjectCard project={p} /></Reveal>
            ))}
          </div>
        ) : (
          <div className="tt-glass rounded-2xl p-10 text-center text-slate-500 dark:text-slate-400">
            Featured projects coming soon.
          </div>
        )}
      </section>

      {/* SERVICES PREVIEW */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <Reveal>
            <Pill className="mx-auto mb-4">Services</Pill>
            <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
              What we offer
            </h2>
          </Reveal>
        </div>
        <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {publishedServices.slice(0, 8).map(s => {
            const Icon = resolveIcon(s.icon);
            return (
              <StaggerItem key={s.id}>
                <ServiceCard service={s} slug={`/services/${s.slug}`} />
              </StaggerItem>
            );
          })}
        </StaggerGroup>
        <div className="mt-10 text-center">
          <GlowButton to="/services" variant="ghost">All Services <ArrowRight className="h-4 w-4" /></GlowButton>
        </div>
      </section>

      {/* AI LAB PREVIEW */}
      {aiService && aiService.isPublished && (
        <section className="relative mx-auto mt-28 max-w-7xl overflow-hidden px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="tt-glass tt-glow-border relative overflow-hidden rounded-[2rem] p-10 md:p-14">
              <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand-500/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="relative grid items-center gap-10 md:grid-cols-2">
                <div>
                  <Pill className="mb-5"><Bot className="h-3.5 w-3.5" /> AI Lab</Pill>
                  <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
                    Try AI. Live. Before you commit.
                  </h2>
                  <p className="mt-4 text-slate-600 dark:text-slate-300">
                    Experiment with live AI demonstrations: an AI project planner, business advisor,
                    and idea analyzer — powered by real LLM APIs. No smoke and mirrors.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <GlowButton to="/ai-lab">Open AI Lab <ArrowRight className="h-4 w-4" /></GlowButton>
                    <GlowButton to={`/services/${aiService.slug}`} variant="ghost">AI Service Details</GlowButton>
                  </div>
                </div>
                <div className="tt-glass relative rounded-2xl p-6 font-mono text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  <div><span className="text-brand-500">you:</span> I run a restaurant and want to automate customer questions.</div>
                  <div className="mt-3"><span className="text-cyan-500">assistant:</span></div>
                  <div className="mt-1 space-y-1 pl-4">
                    <div>• Deploy a menu-aware chatbot</div>
                    <div>• Connect to reservations & hours</div>
                    <div>• Hand off complex queries to staff</div>
                    <div>• Add WhatsApp / Instagram integration</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* HOW WE WORK */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <Reveal>
            <Pill className="mx-auto mb-4">How we work</Pill>
            <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">A clear process, every time.</h2>
          </Reveal>
        </div>
        <StaggerGroup className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
          {['Discover', 'Strategy', 'Design', 'Build', 'Integrate', 'Test', 'Launch', 'Support'].map((s, i) => (
            <StaggerItem key={s}>
              <div className="tt-glass rounded-2xl p-4 text-center">
                <div className="font-display text-2xl font-bold tt-gradient-text">0{i + 1}</div>
                <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">{s}</div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
        <div className="mt-8 text-center">
          <Link to="/process" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:gap-3 dark:text-brand-300">
            See our full process <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {featuredTestimonials.length > 0 && (
        <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <Reveal>
              <Pill className="mx-auto mb-4">Testimonials</Pill>
              <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">What clients say</h2>
            </Reveal>
          </div>
          <StaggerGroup className="grid gap-6 md:grid-cols-3">
            {featuredTestimonials.map(t => (
              <StaggerItem key={t.id}>
                <div className="tt-glass tt-glow-border h-full rounded-2xl p-7">
                  <MessageSquare className="h-6 w-6 text-brand-500" />
                  <p className="mt-4 text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">"{t.quote}"</p>
                  <div className="mt-5 flex items-center gap-3">
                    {t.photoUrl ? (
                      <img src={t.photoUrl} alt={t.clientName} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 font-bold text-brand-600">{t.clientName.charAt(0)}</div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{t.clientName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{t.role || ''}{t.company ? ` · ${t.company}` : ''}</div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>
      )}

      {/* INSIGHTS */}
      {latestInsights.length > 0 && (
        <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <Reveal>
              <Pill className="mb-4">Insights</Pill>
              <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">From the studio</h2>
            </Reveal>
            <Link to="/insights" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:gap-3 dark:text-brand-300">
              All articles <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <StaggerGroup className="grid gap-6 md:grid-cols-3">
            {latestInsights.map(ins => (
              <StaggerItem key={ins.id}>
                <Link to={`/insights/${ins.slug}`} className="tt-glass tt-glow-border group block h-full overflow-hidden rounded-2xl transition-all hover:-translate-y-1">
                  {ins.coverUrl && <img src={ins.coverUrl} alt={ins.title} className="h-44 w-full object-cover" />}
                  <div className="p-6">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">{ins.category}</span>
                    <h3 className="mt-2 font-display text-lg font-bold text-slate-900 dark:text-white group-hover:text-brand-500">{ins.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{ins.excerpt}</p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="mx-auto mt-28 max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="tt-glass tt-glow-border relative overflow-hidden rounded-[2rem] p-10 text-center md:p-16">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="relative z-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
                Have an idea? Let's build it.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-300">
                From first sketch to launch and ongoing support — we're the team that designs,
                builds, integrates AI and automates your digital products.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Magnetic strength={0.25}>
                  <GlowButton to="/start-project">Start a Project <ArrowRight className="h-4 w-4" /></GlowButton>
                </Magnetic>
                <GlowButton href={whatsappLink} variant="ghost"><MessageSquare className="h-4 w-4" /> Chat on WhatsApp</GlowButton>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Home;
