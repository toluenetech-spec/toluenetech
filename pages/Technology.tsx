import React from 'react';
import { PageHero } from '../components/Sections';
import { Reveal, StaggerGroup, StaggerItem } from '../components/motion';
import { CTASection } from '../components/Sections';
import { useData } from '../context/DataContext';

const CATEGORY_LABELS: Record<string, string> = {
  Frontend: 'Frontend', Backend: 'Backend', Mobile: 'Mobile', Database: 'Database',
  AI: 'AI & ML', Cloud: 'Cloud & DevOps', Design: 'Design', Motion: 'Motion & Video', Automation: 'Automation',
};

const Technology: React.FC = () => {
  const { tools } = useData();
  const categories = Array.from(new Set(tools.map(t => t.category))) as string[];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Technology"
        title="A modern, opinionated stack."
        subtitle="We pick tools that are proven, fast, and easy to maintain — then pair them with the right design and AI integrations for your product."
      />

      <div className="space-y-12">
        {categories.map(cat => {
          const items = tools.filter(t => t.category === cat);
          return (
            <Reveal key={cat}>
              <div>
                <h2 className="mb-5 font-display text-xl font-bold text-slate-900 dark:text-white">
                  {CATEGORY_LABELS[cat] || cat}
                </h2>
                <StaggerGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {items.map(tool => (
                    <StaggerItem key={tool.name}>
                      <div className="tt-glass flex h-24 flex-col items-center justify-center gap-2 rounded-xl p-3 text-center transition-all hover:-translate-y-1">
                        <img src={tool.logoUrl} alt={tool.name} loading="lazy" className="h-8 w-8 object-contain" />
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{tool.name}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              </div>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-20"><CTASection title="Need a specific stack?" subtitle="We work with your existing tools or recommend the right ones for your project." /></div>
    </div>
  );
};

export default Technology;
