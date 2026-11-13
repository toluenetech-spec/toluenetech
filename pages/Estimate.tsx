import React, { useState, useMemo } from 'react';
import { ArrowRight, ArrowLeft, Send } from 'lucide-react';
import { PageHero } from '../components/Sections';
import { GlowButton } from '../components/Premium';
import { useData } from '../context/DataContext';

const TYPES = ['Website', 'Web App', 'Mobile App', 'AI/Automation', 'Branding/Design', 'Video'];
const COMPLEXITIES = ['Simple', 'Standard', 'Complex', 'Enterprise'];

const BASE: Record<string, number> = { 'Website': 1500, 'Web App': 5000, 'Mobile App': 8000, 'AI/Automation': 4000, 'Branding/Design': 1200, 'Video': 800 };
const COMPLEXITY_MULT: Record<string, number> = { 'Simple': 1, 'Standard': 1.6, 'Complex': 2.6, 'Enterprise': 4 };

const Estimate: React.FC = () => {
  const { addLead } = useData();
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [complexity, setComplexity] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [ref, setRef] = useState('');

  const range = useMemo(() => {
    if (!type || !complexity) return null;
    const base = BASE[type] * COMPLEXITY_MULT[complexity];
    const extra = services.length * 800;
    const low = Math.round((base + extra) * 0.8);
    const high = Math.round((base + extra) * 1.4);
    return { low, high };
  }, [type, complexity, services]);

  const toggleService = (s: string) => setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const submit = async () => {
    const lead = await addLead({
      name, email,
      services: [type, ...services],
      requirements: `Estimator: complexity=${complexity}, budget=${budget}, timeline=${timeline}`,
      budget, timeline,
      source: 'estimate',
      status: 'new',
    });
    setRef(lead.reference);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Estimate request received</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">Your reference is <span className="font-mono font-bold text-brand-500">{ref}</span>. We'll prepare a detailed quote and reply within 2 business hours.</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">The range below was an estimate, not a final quote.</p>
        <div className="mt-8"><GlowButton to="/">Back to Home</GlowButton></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
      <PageHero
        eyebrow="Project Estimator"
        title="Get a quick price range."
        subtitle="A rough estimate in 60 seconds. We'll prepare a detailed quote once we understand your project. This is NOT a final quotation."
      />

      <div className="mb-8">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all" style={{ width: `${(step / 6) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Step {step} of 6</p>
      </div>

      <div className="tt-glass tt-glow-border rounded-3xl p-8">
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Project type</h2>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TYPES.map(t => (
                <button key={t} onClick={() => setType(t)} type="button" className={`rounded-xl border px-4 py-3 text-sm font-medium ${type === t ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-200' : 'border-slate-200 dark:border-white/10 hover:border-brand-400'}`}>{t}</button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Additional features</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select anything that applies.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {['User accounts', 'Payments', 'Admin dashboard', 'CMS', 'AI chatbot', 'Search', 'API integrations', 'Mobile responsive'].map(s => (
                <button key={s} onClick={() => toggleService(s)} type="button" className={`rounded-xl border px-4 py-3 text-sm font-medium ${services.includes(s) ? 'border-brand-500 bg-brand-500/10' : 'border-slate-200 dark:border-white/10 hover:border-brand-400'}`}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Complexity</h2>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COMPLEXITIES.map(c => (
                <button key={c} onClick={() => setComplexity(c)} type="button" className={`rounded-xl border px-4 py-3 text-sm font-medium ${complexity === c ? 'border-brand-500 bg-brand-500/10' : 'border-slate-200 dark:border-white/10 hover:border-brand-400'}`}>{c}</button>
              ))}
            </div>
            {range && (
              <div className="mt-6 rounded-xl bg-brand-500/10 p-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Estimated range</p>
                <p className="font-display text-2xl font-bold text-brand-600 dark:text-brand-300">${range.low.toLocaleString()} – ${range.high.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Estimate only — final price after discovery.</p>
              </div>
            )}
          </div>
        )}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Budget</h2>
            <input value={budget} onChange={e => setBudget(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 p-3 dark:border-white/10 dark:bg-white/5" placeholder="Your available budget" />
          </div>
        )}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Timeline</h2>
            <input value={timeline} onChange={e => setTimeline(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 p-3 dark:border-white/10 dark:bg-white/5" placeholder="When do you want to launch?" />
          </div>
        )}
        {step === 6 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Contact details</h2>
            <div className="mt-4 grid gap-3">
              <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 dark:border-white/10 dark:bg-white/5" placeholder="Name" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 dark:border-white/10 dark:bg-white/5" placeholder="Email" />
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300"><ArrowLeft className="h-4 w-4" /> Back</button>
          {step < 6 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={(step === 1 && !type) || (step === 3 && !complexity)} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-40">Next <ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={submit} disabled={!name || !email} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-40">Request Detailed Quote <Send className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Estimate;
