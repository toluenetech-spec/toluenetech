import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useData } from '../context/DataContext';
import { GlowButton } from '../components/Premium';
import { Breadcrumb } from '../components/Sections';

const InsightDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { insights } = useData();
  const insight = insights.find(i => i.slug === slug && i.isPublished);

  useEffect(() => {
    if (insight) document.title = `${insight.title} — Toluene Tech`;
    return () => { document.title = 'Toluene Tech | Digital Products, Design, Development & AI'; };
  }, [insight]);

  if (!insight) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Article not found</h2>
        <Link to="/insights" className="mt-4 inline-block text-brand-500 hover:underline">← Back to insights</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="pt-4">
        <Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Insights', to: '/insights' }, { label: insight.title }]} />
      </div>
      <article className="prose prose-slate dark:prose-invert mt-6 max-w-none">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">{insight.category}</span>
        <h1 className="mt-3 font-display text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">{insight.title}</h1>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {insight.author || 'Toluene Tech'}{insight.publishDate ? ` · ${new Date(insight.publishDate).toLocaleDateString()}` : ''}
        </div>
        {insight.coverUrl && (
          <img src={insight.coverUrl} alt={insight.title} className="mt-8 w-full rounded-2xl object-cover" />
        )}
        <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-slate-700 dark:text-slate-300">
          {insight.content}
        </div>
      </article>
      <div className="mt-16 flex justify-center">
        <GlowButton to="/start-project">
          Start a project with us <ArrowRight className="h-4 w-4" />
        </GlowButton>
      </div>
    </div>
  );
};

export default InsightDetail;
