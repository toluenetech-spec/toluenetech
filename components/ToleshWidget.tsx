import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ToleshAvatar from './ToleshAvatar';
import ToleshChat, { ToleshMode } from './ToleshChat';

/**
 * Floating launcher button + panel for Tolesh AI.
 */
const ToleshWidget: React.FC<{ mode?: ToleshMode }> = ({ mode = 'public' }) => {
  const [open, setOpen] = useState(false);

  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const btnBg = open ? '#ffffff' : '#0b1220';
  const btnFg = open ? '#0b1220' : '#ffffff';
  const ring = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const sz = typeof window !== 'undefined' && window.innerWidth < 420 ? 52 : 60;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close Tolesh AI' : 'Chat with Tolesh AI'}
        aria-expanded={open}
        style={{
          position: 'fixed',
          right: 'clamp(0.75rem,3vw,1.25rem)',
          bottom: 'clamp(0.75rem,3vw,1.25rem)',
          zIndex: 70,
          width: sz, height: sz, borderRadius: '999px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: btnBg, color: btnFg,
          border: `1px solid ${btnBg}`,
          boxShadow: `0 10px 28px rgba(15,23,42,0.24), 0 0 0 4px ${ring}`,
          cursor: 'pointer', transition: 'background-color 0.15s, color 0.15s, transform 0.15s',
        }}
      >
        {open
          ? <svg viewBox="0 0 24 24" width={Math.round(sz*0.36)} height={Math.round(sz*0.36)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          : mode === 'public'
            ? <ToleshAvatar size={Math.round(sz * 0.78)} mode={mode} />
            : <MessageCircle size={Math.round(sz * 0.42)} />}
      </button>
      <ToleshChat mode={mode} open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default ToleshWidget;
