import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Quote } from 'lucide-react';
import { PageHero, EmptyState, CTASection } from '../components/Sections';
import { StaggerGroup, StaggerItem } from '../components/motion';
import { GlowButton } from '../components/Premium';
import { useData } from '../context/DataContext';

const Testimonials: React.FC = () => {
  const { testimonials, projects } = useData();
  const published = testimonials.filter(t => t.isPublished);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Testimonials"
        title="What our clients say."
        subtitle="Real feedback from real clients. We don't invent quotes — if it's here, a client said it."
      />
      {published.length === 0 ? (
        <EmptyState
          icon={<Quote className="h-10 w-10" />}
          title="Testimonials coming soon"
          description="We're collecting client testimonials. Work with us and you could be featured here."
          action={<GlowButton to="/start-project">Start a Project</GlowButton>}
        />
      ) : (
        <StaggerGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {published.map(t => {
            const project = t.relatedProjectId ? projects.find(p => p.id === t.relatedProjectId) : null;
            return (
              <StaggerItem key={t.id}>
                <div className="tt-glass tt-glow-border h-full rounded-2xl p-7">
                  <MessageSquare className="h-6 w-6 text-brand-500" />
                  <p className="mt-4 text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">"{t.quote}"</p>
                  <div className="mt-6 flex items-center gap-3">
                    {t.photoUrl ? (
                      <img src={t.photoUrl} alt={t.clientName} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 font-bold text-brand-600">{t.clientName.charAt(0)}</div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{t.clientName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.role || ''}{t.company ? ` · ${t.company}` : ''}
                      </div>
                    </div>
                  </div>
                  {project && (
                    <Link to={`/project/${project.id}`} className="mt-4 inline-block text-xs font-semibold text-brand-500 hover:underline">
                      Read case study →
                    </Link>
                  )}
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      )}
      <div className="mt-20"><CTASection /></div>
    </div>
  );
};

export default Testimonials;
