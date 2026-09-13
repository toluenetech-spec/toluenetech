import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageHero, EmptyState } from '../components/Sections';
import { StaggerGroup, StaggerItem, Reveal } from '../components/motion';
import { GlowButton } from '../components/Premium';
import { useData } from '../context/DataContext';

const Insights: React.FC = () => {
  const { insights } = useData();
  const published = insights.filter(i => i.isPublished).sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Insights"
        title="Notes from the studio."
        subtitle="Articles on AI, product development, design and business automation."
      />
      {published.length === 0 ? (
        <EmptyState
          title="Insights coming soon"
          description="We're writing our first articles on AI, web development and digital product building."
          action={<GlowButton to="/contact">Subscribe for updates</GlowButton>}
        />
      ) : (
        <StaggerGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {published.map(ins => (
            <StaggerItem key={ins.id}>
              <Link to={`/insights/${ins.slug}`} className="tt-glass tt-glow-border group block h-full overflow-hidden rounded-2xl transition-all hover:-translate-y-1">
                {ins.coverUrl && <img src={ins.coverUrl} alt={ins.title} className="h-44 w-full object-cover" />}
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-500">
                    <span>{ins.category}</span>
                    {ins.publishDate && <span className="text-slate-400">· {new Date(ins.publishDate).toLocaleDateString()}</span>}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-bold text-slate-900 group-hover:text-brand-500 dark:text-white">{ins.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">{ins.excerpt}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-500">Read more <ArrowRight className="h-3 w-3" /></span>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  );
};

export default Insights;
