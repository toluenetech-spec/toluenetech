import React, { useState } from 'react';
import { useProjects } from '../context/ProjectContext';
import { ProjectCategory } from '../types';
import { ProjectCard, SectionHeading } from '../components/UI';

const Portfolio: React.FC = () => {
  const { projects } = useProjects();
  const [filter, setFilter] = useState<ProjectCategory | 'All'>('All');

  const categories: (ProjectCategory | 'All')[] = ['All', 'Web Design', 'Frontend', 'UI/UX', 'Product Design', 'Motion & Video'];

  const filteredProjects = projects.filter(p => 
    p.isPublished && (filter === 'All' || p.category === filter)
  );

  return (
    <div className="pt-12 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">Our Work</h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            A selection of projects where design meets functionality.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-12 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                filter === cat 
                  ? 'bg-brand-600 text-white shadow-md transform scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.length > 0 ? (
            filteredProjects.map((project, idx) => (
               <div key={project.id} className="animate-fade-in-up" style={{ animationDelay: `${0.2 + (idx * 0.1)}s` }}>
                 <ProjectCard project={project} />
               </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 text-slate-500 dark:text-slate-400 animate-fade-in">
              <p>No projects found in this category.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
