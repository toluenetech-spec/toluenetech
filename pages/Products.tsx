import React from 'react';
import { ExternalLink } from 'lucide-react';
import { PageHero, EmptyState } from '../components/Sections';
import { Reveal, StaggerGroup, StaggerItem } from '../components/motion';
import { GlowButton } from '../components/Premium';
import { useData } from '../context/DataContext';

const STATUS_STYLES: Record<string, string> = {
  idea: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  prototype: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'in-development': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  beta: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  live: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const Products: React.FC = () => {
  const { products } = useData();
  const published = products.filter(p => p.isPublished).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Products"
        title="Products we build for ourselves."
        subtitle="Beyond client work, we ship our own tools and experiments. Products in progress, in beta, and live."
      />
      {published.length === 0 ? (
        <EmptyState
          title="Products coming soon"
          description="We're working on our first in-house products. Check back soon or join our early-access list."
          action={<GlowButton to="/contact">Get notified</GlowButton>}
        />
      ) : (
        <StaggerGroup className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {published.map(p => (
            <StaggerItem key={p.id}>
              <div className="tt-glass tt-glow-border h-full overflow-hidden rounded-2xl">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-gradient-to-br from-brand-500/20 to-brand-400/5">
                    <span className="font-display text-3xl font-bold tt-gradient-text">{p.name.charAt(0)}</span>
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{p.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-brand-500">{p.tagline}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{p.description}</p>
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {(p.tech || []).slice(0, 4).map(t => (
                      <li key={t} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300">{t}</li>
                    ))}
                  </ul>
                  {p.websiteUrl && (
                    <a href={p.websiteUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:gap-3 dark:text-brand-300">
                      Visit <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
};

export default Products;
