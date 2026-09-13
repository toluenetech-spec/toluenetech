import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHero } from '../components/Sections';
import { Reveal, StaggerGroup, StaggerItem } from '../components/motion';
import { useData } from '../context/DataContext';
import { resolveIcon } from '../lib/icons';

const Solutions: React.FC = () => {
  const { solutions } = useData();
  const published = solutions.filter(s => s.isPublished).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Solutions"
        title="Things you can ask us to build."
        subtitle="Services describe what we do; solutions describe what you get. Pick the one that matches your goal — we'll tailor the scope to you."
        primaryCta={{ to: '/start-project', label: 'Start a Project' }}
      />
      <StaggerGroup className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {published.map(s => {
          const Icon = resolveIcon(s.icon);
          return (
            <StaggerItem key={s.id}>
              <div className="tt-glass tt-glow-border h-full rounded-2xl p-7 transition-all hover:-translate-y-1">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-400/5 ring-1 ring-brand-400/20">
                  <Icon className="h-6 w-6 text-brand-500" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
                <p className="mt-1 text-xs font-medium text-brand-500">{s.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.description}</p>
                <ul className="mt-4 space-y-1.5">
                  {s.features.slice(0, 4).map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="h-1 w-1 rounded-full bg-brand-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/start-project" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:gap-3 dark:text-brand-300">
                  Request this solution <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </div>
  );
};

export default Solutions;
