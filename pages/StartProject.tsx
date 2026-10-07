import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { PageHero } from '../components/Sections';
import { GlowButton } from '../components/Premium';
import { useData } from '../context/DataContext';

const PROJECT_TYPES = [
  'Website', 'Web App', 'Mobile App', 'UI/UX', 'AI', 'Automation', 'Branding', 'Video', 'Other',
];
const BUDGETS = ['< $1k', '$1k – $5k', '$5k – $15k', '$15k – $50k', '$50k+', 'Not sure yet'];
const TIMELINES = ['ASAP (1–2 weeks)', '1 month', '2–3 months', '3–6 months', 'Flexible'];

const StartProject: React.FC = () => {
  const [searchParams] = useSearchParams();
  const prefillService = searchParams.get('service') || '';
  const navigate = useNavigate();
  const { addLead } = useData();

  const [step, setStep] = useState(1);
  const [types, setTypes] = useState<string[]>(
    prefillService ? (PROJECT_TYPES.some(t => prefillService.toLowerCase().includes(t.toLowerCase())) ? [PROJECT_TYPES.find(t => prefillService.toLowerCase().includes(t.toLowerCase()))!] : []) : []
  );
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [existing, setExisting] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 7;
  const canNext = useMemo(() => {
    if (step === 1) return types.length > 0;
    if (step === 2) return description.trim().length > 10;
    if (step === 3) return true;
    if (step === 4) return budget !== '';
    if (step === 5) return timeline !== '';
    if (step === 6) return true;
    if (step === 7) return name.trim() && /\S+@\S+\.\S+/.test(email);
    return true;
  }, [step, types, description, budget, timeline, name, email]);

  const toggleType = (t: string) =>
    setTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const lead = await addLead({
        name, email, phone: phone || undefined, company: company || undefined,
        services: types,
        projectType: types,
        requirements: description,
        features: features.split('\n').map(f => f.trim()).filter(Boolean),
        budget, timeline,
        existingAssets: existing || undefined,
        source: 'website',
        status: 'new',
      });
      setReference(lead.reference);
      setStep(8);
    } catch (e: any) {
      setError('Something went wrong submitting your request. Please try again or contact us directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => setStep(s => Math.min(totalSteps + 1, s + 1));
  const prev = () => setStep(s => Math.max(1, s - 1));

  if (reference || step === 8) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 sm:px-6 lg:px-8">
        <div className="tt-glass tt-glow-border w-full rounded-3xl p-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">Request received</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Thanks <strong>{name}</strong>. Your project reference is:
          </p>
          <div className="mt-4 inline-block rounded-xl bg-brand-500/10 px-5 py-3 font-mono text-lg font-bold text-brand-600 dark:text-brand-300">{reference}</div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">We'll reply within 2 business hours.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <GlowButton to="/">Back to Home</GlowButton>
            <GlowButton to="/portfolio" variant="ghost">See Our Work</GlowButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero eyebrow="Start a Project" title="Let's scope your project." subtitle="7 quick steps. Takes about 2 minutes." />

      {/* Progress */}
      <div className="mb-8">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Step {step} of {totalSteps}</div>
      </div>

      <div className="tt-glass tt-glow-border rounded-3xl p-8">
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">What do you need?</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select all that apply.</p>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PROJECT_TYPES.map(t => {
                const active = types.includes(t);
                return (
                  <button key={t} onClick={() => toggleType(t)} type="button"
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${active ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'}`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Describe your project</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">What are you trying to build or improve?</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-900 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="e.g. We run a logistics company and need a customer website with a booking portal…" />
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Key features</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Optional. List the most important features (one per line).</p>
            <textarea value={features} onChange={e => setFeatures(e.target.value)} rows={5}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-900 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="User accounts\nPayments\nAI chatbot\nAdmin dashboard" />
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Budget range</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Estimated range only — this isn't a commitment.</p>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUDGETS.map(b => (
                <button key={b} onClick={() => setBudget(b)} type="button"
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${budget === b ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Timeline</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">When would you like to launch?</p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TIMELINES.map(t => (
                <button key={t} onClick={() => setTimeline(t)} type="button"
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${timeline === t ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Existing website or assets?</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tell us what you already have in place (optional).</p>
            <textarea value={existing} onChange={e => setExisting(e.target.value)} rows={4}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-900 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="Existing WordPress site, logo, brand guidelines, CRM…" />
          </div>
        )}

        {step === 7 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">How do we reach you?</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">We'll reply within 2 business hours.</p>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone / WhatsApp (optional)</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Company (optional)</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white" />
                </div>
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 1}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < totalSteps ? (
            <button
              onClick={next}
              disabled={!canNext}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg disabled:opacity-40"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canNext || submitting}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg disabled:opacity-40"
            >
              {submitting ? 'Submitting…' : <>Submit <Send className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StartProject;
