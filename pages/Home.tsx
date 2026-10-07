import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, PenTool, Code2, BrainCircuit, Bot } from 'lucide-react';
import { useData } from '../context/DataContext';
import { ProjectCard, ServiceCard } from '../components/UI';
import { Reveal, StaggerGroup, StaggerItem } from '../components/motion';
import { GlowButton, Pill } from '../components/Premium';
import { AvailabilityBadge } from '../components/Sections';

const CAPABILITIES = [
  { icon: PenTool, title: 'Design',    desc: 'Clear, brand-aligned interfaces for marketing sites, products and apps.', items: ['UI/UX', 'Brand identity', 'Marketing sites', 'App design'] },
  { icon: Code2,   title: 'Engineering', desc: 'Reliable web and mobile products built with React, TypeScript and Firebase.', items: ['Websites', 'Web applications', 'Mobile apps', 'CMS & admin'] },
  { icon: BrainCircuit, title: 'AI & Automation', desc: 'Practical integrations with OpenAI, Gemini and internal data — no gimmicks.', items: ['Chatbots & assistants', 'RAG knowledge bases', 'Workflow automation', 'Lead & support agents'] },
];

const Home: React.FC = () => {
  const { projects, services, siteSettings, socialLinks } = useData();
  const featured = projects.filter(p => p.isFeatured && p.isPublished).slice(0, 6);
  const publishedServices = services.filter(s => s.isPublished);
  const aiService = services.find(s => s.slug === 'ai-integration');

  const whatsappMsg = encodeURIComponent("Hi Toluene Tech — I'd like to talk about a project.");
  const whatsappLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappMsg}`;

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="tt-grid-bg" />
        <div className="relative z-10 mx-auto max-w-5xl px-6 pb-20 pt-20 md:pb-28 md:pt-28">
          <Reveal>
            <div className="mb-8 flex">
              <AvailabilityBadge />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl">
              A small studio that designs, builds and ships digital products.
            </h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Toluene Tech is an independent technology studio based in Lagos, working remotely with clients worldwide. We design and build websites, web & mobile apps, brand systems, and practical AI integrations end-to-end.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <GlowButton to="/start-project">Start a project <ArrowRight className="h-4 w-4" /></GlowButton>
              <GlowButton to="/portfolio" variant="ghost">See selected work</GlowButton>
              <span className="hidden text-sm text-slate-500 sm:inline">·</span>
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Or chat on WhatsApp →
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="mt-14 border-t border-slate-200 pt-8 dark:border-slate-800">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Working with</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
                <span>Early-stage startups</span>
                <span>Service businesses</span>
                <span>Founders & operators</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Client logos are not listed publicly without explicit permission — case studies are added with sign-off.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* WHAT WE DO */}
      <section className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid gap-10 md:grid-cols-[260px_1fr] md:gap-16">
            <Reveal>
              <div>
                <Pill>What we do</Pill>
                <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
                  Three disciplines, one delivery team.
                </h2>
                <p className="mt-4 text-slate-600 dark:text-slate-400">
                  We stay small on purpose — design, engineering and AI work are delivered by the same person who scoped the project. Fewer handoffs, more ownership.
                </p>
                <div className="mt-6">
                  <GlowButton to="/services" variant="ghost">All services <ArrowRight className="h-4 w-4" /></GlowButton>
                </div>
              </div>
            </Reveal>
            <StaggerGroup className="grid gap-4 sm:grid-cols-2">
              {CAPABILITIES.map(c => {
                const Icon = c.icon;
                return (
                  <StaggerItem key={c.title}>
                    <div className="h-full rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{c.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.desc}</p>
                      <ul className="mt-4 space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
                        {c.items.map(i => <li key={i}>— {i}</li>)}
                      </ul>
                    </div>
                  </StaggerItem>
                );
              })}
              <StaggerItem>
                <Link to="/ai-lab" className="group flex h-full flex-col justify-between rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <div>
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <Bot className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">Try the AI Lab</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      Working demos of the assistant patterns, classifiers and automations we build — wired to real models, not fake animations.
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 group-hover:gap-2.5 dark:text-blue-300">
                    Open AI Lab <ArrowUpRight className="h-4 w-4" />
                  </span>
                </Link>
              </StaggerItem>
            </StaggerGroup>
          </div>
        </div>
      </section>

      {/* SELECTED WORK */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-12 flex items-end justify-between gap-6">
          <Reveal>
            <Pill>Selected work</Pill>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">Recent projects</h2>
            <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-400">
              A small selection of public work. More case studies are available on request; many client projects are under NDA.
            </p>
          </Reveal>
          <Link to="/portfolio" className="hidden text-sm font-semibold text-slate-900 hover:underline dark:text-white md:inline-flex md:items-center md:gap-2">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}><ProjectCard project={p} /></Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            Public case studies are being added. See <Link to="/portfolio" className="underline">the portfolio</Link> for the latest work.
          </div>
        )}
      </section>

      {/* SERVICES */}
      <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="mb-12 max-w-2xl">
            <Reveal>
              <Pill>Services</Pill>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">What we help you ship</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                Each engagement is scoped around a clear outcome. Pricing is custom-quoted after a short discovery call.
              </p>
            </Reveal>
          </div>
          {publishedServices.length > 0 && (
            <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {publishedServices.map(s => (
                <StaggerItem key={s.id}>
                  <ServiceCard service={s} slug={`/services/${s.slug}`} compact />
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
        </div>
      </section>

      {/* AI SERVICE CALLOUT */}
      {aiService && aiService.isPublished && (
        <section className="mx-auto max-w-6xl px-6 py-20 md:py-24">
          <Reveal>
            <div className="grid items-center gap-10 rounded-xl border border-slate-200 bg-white p-8 md:grid-cols-2 md:p-12 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <Pill accent><Bot className="h-3.5 w-3.5" /> AI Integration & Automation</Pill>
                <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
                  Add AI where it moves a metric.
                </h2>
                <p className="mt-4 text-slate-600 dark:text-slate-400">
                  We wire up support assistants, knowledge bases, internal automations and lead-qualification flows using OpenAI, Gemini and your own data — with guardrails, rate limits and keys kept server-side.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <li>— Customer support & FAQ assistants</li>
                  <li>— RAG over your docs, products or CRM</li>
                  <li>— Workflow automation & internal tools</li>
                  <li>— Human-in-the-loop escalation</li>
                </ul>
                <div className="mt-7 flex flex-wrap gap-3">
                  <GlowButton to="/ai-lab">Try live demos <ArrowRight className="h-4 w-4" /></GlowButton>
                  <GlowButton to={`/services/${aiService.slug}`} variant="ghost">Service details</GlowButton>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 font-mono text-[13px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <div className="mb-3 font-sans text-xs font-semibold uppercase tracking-wider text-slate-400">Example: restaurant client</div>
                <div><span className="text-blue-600">you:</span> We need to answer menu questions and booking hours automatically.</div>
                <div className="mt-3"><span className="text-slate-900 dark:text-white">tt:</span> We'll deploy a menu-aware assistant trained on your FAQ, connected to your reservation link, with complex queries routed to your team. WhatsApp & Instagram embeds available.</div>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* PROCESS */}
      <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid gap-10 md:grid-cols-[260px_1fr] md:gap-16">
            <Reveal>
              <div>
                <Pill>How we work</Pill>
                <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">A simple, honest process.</h2>
                <p className="mt-4 text-slate-600 dark:text-slate-400">No 12-step frameworks. A short discovery, a written proposal, then weekly builds you can see.</p>
                <div className="mt-6"><GlowButton to="/process" variant="ghost">Full process <ArrowRight className="h-4 w-4" /></GlowButton></div>
              </div>
            </Reveal>
            <ol className="divide-y divide-slate-200 dark:divide-slate-800">
              {[
                { n: '01', t: 'Discovery', d: 'A 30–45 minute call to understand goals, users and constraints. We follow up with a written proposal, timeline and fixed or milestone-based price.' },
                { n: '02', t: 'Design', d: 'We produce sitemaps, wireframes and visual designs for review. Two structured feedback rounds are included.' },
                { n: '03', t: 'Build', d: 'Weekly builds in a shared staging environment, with short written updates. You see progress early rather than at the end.' },
                { n: '04', t: 'Launch', d: 'QA across devices, DNS and deploy hand-off, analytics setup, and a handover call with documentation.' },
                { n: '05', t: 'Support', d: '30 days of bug-fix support included. Ongoing maintenance retainers are available for products you want us to keep improving.' },
              ].map((step, i) => (
                <Reveal key={step.n} delay={i * 0.05}>
                  <li className="grid grid-cols-[60px_1fr] gap-4 py-6">
                    <div className="font-mono text-sm text-slate-400">{step.n}</div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{step.t}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{step.d}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-4xl px-6 py-20 md:py-28">
        <Reveal>
          <div className="border-t border-slate-200 pt-12 dark:border-slate-800">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">Tell us about the project.</h2>
            <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
              Share a few lines about what you're building. We reply personally within one business day with either a next step or a referral to someone better suited.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <GlowButton to="/start-project">Start a project <ArrowRight className="h-4 w-4" /></GlowButton>
              <GlowButton href={`mailto:${socialLinks.email}`} variant="ghost">Send an email</GlowButton>
              <GlowButton href={whatsappLink} variant="ghost">Chat on WhatsApp</GlowButton>
            </div>
            <p className="mt-6 text-xs text-slate-500">Prefer email? {socialLinks.email} — Lagos, Nigeria (WAT).</p>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Home;
