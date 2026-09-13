import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Project, Service, CATEGORY_DISPLAY } from '../types';
import { Reveal, TiltCard } from './motion';
import { Pill } from './Premium';

// Section Heading
export const SectionHeading: React.FC<{ title: string; subtitle?: string; align?: 'left' | 'center' }> = ({ title, subtitle, align = 'center' }) => (
  <Reveal className={`mb-14 ${align === 'center' ? 'text-center' : 'text-left'}`}>
    {subtitle && (
      <div className={`mb-4 ${align === 'center' ? 'flex justify-center' : ''}`}>
        <Pill>{subtitle}</Pill>
      </div>
    )}
    <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
      {title}
    </h2>
    <div className={`mt-5 h-px w-24 bg-gradient-to-r from-brand-500 to-transparent ${align === 'center' ? 'mx-auto' : ''}`} />
  </Reveal>
);

// Project Card
export const ProjectCard: React.FC<{ project: Project }> = ({ project }) => (
  <TiltCard className="h-full">
    <div className="tt-glass tt-glow-border group relative flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-500 hover:shadow-card">
      <div className="relative h-60 overflow-hidden">
        {project.videoUrl ? (
          <video
            src={project.videoUrl}
            poster={project.imageUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
          />
        ) : (
          <img
            src={project.imageUrl}
            alt={project.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent opacity-80" />
        <div className="absolute left-5 top-5">
          <span className="rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-200 backdrop-blur-md">
            {CATEGORY_DISPLAY[project.category] || project.category}
          </span>
        </div>
        <Link
          to={`/project/${project.id}`}
          className="absolute bottom-5 right-5 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-white/90 text-ink-900 opacity-0 shadow-glow transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-brand-500 hover:text-white"
          aria-label={`View ${project.title} case study`}
        >
          <ArrowUpRight className="h-5 w-5" />
        </Link>
      </div>
      <div className="flex flex-grow flex-col p-6">
        <h3 className="mb-2 font-display text-xl font-bold text-slate-900 transition-colors group-hover:text-brand-500 dark:text-white">
          {project.title}
        </h3>
        <p className="mb-5 line-clamp-2 flex-grow text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {project.shortDescription}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          {project.tools.slice(0, 3).map(tool => (
            <span key={tool} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  </TiltCard>
);

// Service Card
export const ServiceCard: React.FC<{ service: Service }> = ({ service }) => {
  const Icon = service.icon;
  return (
    <TiltCard className="h-full" max={6}>
      <div className="tt-glass tt-glow-border group relative flex h-full flex-col overflow-hidden rounded-3xl p-8 transition-all duration-500 hover:shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl transition-opacity duration-500 group-hover:bg-brand-500/25" />
        <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-400/5 ring-1 ring-brand-400/20 transition-all duration-500 group-hover:from-brand-500 group-hover:to-brand-400 group-hover:shadow-glow">
          <Icon className="h-7 w-7 text-brand-500 transition-colors duration-500 group-hover:text-white" />
        </div>
        <h3 className="mb-3 font-display text-xl font-bold text-slate-900 dark:text-white">{service.title}</h3>
        <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{service.description}</p>
        <ul className="mb-6 space-y-2.5">
          {service.includes.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-500 dark:text-slate-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              {item}
            </li>
          ))}
        </ul>
        <Link
          to="/contact"
          className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-brand-600 transition-all hover:gap-3 dark:text-brand-300"
        >
          Request Quote <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </TiltCard>
  );
};
