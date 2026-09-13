import React, { useMemo, useState } from 'react';
import { useProjects } from '../context/ProjectContext';
import { ProjectCategory, CATEGORY_ORDER, CATEGORY_DISPLAY } from '../types';
import { ProjectCard, SectionHeading } from '../components/UI';
import { Reveal } from '../components/motion';
import { GlowButton } from '../components/Premium';
import { ArrowRight } from 'lucide-react';

type Filter = ProjectCategory | 'All';

/**
 * Normalise legacy category values so they roll up into the current
 * canonical categories for filtering purposes (e.g. "Motion & Video" → "Video Editing").
 */
const canonicalCategory = (c: ProjectCategory): ProjectCategory => {
  if (c === 'Product Design') return 'Graphic Design';
  if (c === 'Motion & Video') return 'Video Editing';
  return c;
};

const Portfolio: React.FC = () => {
  const { projects } = useProjects();
  const [filter, setFilter] = useState<Filter>('All');

  // Public categories always use canonical labels, in the official order.
  const categories: Filter[] = ['All', ...CATEGORY_ORDER];

  const publishedProjects = useMemo(
    () => projects.filter(p => p.isPublished),
    [projects]
  );

  const filteredProjects = useMemo(
    () =>
      publishedProjects.filter(p =>
        filter === 'All' ? true : canonicalCategory(p.category) === filter
      ),
    [publishedProjects, filter]
  );

  return (
    <div className="pt-12 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">Our Work</h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              A selection of websites, apps, design systems, and AI-powered solutions
              we've shipped for our clients.
            </p>
          </div>
        </Reveal>

        {/* Filters */}
        <Reveal delay={0.1}>
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === cat
                    ? 'bg-brand-600 text-white shadow-md transform scale-105'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
                aria-pressed={filter === cat}
              >
                {cat === 'All' ? 'All Projects' : CATEGORY_DISPLAY[cat as ProjectCategory]}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project, idx) => (
              <Reveal key={project.id} delay={idx * 0.06}>
                <ProjectCard project={project} />
              </Reveal>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-slate-500 dark:text-slate-400">
              <p className="mb-6">No projects in this category yet — but we're building them.</p>
              <GlowButton to="/contact" variant="ghost">
                Start a Project <ArrowRight className="h-4 w-4" />
              </GlowButton>
            </div>
          )}
        </div>

        {/* Section heading kept for spacing compatibility if any consumers reference it */}
        <div className="sr-only">
          <SectionHeading title="" />
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
