import React from 'react';
import { Wrench } from 'lucide-react';
// Tools stack is currently only in Firebase DataContext (DEFAULT_TOOLS).
// Neon schema has no dedicated tools table yet; display a coming-soon card.
export default function ToolsSection() {
  return (
    <div className="adm-card" style={{ padding: '2rem' }}>
      <div className="adm-card-title"><Wrench size={16}/> Tools / Stack</div>
      <div className="adm-card-sub">The public /technology page currently sources its tool logos from a built-in list. A database-backed stack manager is in progress.</div>
      <div className="adm-muted adm-mt-md" style={{ fontSize: '0.85rem' }}>
        To update the tools displayed publicly, edit <code style={{ background:'var(--bg-soft)', padding:'0.1rem 0.35rem', borderRadius:4 }}>context/DataContext.tsx → DEFAULT_TOOLS</code>.
      </div>
    </div>
  );
}
