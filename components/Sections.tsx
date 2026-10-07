import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Reveal } from './motion';
import { GlowButton, Pill } from './Premium';
import { useData } from '../context/DataContext';

export const PageHero: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  primaryCta?: { to: string; label: string };
  secondaryCta?: { to: string; label: string };
  align?: 'center' | 'left';
}> = ({ eyebrow, title, subtitle, primaryCta, secondaryCta, align = 'center' }) => (
  <Reveal>
    <div className={`mx-auto max-w-4xl ${align === 'center' ? 'text-center' : 'text-left'} pt-4 pb-10 md:pt-8 md:pb-16`}>
      {eyebrow && (
        <div className={`mb-6 ${align === 'center' ? 'flex justify-center' : ''}`}>
          <Pill>{eyebrow}</Pill>
        </div>
      )}
      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-6xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-300 md:text-xl">
          {subtitle}
        </p>
      )}
      {(primaryCta || secondaryCta) && (
        <div className={`mt-10 flex flex-col items-center gap-3 sm:flex-row ${align === 'center' ? 'sm:justify-center' : ''}`}>
          {primaryCta && (
            <GlowButton to={primaryCta.to}>
              {primaryCta.label} <ArrowRight className="h-4 w-4" />
            </GlowButton>
          )}
          {secondaryCta && (
            <GlowButton to={secondaryCta.to} variant="ghost">
              {secondaryCta.label}
            </GlowButton>
          )}
        </div>
      )}
    </div>
  </Reveal>
);

export const AvailabilityBadge: React.FC = () => {
  const { siteSettings } = useData();
  const tone: Record<string, string> = {
    available: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    limited: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    unavailable: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const label: Record<string, string> = {
    available: 'Available for new projects',
    limited: 'Limited availability',
    unavailable: 'Currently unavailable',
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${tone[siteSettings.availability]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        siteSettings.availability === 'available' ? 'bg-green-500 animate-pulse' :
        siteSettings.availability === 'limited' ? 'bg-amber-500' : 'bg-red-500'
      }`} />
      {siteSettings.availabilityMessage || label[siteSettings.availability]}
    </span>
  );
};

export const Checklist: React.FC<{ items: string[]; className?: string }> = ({ items, className = '' }) => (
  <ul className={`space-y-2.5 ${className}`}>
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        {item}
      </li>
    ))}
  </ul>
);

export const CTASection: React.FC<{
  title?: string;
  subtitle?: string;
}> = ({ title = 'Ready to build something?', subtitle = 'Tell us about your project — we reply within 2 hours on business days.' }) => (
  <Reveal>
    <div className="tt-glass tt-glow-border relative overflow-hidden rounded-[2rem] p-10 text-center md:p-16">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="relative z-10">
        <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600 dark:text-slate-300">{subtitle}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <GlowButton to="/start-project">Start a Project <ArrowRight className="h-4 w-4" /></GlowButton>
          <GlowButton to="/portfolio" variant="ghost">Explore Our Work</GlowButton>
        </div>
      </div>
    </div>
  </Reveal>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }> = ({
  icon, title, description, action,
}) => (
  <div className="tt-glass flex flex-col items-center rounded-2xl p-10 text-center">
    {icon && <div className="mb-4 text-brand-500">{icon}</div>}
    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
    {description && <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const Breadcrumb: React.FC<{ items: { label: string; to?: string }[] }> = ({ items }) => (
  <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {item.to ? (
          <Link to={item.to} className="transition-colors hover:text-brand-500">{item.label}</Link>
        ) : (
          <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
        )}
        {i < items.length - 1 && <span aria-hidden="true">/</span>}
      </React.Fragment>
    ))}
  </nav>
);
