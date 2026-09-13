import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn } from 'lucide-react';
import { useClientAuth } from '../../context/ClientAuthContext';
import { GlowButton } from '../../components/Premium';

const PortalLogin: React.FC = () => {
  const { login } = useClientAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, code)) navigate('/portal/dashboard');
    else setErr('Invalid email or access code. Clients receive access codes from Toluene Tech on project kickoff.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-ink-950">
      <form onSubmit={submit} className="tt-glass tt-glow-border w-full max-w-md rounded-3xl p-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-glow">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-center font-display text-2xl font-bold text-slate-900 dark:text-white">Client Portal</h1>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Sign in to track projects, milestones, files and messages.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input type="email" required value={email} onChange={e => { setEmail(e.target.value); setErr(''); }}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Access code</label>
            <input type="password" required value={code} onChange={e => { setCode(e.target.value); setErr(''); }}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
          </div>
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-3 text-sm font-semibold text-white shadow-glow">
            <LogIn className="h-4 w-4" /> Sign in
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          Need access? <a href="/contact" className="text-brand-500 hover:underline">Contact Toluene Tech</a>.
        </p>
        <div className="mt-4 text-center">
          <a href="/" className="text-xs text-slate-500 hover:underline">← Back to website</a>
        </div>
      </form>
    </div>
  );
};

export default PortalLogin;
