import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';

interface Props { onLogin: (pw: string) => boolean; }

export default function Login({ onLogin }: Props) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setTimeout(() => {
      const ok = onLogin(pw);
      if (!ok) { setErr('Incorrect password. Please try again.'); setBusy(false); }
    }, 250);
  };
  return (
    <div className="adm-login-wrap">
      <form className="adm-login" onSubmit={submit}>
        <div className="adm-login-brand">
          <div className="adm-mark">TT</div>
          <div>
            <div className="adm-brand-name">Toluene Tech</div>
            <div className="adm-brand-sub">Control Center</div>
          </div>
        </div>
        <h1>Sign in</h1>
        <p>Enter your admin password to continue.</p>
        <div className="adm-field" style={{ marginTop: '1.25rem' }}>
          <label className="adm-label" htmlFor="adm-pw">Password</label>
          <input id="adm-pw" className="adm-input" type="password" autoFocus
            value={pw} onChange={e => setPw(e.target.value)} placeholder="Admin password"
            disabled={busy}/>
        </div>
        {err && <div style={{ color: '#dc2626', fontSize: '0.82rem', marginTop: '0.5rem' }}>{err}</div>}
        <button className="adm-btn adm-btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={busy || !pw}>
          {busy ? <Loader2 size={16} className="animate-spin"/> : <Lock size={16}/>}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted-soft)' }}>
          Secure admin access · Toluene Tech v2.2
        </div>
      </form>
    </div>
  );
}
