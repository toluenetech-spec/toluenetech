import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHero, EmptyState } from '../components/Sections';
import { Reveal, StaggerGroup, StaggerItem } from '../components/motion';
import { GlowButton } from '../components/Premium';
import { useData } from '../context/DataContext';

const STATUS_STYLES: Record<string, string> = {
  experiment: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  prototype: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  beta: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const Labs: React.FC = () => {
  const { labs } = useData();
  const published = labs.filter(l => l.isPublished);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Toluene Tech Labs"
        title="Experiments, prototypes & side projects."
        subtitle="Where we test new ideas in AI, web, mobile and automation. Some grow into products, some are here for the fun of it."
        primaryCta={{ to: '/ai-lab', label: 'Open AI Lab' }}
      />
      {published.length === 0 ? (
        <EmptyState
          title="Labs coming online"
          description="Our first round of experiments is in the works. Visit the AI Lab to try live AI demos now."
          action={<GlowButton to="/ai-lab">Open AI Lab</GlowButton>}
        />
      ) : (
        <StaggerGroup className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {published.map(l => (
            <StaggerItem key={l.id}>
              <div className="tt-glass tt-glow-border h-full overflow-hidden rounded-2xl">
                {l.imageUrl && <img src={l.imageUrl} alt={l.title} className="h-40 w-full object-cover" />}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500">{l.category}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">{l.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{l.description}</p>
                  {(l.tech || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {l.tech.slice(0, 4).map(t => (
                        <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">{t}</span>
                      ))}
                    </div>
                  )}
                  {l.demoUrl && (
                    <a href={l.demoUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 dark:text-brand-300">
                      Try demo <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}

      <div className="mt-16 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Want to see more?
          <Link to="/ai-lab" className="ml-2 font-semibold text-brand-500 hover:underline">Visit AI Lab →</Link>
        </p>
      </div>
    </div>
  );
};

export default Labs;
