import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Send, Bot, Lightbulb, Sparkles, ArrowRight, Loader2, AlertCircle, Rocket,
  Copy, RotateCw, Trash2, Check,
} from 'lucide-react';
import { PageHero } from '../components/Sections';
import { GlowButton } from '../components/Premium';
import { Reveal } from '../components/motion';
import { planProject, businessAdvice, analyzeIdea, AIResponse } from '../lib/ai';
import Markdown from '../lib/markdown';

type DemoKey = 'planner' | 'advisor' | 'idea';
const DEMOS: { key: DemoKey; title: string; subtitle: string; icon: React.ElementType; placeholder: string }[] = [
  { key: 'planner', title: 'AI Project Planner', subtitle: 'Describe your goal — get a structured plan, phases, risks and relevant services.', icon: Bot, placeholder: 'I run a fashion brand in Lagos and need an e-commerce website with WhatsApp checkout.' },
  { key: 'advisor', title: 'AI Business Advisor', subtitle: 'Ask about AI, automation, product strategy, websites or apps.', icon: Lightbulb, placeholder: 'Should we add a chatbot to our website first or start with internal automation?' },
  { key: 'idea', title: 'Idea Analyzer', subtitle: 'Pitch an idea — get strengths, risks, MVP and next steps.', icon: Sparkles, placeholder: 'An app that helps freelance writers manage clients and invoices with AI.' },
];

interface PlannerForm {
  projectIdea: string;
  projectType: string;
  targetUsers: string;
  businessType: string;
  desiredFeatures: string;
  platform: string;
  budget: string;
  deadline: string;
  integrations: string;
  technicalRequirements: string;
  designRequirements: string;
  notes: string;
}
const emptyPlanner: PlannerForm = {
  projectIdea: '', projectType: '', targetUsers: '', businessType: '', desiredFeatures: '',
  platform: '', budget: '', deadline: '', integrations: '', technicalRequirements: '',
  designRequirements: '', notes: '',
};

const AILab: React.FC = () => {
  const [active, setActive] = useState<DemoKey>('planner');
  const [input, setInput] = useState('');
  const [form, setForm] = useState<PlannerForm>(emptyPlanner);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<string | PlannerForm | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentDemo = DEMOS.find(d => d.key === active)!;
  const Icon = currentDemo.icon;

  const minLength = active === 'planner' ? 20 : 8;

  function switchTab(k: DemoKey) {
    setActive(k);
    setResponse(null);
    setError(null);
    setInput('');
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setLoading(false);
  }

  function currentInputInvalid(): string | null {
    if (active === 'planner') {
      if (form.projectIdea.trim().length < minLength) return `Describe your idea in at least ${minLength} characters.`;
      return null;
    }
    if (input.trim().length < minLength) return `Please enter at least ${minLength} characters.`;
    if (input.length > 3000) return 'Please keep it under 3,000 characters.';
    return null;
  }

  async function run(prompt?: string | PlannerForm) {
    const toSend = prompt ?? (active === 'planner' ? form : input);
    const invalid = typeof toSend === 'string' ? (toSend.trim().length < minLength ? 'Input too short.' : null) : currentInputInvalid();
    if (invalid && !prompt) { setError(invalid); return; }
    setLoading(true); setError(null); setCopied(false);
    setLastPrompt(toSend);
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let r: AIResponse;
      if (active === 'planner') r = await planProject(toSend as PlannerForm, ctrl.signal);
      else if (active === 'advisor') r = await businessAdvice((toSend as string) || input, ctrl.signal);
      else r = await analyzeIdea((toSend as string) || input, ctrl.signal);
      setResponse(r);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function regenerate() {
    if (!lastPrompt) return;
    setResponse(null);
    await run(lastPrompt);
  }

  function startOver() {
    setResponse(null); setError(null); setInput(''); setForm(emptyPlanner); setLastPrompt(null);
  }

  async function copyResult() {
    if (!response) return;
    try { await navigator.clipboard.writeText(response.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    run();
  }

  const invalidMsg = useMemo(() => (loading || response ? null : currentInputInvalid()), [input, form, active, loading, response]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="AI Lab"
        title="Plan. Advise. Analyze. Live."
        subtitle="Three production-grade AI tools powered by Tolesh's real model pipeline (DeepSeek V4 Flash, MiniMax M2.7, GLM-5.3-Flash fallback). No demo mode — every response is generated live."
      />

      <Reveal>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {DEMOS.map(d => {
            const Active = d.key === active;
            const DIcon = d.icon;
            return (
              <button
                key={d.key}
                onClick={() => switchTab(d.key)}
                className={`tt-glass tt-glow-border group flex items-start gap-3 rounded-2xl p-4 text-left transition-all ${Active ? 'ring-2 ring-brand-500/60' : ''}`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${Active ? 'bg-gradient-to-br from-brand-500 to-brand-400 text-white' : 'bg-brand-500/15 text-brand-500'}`}>
                  <DIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{d.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{d.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Reveal>

      <div className="tt-glass tt-glow-border overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/5 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 text-white">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-bold text-slate-900 dark:text-white">{currentDemo.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{currentDemo.subtitle}</div>
          </div>
          {response && (
            <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
              Live
            </span>
          )}
        </div>

        <div className="min-h-[220px] max-h-[560px] overflow-y-auto p-5 sm:p-6">
          {!response && !loading && !error && (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400">
              <Bot className="mb-3 h-8 w-8 text-brand-500/60" />
              <p className="max-w-md text-sm">
                {active === 'planner'
                  ? 'Fill in as much of the brief as you can. We\'ll return a structured project plan with phases, risks and relevant Toluene Tech services.'
                  : active === 'advisor'
                  ? 'Ask a practical question about digital strategy, AI, websites, apps or automation.'
                  : 'Describe your idea — we\'ll map strengths, risks, MVP and next steps.'}
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div>{error}</div>
                <button
                  onClick={() => run()}
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 dark:bg-red-800/30 dark:text-red-200 dark:hover:bg-red-800/50"
                >
                  <RotateCw className="h-3 w-3" /> Retry
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                {active === 'planner' ? 'Drafting your project plan…' : active === 'advisor' ? 'Thinking this through…' : 'Analysing your idea…'}
              </span>
            </div>
          )}

          {response && !loading && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-brand-500/10 p-5 text-sm leading-relaxed text-slate-700 dark:bg-brand-500/10 dark:text-slate-200">
                <Markdown text={response.text} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={copyResult} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={regenerate} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  <RotateCw className="h-3 w-3" /> Regenerate
                </button>
                <button onClick={startOver} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  <Trash2 className="h-3 w-3" /> Start over
                </button>
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <GlowButton to={`/start-project?service=${encodeURIComponent('AI Integration & Automation')}`}>
                  <Rocket className="h-4 w-4" /> Start this project with us
                </GlowButton>
              </div>
              {response.usedFallback && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Note: the primary model was busy, so this response came from our fallback model.
                </p>
              )}
            </div>
          )}
        </div>

        {!response && (
          <div className="border-t border-white/5 p-4 sm:p-5">
            {active === 'planner' ? (
              <form onSubmit={onSubmit} className="space-y-3">
                <Field label="Project idea *" value={form.projectIdea} onChange={v => setForm({ ...form, projectIdea: v })} multiline placeholder="Describe what you want to build and who it's for." maxLength={2000} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project type" value={form.projectType} onChange={v => setForm({ ...form, projectType: v })} placeholder="e.g. Website, Web app, Mobile app, AI agent, Automation" />
                  <Field label="Target users" value={form.targetUsers} onChange={v => setForm({ ...form, targetUsers: v })} placeholder="e.g. Fashion shoppers in Lagos, 18-35" />
                  <Field label="Business type" value={form.businessType} onChange={v => setForm({ ...form, businessType: v })} placeholder="e.g. Fashion brand, SaaS, Restaurant" />
                  <Field label="Platform" value={form.platform} onChange={v => setForm({ ...form, platform: v })} placeholder="e.g. Web, iOS + Android, WhatsApp" />
                  <Field label="Budget" value={form.budget} onChange={v => setForm({ ...form, budget: v })} placeholder="e.g. ₦500k, $2k, or a range" />
                  <Field label="Deadline" value={form.deadline} onChange={v => setForm({ ...form, deadline: v })} placeholder="e.g. 8 weeks, Q4 2026" />
                </div>
                <Field label="Desired features" value={form.desiredFeatures} onChange={v => setForm({ ...form, desiredFeatures: v })} multiline placeholder="Key features you need (payments, admin dashboard, chatbot, etc.)" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Integrations" value={form.integrations} onChange={v => setForm({ ...form, integrations: v })} placeholder="e.g. Paystack, WhatsApp, Google Sheets, CRM" />
                  <Field label="Design requirements" value={form.designRequirements} onChange={v => setForm({ ...form, designRequirements: v })} placeholder="e.g. Existing brand guide, modern/minimal, luxury" />
                </div>
                <Field label="Technical requirements" value={form.technicalRequirements} onChange={v => setForm({ ...form, technicalRequirements: v })} multiline placeholder="Any technical constraints (hosting, stack preference, compliance)." />
                <Field label="Additional notes" value={form.notes} onChange={v => setForm({ ...form, notes: v })} multiline placeholder="Anything else we should know." />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-slate-400">
                    {invalidMsg || 'We only use your input to generate the plan — nothing is stored as a lead unless you explicitly start a project.'}
                  </p>
                  <button
                    type="submit"
                    disabled={loading || !!invalidMsg}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-5 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg disabled:opacity-40"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Generate plan
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onSubmit} className="flex items-start gap-2">
                <div className="flex-1">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
                    placeholder={currentDemo.placeholder}
                    rows={3}
                    maxLength={active === 'planner' ? 6000 : 3000}
                    className="w-full resize-none rounded-2xl border border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <p className={`mt-1 px-2 text-[11px] ${invalidMsg ? 'text-red-500' : 'text-slate-400'}`}>
                    {invalidMsg || `${input.length} / ${active === 'planner' ? 6000 : 3000} characters · Enter to send, Shift+Enter for newline`}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading || !!invalidMsg}
                  className="mt-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow transition-all hover:shadow-glow-lg disabled:opacity-40"
                  aria-label="Send"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">Want to build what you just planned?</p>
        <div className="mt-4 flex justify-center">
          <GlowButton to="/start-project">
            Book a discovery call <ArrowRight className="h-4 w-4" />
          </GlowButton>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Responses are AI-generated. Don't send sensitive information. We don't store AI Lab conversations as leads.</p>
      </div>
    </div>
  );
};

const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; maxLength?: number;
}> = ({ label, value, onChange, placeholder, multiline, maxLength }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
    {multiline ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={maxLength}
        className="w-full resize-y rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
      />
    )}
  </label>
);

export default AILab;
