import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Sparkles, Code2, PenTool, Zap, Bot, Workflow, CheckCircle2 } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { SectionHeading, ProjectCard } from '../components/UI';
import { SERVICES, TOOLS_LIST } from '../constants';
import { Reveal, StaggerGroup, StaggerItem, AnimatedHeadline, Magnetic, Counter, motion } from '../components/motion';
import { Aurora, FloatingShapes, GlowButton, Pill } from '../components/Premium';

const roles = ['AI Engineer', 'Full Stack Developer', 'Workflow Automation', 'UI/UX Designer', 'Frontend Engineer'];

const stats = [
  { value: 50, suffix: '+', label: 'Projects Delivered' },
  { value: 98, suffix: '%', label: 'Client Retention' },
  { value: 3, suffix: 'x', label: 'Average ROI' },
  { value: 24, suffix: '/7', label: 'Critical Support' },
];

const highlights = [
  { icon: Bot, title: 'AI Engineering', desc: 'Intelligent features, LLM integrations, and automations that give your product a real edge.' },
  { icon: Code2, title: 'Full-Stack Development', desc: 'Scalable, fast, accessible applications built on modern React architecture.' },
  { icon: PenTool, title: 'UI/UX Design', desc: 'Research-backed design systems that improve retention and delight users.' },
  { icon: Workflow, title: 'Workflow Automation', desc: 'Streamline operations and remove busywork with tailored automation pipelines.' },
];

const Home: React.FC = () => {
  const { projects, socialLinks } = useProjects();
  const featuredProjects = projects.filter(p => p.isFeatured && p.isPublished).slice(0, 3);

  const whatsappMsg = encodeURIComponent("Hello Toluene Tech, I'm ready to elevate my digital presence. Let's chat.");
  const whatsappLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappMsg}`;

  return (
    <div className="overflow-x-hidden">

      {/* ---------------- HERO ---------------- */}
      <section className="tt-noise relative overflow-hidden pb-28 pt-16 md:pt-24">
        <Aurora variant="hero" />
        <div className="tt-grid-bg absolute inset-0" />
        <FloatingShapes />

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Pill className="mb-8">
              <Sparkles className="h-3.5 w-3.5" /> Designing Intelligent Digital Experiences
            </Pill>
          </motion.div>

          <AnimatedHeadline
            as="h1"
            text="Premium digital products, engineered end to end"
            highlight="engineered"
            className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-6xl md:text-7xl"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300"
          >
            Toluene Tech blends AI engineering, full-stack development, and award-level design to build
            experiences that feel effortless and perform flawlessly.
          </motion.p>

          {/* Rotating roles */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            {roles.map((role, i) => (
              <span key={role} className="tt-glass rounded-full px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300" style={{ animationDelay: `${i * 0.2}s` }}>
                {role}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Magnetic>
              <GlowButton to="/portfolio">
                View Our Work <ArrowRight className="h-4 w-4" />
              </GlowButton>
            </Magnetic>
            <Magnetic>
              <GlowButton to="/downloads" variant="ghost">
                <Download className="h-4 w-4" /> Brand CV
              </GlowButton>
            </Magnetic>
          </motion.div>
        </div>

        {/* Floating dashboard/code preview mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto mt-20 max-w-4xl px-4 sm:px-6"
        >
          <div className="tt-glass tt-glow-border overflow-hidden rounded-2xl shadow-card">
            <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-400/80" />
              <span className="ml-3 font-mono text-xs text-slate-500">toluene-tech / intelligent-experience.tsx</span>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <pre className="overflow-hidden p-6 font-mono text-xs leading-relaxed text-slate-600 dark:text-slate-300">
{`const experience = build({
  ai: 'gpt-grade automations',
  stack: ['React', 'TypeScript'],
  design: 'award-level',
});

// ship with confidence →
export default experience;`}
              </pre>
              <div className="flex flex-col justify-center gap-3 border-t border-white/5 p-6 md:border-l md:border-t-0">
                {['Performance budget met', 'Accessibility AA passed', 'Core Web Vitals: green'].map(item => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-brand-500" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------------- STATS ---------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <StaggerGroup className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map(stat => (
            <StaggerItem key={stat.label}>
              <div className="tt-glass rounded-2xl p-6 text-center">
                <Counter
                  to={stat.value}
                  suffix={stat.suffix}
                  className="font-display text-4xl font-bold tt-gradient-text md:text-5xl"
                />
                <span className="mt-2 block text-sm text-slate-500 dark:text-slate-400">{stat.label}</span>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ---------------- CAPABILITIES ---------------- */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading title="What we do best" subtitle="Capabilities" />
        <StaggerGroup className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {highlights.map(h => {
            const Icon = h.icon;
            return (
              <StaggerItem key={h.title}>
                <div className="tt-glass tt-glow-border group h-full rounded-3xl p-7 transition-all duration-500 hover:-translate-y-1.5">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-transparent ring-1 ring-brand-400/20 transition-all group-hover:from-brand-500 group-hover:shadow-glow">
                    <Icon className="h-6 w-6 text-brand-500 transition-colors group-hover:text-white" />
                  </div>
                  <h3 className="mb-2 font-display text-lg font-bold text-slate-900 dark:text-white">{h.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{h.desc}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </section>

      {/* ---------------- TECH MARQUEE ---------------- */}
      <section className="mt-28">
        <Reveal className="mb-10 text-center">
          <Pill>Our Tech Stack</Pill>
        </Reveal>
        <div className="tt-marquee relative overflow-hidden py-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-white to-transparent dark:from-ink-950" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-white to-transparent dark:from-ink-950" />
          <div className="tt-marquee-track gap-6">
            {[...TOOLS_LIST, ...TOOLS_LIST].map((tool, idx) => (
              <div key={idx} className="tt-glass flex shrink-0 items-center gap-3 rounded-2xl px-6 py-4">
                <img src={tool.logoUrl} alt={tool.name} loading="lazy" className="h-8 w-8 object-contain" />
                <span className="whitespace-nowrap text-sm font-medium text-slate-600 dark:text-slate-300">{tool.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FEATURED PROJECTS ---------------- */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Featured case studies" subtitle="Recent Work" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {featuredProjects.map((project, idx) => (
            <Reveal key={project.id} delay={idx * 0.1}>
              <ProjectCard project={project} />
            </Reveal>
          ))}
        </div>
        <div className="mt-14 text-center">
          <GlowButton to="/portfolio" variant="ghost">
            View Full Portfolio <ArrowRight className="h-4 w-4" />
          </GlowButton>
        </div>
      </section>

      {/* ---------------- WHY US ---------------- */}
      <section className="relative mt-28 overflow-hidden py-24">
        <Aurora />
        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <Reveal direction="right">
            <Pill className="mb-5">Why Toluene Tech</Pill>
            <h2 className="font-display text-4xl font-bold leading-tight text-slate-900 dark:text-white md:text-5xl">
              Engineered for measurable growth
            </h2>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
              We don't just make things look good. We build robust, scalable digital assets designed to
              solve real business problems and drive results you can measure.
            </p>
            <div className="mt-8 space-y-3">
              {['Business-focused design solutions', 'Scalable, AI-ready architecture', 'User-centered workflows', 'Transparent communication'].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <StaggerGroup className="grid grid-cols-2 gap-5">
            {stats.map(stat => (
              <StaggerItem key={stat.label}>
                <div className="tt-glass tt-glow-border rounded-3xl p-8 text-center">
                  <Counter to={stat.value} suffix={stat.suffix} className="block font-display text-4xl font-bold text-slate-900 dark:text-white" />
                  <span className="mt-2 block text-sm text-slate-500 dark:text-slate-400">{stat.label}</span>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="tt-glass tt-glow-border relative overflow-hidden rounded-[2rem] p-12 text-center md:p-16">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="relative z-10">
              <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
                Ready to build something exceptional?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-300">
                Let's discuss your project goals. We reply within 2 hours during business days.
              </p>
              <div className="mt-9 flex flex-col justify-center gap-4 sm:flex-row">
                <Magnetic>
                  <GlowButton to="/contact">Start a Project <ArrowRight className="h-4 w-4" /></GlowButton>
                </Magnetic>
                <GlowButton href={whatsappLink} variant="ghost">Chat on WhatsApp</GlowButton>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Home;
