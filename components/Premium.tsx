import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Professional, restrained building blocks for Toluene Tech.
 *
 * Earlier versions used glassmorphism, aurora blobs, cursor glow, floating
 * shapes, gradient-shimmer buttons, magnetic hover and animated gradient
 * text — all classic "vibe-coded" tells. They've been replaced with a
 * clean surface + accent-button system so the UI reads as a serious studio.
 */

/* Subtle section background, no aurora. */
export const Aurora: React.FC<{ className?: string; variant?: 'hero' | 'section' }> = ({ className = '' }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
    <div
      className="absolute rounded-full"
      style={{
        width: '36rem', height: '36rem', top: '-20%', left: '-10%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.08), transparent 65%)',
      }}
    />
  </div>
);

/* No floating shapes — the UI feels more professional without them. */
export const FloatingShapes: React.FC = () => null;

/** Get current theme: 'dark' or 'light'. Lives outside React so it can be used synchronously. */
function readIsDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch { return false; }
}

/** Hook: subscribes to dark-mode changes (class on <html>). */
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState<boolean>(readIsDark);
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', update);
    window.addEventListener('storage', update);
    return () => {
      obs.disconnect();
      mq.removeEventListener?.('change', update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return isDark;
}

type ButtonProps = {
  children: React.ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'accent';
  className?: string;
  type?: 'button' | 'submit';
  target?: string;
  rel?: string;
};

/**
 * GlowButton — now with hardcoded inline colors per theme, so dark/light
 * contrast can never be broken by a competing Tailwind/utility class or a
 * global CSS rule. Inline styles are intentional and beat everything else.
 */
export const GlowButton: React.FC<ButtonProps> = ({
  children, to, href, onClick, variant = 'primary', className = '', type = 'button', target, rel,
}) => {
  const isDark = useIsDark();

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.72rem 1.25rem',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    lineHeight: 1,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    border: '1px solid transparent',
    backgroundImage: 'none',
    boxShadow: 'none',
    transition: 'background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease',
    fontFamily: 'inherit',
  };

  let rest: React.CSSProperties = {};
  if (variant === 'primary') {
    rest = isDark
      ? { background: '#ffffff', color: '#0b1220', borderColor: '#ffffff' }
      : { background: '#0b1220', color: '#ffffff', borderColor: '#0b1220' };
  } else if (variant === 'ghost') {
    rest = isDark
      ? { background: 'transparent', color: '#ffffff', borderColor: '#ffffff' }
      : { background: 'transparent', color: '#0b1220', borderColor: '#0b1220' };
  } else {
    // accent (blue)
    rest = { background: '#2563eb', color: '#ffffff', borderColor: '#2563eb' };
  }

  const [hover, setHover] = React.useState(false);
  if (hover) {
    if (variant === 'primary') {
      rest = isDark
        ? { background: '#0b1220', color: '#ffffff', borderColor: '#0b1220' }
        : { background: '#000000', color: '#ffffff', borderColor: '#000000' };
    } else if (variant === 'ghost') {
      rest = isDark
        ? { background: '#ffffff', color: '#0b1220', borderColor: '#ffffff' }
        : { background: '#0b1220', color: '#ffffff', borderColor: '#0b1220' };
    } else {
      rest = { background: '#1d4ed8', color: '#ffffff', borderColor: '#1d4ed8' };
    }
  }

  const style = { ...base, ...rest };
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
  };
  const userClass = `tt-btn tt-btn-${variant} ${className}`.trim();

  if (to) return <Link to={to} className={userClass} style={style} {...handlers}>{children}</Link>;
  if (href) return <a href={href} target={target} rel={rel} className={userClass} style={style} {...handlers}>{children}</a>;
  return <button type={type} onClick={onClick} className={userClass} style={style} {...handlers}>{children}</button>;
};

export const Pill: React.FC<{ children: React.ReactNode; className?: string; accent?: boolean }> = ({
  children, className = '', accent = false,
}) => (
  <span className={`tt-pill ${accent ? 'tt-pill-accent' : ''} ${className}`}>{children}</span>
);
