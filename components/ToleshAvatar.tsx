import React from 'react';

/**
 * Tolesh AI avatar — a small rounded square with the TT monogram, used as the
 * bot icon in the chat widget header and next to assistant messages.
 * Matches the Toluene Tech brand: dark bg in light mode, white bg in dark mode,
 * with the TT bars in accent blue. The outer pulse dot indicates "online".
 */
const ToleshAvatar: React.FC<{ size?: number; className?: string; mode?: 'public' | 'admin' | 'client' }> = ({
  size = 36, className = '', mode = 'public',
}) => {
  const dot = mode === 'admin' ? '#f59e0b' : mode === 'client' ? '#10b981' : '#22c55e';
  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size, height: size,
        borderRadius: Math.max(8, size * 0.22),
        background: '#0b1220',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 2px rgba(15,23,42,0.15)',
      }}
      aria-label="Tolesh AI"
      role="img"
    >
      <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        {/* T1 */}
        <rect x="5"  y="8" width="9" height="2.6" rx="0.6" fill="#4f9bff" />
        <rect x="8.2" y="10.6" width="2.6" height="13" rx="0.6" fill="#4f9bff" />
        {/* T2 */}
        <rect x="18" y="8" width="9" height="2.6" rx="0.6" fill="#4f9bff" />
        <rect x="21.2" y="10.6" width="2.6" height="8.4" rx="0.6" fill="#4f9bff" />
        <path d="M22.5 19 v2.5 L 26.5 24.5" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="26.5" cy="24.5" r="1.2" fill="#22d3ee" />
      </svg>
      {/* online dot */}
      <span
        style={{
          position: 'absolute', right: -2, bottom: -2, width: 10, height: 10,
          borderRadius: '50%', background: dot, border: '2px solid #fff',
        }}
        aria-hidden
      />
    </span>
  );
};

export default ToleshAvatar;
