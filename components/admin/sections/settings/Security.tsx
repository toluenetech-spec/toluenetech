import React from 'react';
import { Shield, AlertTriangle, Lock, Key } from 'lucide-react';

export default function Security() {
  return (<>
    <div className="adm-page-header">
      <div>
        <div className="adm-page-title">Security</div>
        <div className="adm-page-sub">Current state and recommended improvements.</div>
      </div>
    </div>

    <div className="adm-card" style={{ padding:'1rem 1.1rem', borderColor:'#fde68a', background:'#fffbeb' }}>
      <div className="adm-flex-center" style={{ gap:'0.6rem', color:'#92400e' }}>
        <AlertTriangle size={18}/>
        <div style={{ fontSize:'0.85rem' }}>
          <strong>Action recommended.</strong> A few security items were flagged in the audit. They are preserved as-is (not weakened) and listed here.
        </div>
      </div>
    </div>

    <div className="adm-card">
      <div className="adm-card-title"><Shield size={16}/> Current status</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem', marginTop:'0.6rem' }}>
        <SecurityItem title="Admin password is hardcoded in frontend bundle" status="warn">
          The legacy UI login uses a hardcoded password. Server-side accepts the ADMIN_PASSWORD env override and Firebase JWTs. <strong>Set ADMIN_PASSWORD</strong> as a Worker secret and migrate user login to Firebase Auth when ready.
        </SecurityItem>
        <SecurityItem title="Password stored in plaintext sessionStorage" status="warn">
          The password is sent as <code>X-TT-Admin-Password</code> to admin endpoints. Future work should move to short-lived signed tokens.
        </SecurityItem>
        <SecurityItem title="JWT signature verification" status="warn">
          The server currently validates JWTs structurally (exp/aud/iss) plus DB membership. Full RSA-SHA256 signature verification is a known TODO.
        </SecurityItem>
        <SecurityItem title="Media uploads" status="ok">
          <code>/media/upload</code> is now protected by admin auth (added in this release).
        </SecurityItem>
        <SecurityItem title="AI tool boundaries" status="ok">
          Admin AI tools remain read-only + draft_reply; no destructive/send/financial tools are exposed.
        </SecurityItem>
        <SecurityItem title="Dahl API key" status="ok">
          The AI provider key stays on the Worker; it is never exposed to the browser.
        </SecurityItem>
        <SecurityItem title="Demo client auth" status="info">
          Client demo authentication (<code>demo@toluenetech.com / DEMO-2026</code>) remains for the client portal preview. Replace with per-client generated codes when rolling out to real clients.
        </SecurityItem>
      </div>
    </div>
  </>);
}

function SecurityItem({ title, status, children }: { title: string; status: 'ok'|'warn'|'info'; children: React.ReactNode }) {
  const color = status === 'ok' ? { icon:<Lock size={14}/>, badge:'operational', label:'OK' } : status === 'warn' ? { icon:<AlertTriangle size={14}/>, badge:'degraded', label:'Attention' } : { icon:<Key size={14}/>, badge:'unknown', label:'Note' };
  return (
    <div style={{ display:'flex', gap:'0.75rem', padding:'0.65rem 0', borderBottom:'1px solid var(--line)' }}>
      <span className={`adm-badge ${color.badge}`} style={{ height:'fit-content' }}>{color.icon}{color.label}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{title}</div>
        <div className="adm-muted" style={{ fontSize:'0.82rem', marginTop:2 }}>{children}</div>
      </div>
    </div>
  );
}
