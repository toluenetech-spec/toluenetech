import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PageHero, CTASection } from '../components/Sections';
import { Reveal } from '../components/motion';
import { useData } from '../context/DataContext';
import { FAQCategory } from '../types';

const FAQ_PAGE_CATEGORIES: FAQCategory[] = ['General', 'Services', 'Pricing', 'AI', 'Projects', 'Support'];

const FAQ: React.FC = () => {
  const { faqs } = useData();
  const [activeCat, setActiveCat] = useState<FAQCategory | 'All'>('All');
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = faqs
    .filter(f => f.isPublished)
    .filter(f => activeCat === 'All' || f.category === activeCat)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="FAQ"
        title="Questions? We have answers."
        subtitle="The most common things people ask before working with us. Can't find what you're looking for? Message us directly."
      />

      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {(['All', ...FAQ_PAGE_CATEGORIES] as const).map(c => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              activeCat === c
                ? 'bg-brand-600 text-white shadow-md'
                : 'tt-glass text-slate-600 dark:text-slate-300 hover:border-brand-400/40'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((f, i) => {
          const open = openId === f.id;
          return (
            <Reveal key={f.id} delay={i * 0.03}>
              <div className="tt-glass tt-glow-border overflow-hidden rounded-2xl">
                <button
                  onClick={() => setOpenId(open ? null : f.id)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                  aria-expanded={open}
                >
                  <span className="font-semibold text-slate-900 dark:text-white">{f.question}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-brand-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="px-5 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {f.answer}
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
        {visible.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">No FAQs in this category yet.</p>
        )}
      </div>

      <div className="mt-16"><CTASection title="Still have questions?" subtitle="Send us a message or start a conversation on WhatsApp — we usually reply within 2 hours." /></div>
    </div>
  );
};

export default FAQ;
