import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/* Aurora — animated mesh-gradient blobs for section backgrounds. */
export const Aurora: React.FC<{ className?: string; variant?: 'hero' | 'section' }> = ({
  className = '',
  variant = 'section',
}) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
    <div
      className="tt-aurora animate-aurora"
      style={{
        width: variant === 'hero' ? '46rem' : '32rem',
        height: variant === 'hero' ? '46rem' : '32rem',
        top: '-12%',
        left: '-6%',
        background: 'radial-gradient(circle, rgba(47,123,255,0.55), transparent 62%)',
      }}
    />
    <div
      className="tt-aurora animate-aurora"
      style={{
        width: variant === 'hero' ? '40rem' : '28rem',
        height: variant === 'hero' ? '40rem' : '28rem',
        top: '10%',
        right: '-8%',
        background: 'radial-gradient(circle, rgba(120,90,255,0.45), transparent 62%)',
        animationDelay: '4s',
      }}
    />
    <div
      className="tt-aurora animate-aurora"
      style={{
        width: '30rem',
        height: '30rem',
        bottom: '-16%',
        left: '30%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.28), transparent 60%)',
        animationDelay: '8s',
      }}
    />
  </div>
);

/* Floating geometric shapes for depth. */
export const FloatingShapes: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
    {[
      { size: 12, top: '18%', left: '12%', delay: '0s', d: 8 },
      { size: 8, top: '65%', left: '8%', delay: '1.5s', d: 6 },
      { size: 16, top: '28%', left: '82%', delay: '0.8s', d: 10 },
      { size: 6, top: '78%', left: '72%', delay: '2.2s', d: 7 },
    ].map((s, i) => (
      <motion.div
        key={i}
        className="absolute rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm"
        style={{ width: s.size * 4, height: s.size * 4, top: s.top, left: s.left }}
        animate={{ y: [0, -s.d * 3, 0], rotate: [0, 45, 0] }}
        transition={{ duration: 10 + i * 2, repeat: Infinity, ease: 'easeInOut', delay: parseFloat(s.delay) }}
      />
    ))}
  </div>
);

type ButtonProps = {
  children: React.ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'ghost';
  className?: string;
  type?: 'button' | 'submit';
};

/* GlowButton — the primary premium CTA with an animated sheen. */
export const GlowButton: React.FC<ButtonProps> = ({
  children,
  to,
  href,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
}) => {
  const base =
    'group relative inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold text-sm tracking-wide transition-all duration-300 overflow-hidden';
  const styles =
    variant === 'primary'
      ? 'text-white bg-gradient-to-r from-brand-600 to-brand-400 shadow-glow hover:shadow-glow-lg'
      : 'text-slate-900 dark:text-white tt-glass hover:border-brand-400/40';

  const inner = (
    <>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      {variant === 'primary' && (
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      )}
    </>
  );

  const cls = `${base} ${styles} ${className}`;

  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  return <button type={type} onClick={onClick} className={cls}>{inner}</button>;
};

/* Small tag / pill used for eyebrow labels. */
export const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-2 rounded-full tt-glass px-4 py-1.5 text-xs font-medium tracking-wide text-brand-600 dark:text-brand-200 ${className}`}>
    {children}
  </span>
);
