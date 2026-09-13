import React, { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { ArrowLeft, ExternalLink, Github, Wrench, CheckCircle, ArrowRight, Calendar, User } from 'lucide-react';
import { CATEGORY_DISPLAY } from '../types';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getProject } = useProjects();
  const navigate = useNavigate();
  const project = id ? getProject(id) : undefined;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (project) {
      document.title = `${project.title} — Toluene Tech`;
    }
    return () => {
      document.title = 'Toluene Tech | Digital Design, Apps & AI Integration';
    };
  }, [project]);

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Project not found</h2>
        <Link to="/portfolio" className="text-brand-600 dark:text-brand-400 hover:underline">Return to Portfolio</Link>
      </div>
    );
  }

  const categoryLabel = CATEGORY_DISPLAY[project.category] || project.category;
  const isAI = project.category === 'AI Integration & Automation';

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen pt-12 pb-24 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Portfolio
        </Link>

        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 animate-fade-in-up">
          <div>
             <span className="inline-block px-3 py-1 rounded-full bg-brand-50 dark:bg-slate-800 text-brand-700 dark:text-brand-300 text-sm font-bold mb-4">
                {categoryLabel}
             </span>
             <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">{project.title}</h1>
             <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-8">{project.shortDescription}</p>

             <div className="flex flex-wrap gap-3">
                {project.liveUrl && (
                   <a
                       href={project.liveUrl}
                       target="_blank"
                       rel="noreferrer"
                       className="inline-flex items-center gap-2 bg-slate-900 dark:bg-brand-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-brand-500 transition-colors shadow-lg hover:-translate-y-1 transform"
                   >
                       View Live Project <ExternalLink className="h-4 w-4" />
                   </a>
                )}
                {project.githubUrl && (
                   <a
                       href={project.githubUrl}
                       target="_blank"
                       rel="noreferrer"
                       className="inline-flex items-center gap-2 tt-glass text-slate-900 dark:text-white px-6 py-3 rounded-lg font-bold hover:border-brand-400/40 transition-colors shadow-sm hover:-translate-y-1 transform"
                   >
                       <Github className="h-4 w-4" /> View on GitHub
                   </a>
                )}
             </div>
          </div>
          <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
              {project.videoUrl ? (
                <video
                  src={project.videoUrl}
                  poster={project.imageUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={project.imageUrl}
                  alt={project.title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                />
              )}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <section>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                       {isAI ? 'The Problem' : 'The Challenge'}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed whitespace-pre-line">
                        {project.clientProblem ||
                          (isAI
                            ? 'The client needed to automate repetitive workflows and deliver faster, more intelligent experiences to their users.'
                            : 'The client needed a robust solution to improve their digital presence and streamline user operations.')}
                    </p>
                </section>

                <section>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Solution</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed whitespace-pre-line">
                        {project.solution ||
                          (isAI
                            ? 'We designed and integrated a tailored AI solution — connecting models, data, and business systems — while keeping reliability, cost, and user trust at the centre.'
                            : 'We implemented a modern architecture focusing on speed, accessibility, and clean design patterns.')}
                    </p>
                </section>

                <section className="bg-slate-50 dark:bg-slate-900 p-8 rounded-xl border border-slate-100 dark:border-slate-800">
                     <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                        {isAI ? 'Outcome & Value' : 'Key Outcomes'}
                     </h3>
                     <div className="flex items-start gap-3">
                        <CheckCircle className="h-6 w-6 text-brand-500 shrink-0 mt-1" />
                        <p className="text-slate-700 dark:text-slate-300 text-lg whitespace-pre-line">
                             {project.outcome || (
                                isAI
                                  ? 'Results and metrics will be published once the client has approved their case study.'
                                  : 'Increased user engagement and significantly improved performance metrics.'
                             )}
                        </p>
                     </div>
                </section>

                <div className="pt-8">
                     <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                        {isAI ? 'What We Built' : 'About the Project'}
                     </h3>
                     <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{project.fullDescription}</p>
                </div>

                {project.tags && project.tags.length > 0 && (
                  <section>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map(tag => (
                        <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mt-12 p-8 bg-brand-50 dark:bg-slate-800 rounded-xl text-center">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                       {isAI ? 'Need an AI solution like this?' : 'Liked this case study?'}
                    </h3>
                    <Link
                       to={`/contact?service=${encodeURIComponent(categoryLabel)}`}
                       className="inline-flex items-center gap-2 bg-brand-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-brand-700 transition-colors shadow-lg hover:-translate-y-1 transform"
                    >
                         Start a Similar Project <ArrowRight className="h-5 w-5" />
                    </Link>
                </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-4">Project Details</h4>
                    <dl className="space-y-4 text-sm">
                       {project.client && (
                          <div className="flex items-start gap-3">
                             <User className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                             <div>
                                <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Client</dt>
                                <dd className="text-slate-800 dark:text-slate-200 font-medium">{project.client}</dd>
                             </div>
                          </div>
                       )}
                       {project.completionDate && (
                          <div className="flex items-start gap-3">
                             <Calendar className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                             <div>
                                <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Delivered</dt>
                                <dd className="text-slate-800 dark:text-slate-200 font-medium">{project.completionDate}</dd>
                             </div>
                          </div>
                       )}
                       <div className="flex items-start gap-3">
                          <Wrench className="h-4 w-4 text-brand-600 mt-0.5 shrink-0" />
                          <div>
                             <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Service</dt>
                             <dd className="text-slate-800 dark:text-slate-200 font-medium">{categoryLabel}</dd>
                          </div>
                       </div>
                    </dl>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm">
                    <h4 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-4">
                        <Wrench className="h-5 w-5 text-brand-600" /> {isAI ? 'AI & Tech Stack' : 'Tools Used'}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {project.tools.map(tool => (
                            <span key={tool} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-sm font-medium">
                                {tool}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="bg-brand-900 dark:bg-brand-800 text-white p-6 rounded-xl shadow-lg">
                    <h4 className="font-bold text-lg mb-2">Have a similar project?</h4>
                    <p className="text-brand-100 text-sm mb-4">Let's discuss how we can help your business achieve similar results.</p>
                    <Link to="/contact" className="block text-center bg-white text-brand-900 font-bold py-2 rounded-lg hover:bg-brand-50 transition-colors">
                        Get a Quote
                    </Link>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
