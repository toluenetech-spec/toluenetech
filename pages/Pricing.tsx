import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, MessageCircle } from 'lucide-react';
import { PageHero } from '../components/Sections';
import { GlowButton } from '../components/Premium';
import { useData } from '../context/DataContext';

const TIERS = [
  {
    name: 'Starter', price: 'from $999', description: 'Perfect for small businesses launching a simple online presence.',
    items: ['Single-page or 3-page website', 'Responsive design', 'Basic SEO', 'Contact form', '2-week delivery'],
    cta: 'Start a Project', to: '/start-project', featured: false,
  },
  {
    name: 'Business', price: 'from $2,999', description: 'For growing businesses that need a complete digital presence.',
    items: ['Multi-page website', 'CMS integration', 'Brand alignment', 'Analytics setup', 'SEO optimization', '4–6 week delivery'],
    cta: 'Start a Project', to: '/start-project', featured: true,
  },
  {
    name: 'Advanced', price: 'custom', description: 'Web applications, mobile apps and complex digital products.',
    items: ['Custom web or mobile app', 'User accounts & dashboards', 'Third-party integrations', 'API development', 'Dedicated PM', '6–12 week delivery'],
    cta: 'Book Discovery Call', to: '/contact', featured: false,
  },
  {
    name: 'AI Solutions', price: 'custom', description: 'AI integrations and automations scoped to your business.',
    items: ['AI chatbots & assistants', 'LLM integration', 'RAG & knowledge bases', 'Workflow automation', 'Guardrails & monitoring', 'Custom quote after discovery'],
    cta: 'Request AI Consultation', to: '/start-project', featured: false,
  },
];

const Pricing: React.FC = () => {
  const { socialLinks } = useData();
  const waLink = `https://wa.me/${socialLinks.whatsapp}?text=${encodeURIComponent("Hi, I'd like a quote.")}`;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Pricing"
        title="Transparent starting points. Custom quotes for complex work."
        subtitle="Simple projects have simple pricing. Apps, AI integrations and automations depend on scope, integrations, AI usage, infrastructure and maintenance — we quote those individually after a discovery call."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map(t => (
          <div key={t.name} className={`tt-glass tt-glow-border relative flex h-full flex-col rounded-3xl p-7 ${t.featured ? 'ring-2 ring-brand-500/40' : ''}`}>
            {t.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-glow">Most Popular</span>
            )}
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">{t.name}</h3>
            <p className="mt-2 text-2xl font-bold tt-gradient-text">{t.price}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t.description}</p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {t.items.map(i => (
                <li key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {i}
                </li>
              ))}
            </ul>
            <Link to={t.to} className="mt-auto pt-6">
              <button className={`w-full rounded-full px-6 py-3 text-sm font-semibold transition-all ${t.featured ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow hover:shadow-glow-lg' : 'tt-glass hover:border-brand-400/40 text-slate-900 dark:text-white'}`}>
                {t.cta} <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
        ))}
      </div>
      <div className="tt-glass mt-14 rounded-2xl p-8 text-center">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Not sure which tier fits?</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Use our project estimator for a rough price range, or message us directly — we'll help you figure out the right scope.
        </p>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <GlowButton to="/estimate">Get an Estimate</GlowButton>
          <GlowButton href={waLink} variant="ghost"><MessageCircle className="h-4 w-4" /> Chat on WhatsApp</GlowButton>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
