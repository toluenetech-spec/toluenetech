import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { ProjectCard } from '../components/UI';
import { GlowButton } from '../components/Premium';
import { Breadcrumb } from '../components/Sections';
import { resolveIcon } from '../lib/icons';
import NotFound from './NotFound';

const ServiceDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { services, projects } = useData();
  const service = services.find(s => s.slug === slug && s.isPublished);

  useEffect(() => {
    if (service) document.title = `${service.title} — Toluene Tech`;
    return () => { document.title = 'Toluene Tech | Digital Products, Design, Development & AI'; };
  }, [service]);

  const relatedProjects = useMemo(() => {
    if (!service) return [];
    return projects
      .filter(p => p.isPublished)
      .filter(p => {
        if (service.slug === 'ai-integration') return p.category === 'AI' || p.category === 'AI Integration & Automation';
        if (service.slug === 'web-design') return p.category === 'Websites' || p.category === 'Web Design';
        if (service.slug === 'frontend-development') return p.category === 'Web Apps' || p.category === 'Frontend';
        if (service.slug === 'ui-ux-design') return p.category === 'UI/UX';
        if (service.slug === 'app-design' || service.slug === 'app-development') return p.category === 'Mobile Apps' || p.category === 'App Design' || p.category === 'App Development';
        if (service.slug === 'graphic-design') return p.category === 'Graphics' || p.category === 'Branding' || p.category === 'Product Design';
        if (service.slug === 'video-editing') return p.category === 'Video' || p.category === 'Motion & Video';
        return false;
      })
      .slice(0, 3);
  }, [service, projects]);

  if (!service) return <NotFound />;

  const Icon = resolveIcon(service.icon);
  const capabilities = service.capabilities || service.includes || [];
  const deepLink = `/start-project?service=${encodeURIComponent(service.title)}`;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="pt-4">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Services', to: '/services' }, { label: service.title }]} />
      </div>

      {/* Hero */}
      <div className="grid items-center gap-10 py-12 md:grid-cols-2">
        <div>
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-glow">
            <Icon className="h-8 w-8" />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">{service.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            {service.longDescription || service.description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <GlowButton to={deepLink}>Start a Project <ArrowRight className="h-4 w-4" /></GlowButton>
            <GlowButton to="/portfolio" variant="ghost">See related work</GlowButton>
          </div>
        </div>
        <div className="tt-glass tt-glow-border rounded-3xl p-8">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">What's included</h3>
          <ul className="mt-4 space-y-3">
            {capabilities.map(c => (
              <li key={c} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Process */}
      {service.process && service.process.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Our process</h2>
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
            {service.process.map((step, i) => (
              <div key={step} className="tt-glass rounded-xl p-4">
                <div className="text-xs font-bold tt-gradient-text">0{i + 1}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{step}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tech */}
      {service.tech && service.tech.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Technologies we use</h2>
          <div className="flex flex-wrap gap-2">
            {service.tech.map(t => (
              <span key={t} className="tt-glass rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">{t}</span>
            ))}
          </div>
        </section>
      )}

      {/* Use cases */}
      {service.useCases && service.useCases.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Common use cases</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {service.useCases.map(uc => (
              <div key={uc} className="tt-glass rounded-xl p-5 text-sm text-slate-600 dark:text-slate-300">{uc}</div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {service.faqs && service.faqs.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Frequently asked</h2>
          <div className="space-y-3">
            {service.faqs.map((f, i) => (
              <details key={i} className="tt-glass tt-glow-border rounded-2xl p-5">
                <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">{f.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Related projects */}
      {relatedProjects.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-slate-900 dark:text-white">Related projects</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {relatedProjects.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mt-20">
        <div className="tt-glass tt-glow-border rounded-[2rem] p-10 text-center md:p-14">
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">
            Ready to talk {service.title.toLowerCase()}?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
            Tell us a little about your project — we'll reply within 2 hours on business days.
          </p>
          <div className="mt-6 flex justify-center">
            <GlowButton to={deepLink}>Start a Project <ArrowRight className="h-4 w-4" /></GlowButton>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <Link to="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:gap-3 dark:text-brand-300">
          <ArrowLeft className="h-4 w-4" /> Back to all services
        </Link>
      </div>
    </div>
  );
};

export default ServiceDetail;
