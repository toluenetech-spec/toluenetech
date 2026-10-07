import React from 'react';

/**
 * Tolesh AI avatar — a small rounded square with the TT monogram.
 * The online-status dot in the corner sits outside the rounded square
 * (overflow: visible) so it never gets clipped.
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
        borderRadius: Math.max(8, Math.round(size * 0.22)),
        background: '#0b1220',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(15,23,42,0.18)',
        overflow: 'visible',
      }}
      aria-label="Tolesh AI"
      role="img"
    >
      <svg viewBox="0 0 32 32" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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
          position: 'absolute', right: -3, bottom: -3,
          width: 11, height: 11,
          borderRadius: '50%',
          background: dot,
          border: '2px solid #ffffff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.05)',
        }}
        aria-hidden
      />
    </span>
  );
};

export default ToleshAvatar;
