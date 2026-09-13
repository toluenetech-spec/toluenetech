import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Bot, Lightbulb, Sparkles, ArrowRight, Loader2, AlertCircle, Rocket } from 'lucide-react';
import { PageHero } from '../components/Sections';
import { GlowButton, Pill } from '../components/Premium';
import { Reveal } from '../components/motion';
import { planProject, businessAdvice, analyzeIdea, AIResponse } from '../lib/ai';

type DemoKey = 'planner' | 'advisor' | 'idea';
const DEMOS: { key: DemoKey; title: string; subtitle: string; icon: React.ElementType; placeholder: string }[] = [
  { key: 'planner', title: 'AI Project Planner', subtitle: 'Describe your goal, get a practical plan.', icon: Bot, placeholder: 'I run a restaurant and want to automate customer questions.' },
  { key: 'advisor', title: 'AI Business Advisor', subtitle: 'Ask about AI, automation or product strategy.', icon: Lightbulb, placeholder: 'Should we add a chatbot to our website or start with internal automation?' },
  { key: 'idea', title: 'Idea Analyzer', subtitle: 'Pitch your idea — get strengths, risks, MVP.', icon: Sparkles, placeholder: 'An app that helps freelance writers manage clients and invoices with AI.' },
];

const AILab: React.FC = () => {
  const [active, setActive] = useState<DemoKey>('planner');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      let r: AIResponse;
      if (active === 'planner') r = await planProject(input);
      else if (active === 'advisor') r = await businessAdvice(input);
      else r = await analyzeIdea(input);
      setResponse(r);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentDemo = DEMOS.find(d => d.key === active)!;
  const Icon = currentDemo.icon;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="AI Lab"
        title="Try AI. Live. No gimmicks."
        subtitle={'Three interactive demos powered by LLMs (with a safe demo-mode fallback). Tell us what you\'re trying to do and get practical, honest output — no fake "thinking" animations, no marketing fluff.'}
      />

      {/* Live key notice */}
      <Reveal>
        <div className="tt-glass mb-8 flex flex-col gap-3 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Running in <strong>demo mode</strong> (templated responses). To use a live LLM, open your browser console and run: <code className="rounded bg-slate-200 px-1 text-[11px] dark:bg-slate-800">window.__TT_GEMINI_KEY="YOUR_KEY"</code>.
              We never ship keys in client code.
            </span>
          </div>
        </div>
      </Reveal>

      {/* Demo selector */}
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {DEMOS.map(d => {
          const Active = d.key === active;
          const DIcon = d.icon;
          return (
            <button
              key={d.key}
              onClick={() => { setActive(d.key); setResponse(null); setError(null); }}
              className={`tt-glass tt-glow-border group flex items-start gap-3 rounded-2xl p-4 text-left transition-all ${Active ? 'ring-2 ring-brand-500/50' : ''}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${Active ? 'bg-gradient-to-br from-brand-500 to-brand-400 text-white' : 'bg-brand-500/15 text-brand-500'}`}>
                <DIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">{d.title}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{d.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Chat/UI */}
      <div className="tt-glass tt-glow-border overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/5 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white">{currentDemo.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{currentDemo.subtitle}</div>
          </div>
          {response && (
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
              {response.mode === 'live' ? 'Live LLM' : 'Demo'}
            </span>
          )}
        </div>

        <div className="min-h-[200px] max-h-[480px] overflow-y-auto p-6">
          {!response && !loading && !error && (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
              <Bot className="mb-3 h-8 w-8 text-brand-500/60" />
              <p className="text-sm">Describe what you're working on and we'll return practical recommendations.</p>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4" /> {error}
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </div>
          )}
          {response && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-brand-500/10 p-5 text-sm leading-relaxed text-slate-700 dark:bg-brand-500/10 dark:text-slate-200 whitespace-pre-wrap">
                {response.text}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <GlowButton to={`/start-project?service=${encodeURIComponent('AI Integration & Automation')}`}>
                  <Rocket className="h-4 w-4" /> Start this project with us
                </GlowButton>
                <button
                  onClick={() => { setResponse(null); setInput(''); }}
                  className="tt-glass rounded-full px-5 py-3 text-sm font-semibold text-slate-700 hover:border-brand-400/40 dark:text-slate-200"
                >
                  Try another
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-4">
          <form onSubmit={e => { e.preventDefault(); run(); }} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={currentDemo.placeholder}
              className="flex-1 rounded-full border border-slate-300 bg-white/80 px-5 py-3 text-sm text-slate-900 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
              maxLength={800}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow transition-all hover:shadow-glow-lg disabled:opacity-40"
              aria-label="Send"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <p className="mt-2 px-2 text-[11px] text-slate-400">
            Responses are generated by AI. Review output before acting on it. Don't send sensitive information.
          </p>
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Want a custom AI demo for your business?</p>
        <div className="mt-4 flex justify-center">
          <GlowButton to={`/start-project?service=${encodeURIComponent('AI Integration & Automation')}`}>
            Book an AI consultation <ArrowRight className="h-4 w-4" />
          </GlowButton>
        </div>
      </div>
    </div>
  );
};

export default AILab;
