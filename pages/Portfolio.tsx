import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { ProjectCategory, PROJECT_CATEGORY_ORDER, CATEGORY_DISPLAY } from '../types';
import { ProjectCard } from '../components/UI';
import { Reveal } from '../components/motion';
import { GlowButton } from '../components/Premium';
import { PageHero } from '../components/Sections';
import { ArrowRight } from 'lucide-react';

type Filter = ProjectCategory | 'All';

/** Map legacy category strings onto canonical public categories. */
const canonicalCategory = (c: ProjectCategory): ProjectCategory => {
  if (c === 'Product Design') return 'Branding';
  if (c === 'Motion & Video') return 'Video';
  if (c === 'Web Design') return 'Websites';
  if (c === 'Frontend') return 'Web Apps';
  if (c === 'App Design' || c === 'App Development') return 'Mobile Apps';
  if (c === 'Graphic Design') return 'Graphics';
  if (c === 'Video Editing') return 'Video';
  if (c === 'AI Integration & Automation') return 'AI';
  return c;
};

const Portfolio: React.FC = () => {
  const { projects } = useData();
  const [filter, setFilter] = useState<Filter>('All');

  const categories: Filter[] = ['All', ...PROJECT_CATEGORY_ORDER];

  const publishedProjects = useMemo(() => projects.filter(p => p.isPublished), [projects]);
  const filteredProjects = useMemo(
    () => publishedProjects.filter(p => filter === 'All' ? true : canonicalCategory(p.category) === filter),
    [publishedProjects, filter]
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 pt-4 transition-colors duration-300 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHero
          eyebrow="Our Work"
          title="Selected projects."
          subtitle="Websites, applications, brands, motion and AI solutions we've shipped for our clients."
          primaryCta={{ to: '/start-project', label: 'Start a Project' }}
          secondaryCta={{ to: '/services', label: 'Our Services' }}
        />

        <Reveal delay={0.1}>
          <div className="mb-12 flex flex-wrap justify-center gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                  filter === cat
                    ? 'bg-brand-600 text-white shadow-md scale-105'
                    : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
                aria-pressed={filter === cat}
              >
                {cat === 'All' ? 'All' : CATEGORY_DISPLAY[cat as ProjectCategory]}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.05}>
                <ProjectCard project={p} />
              </Reveal>
            ))
          ) : (
            <div className="col-span-full py-20 text-center text-slate-500 dark:text-slate-400">
              <p className="mb-6">No projects in this category yet.</p>
              <GlowButton to="/start-project" variant="ghost">
                Start a Project <ArrowRight className="h-4 w-4" />
              </GlowButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Portfolio;

