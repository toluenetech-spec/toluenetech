import React from 'react';
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

export const GlowButton: React.FC<ButtonProps> = ({
  children, to, href, onClick, variant = 'primary', className = '', type = 'button', target, rel,
}) => {
  const variantCls =
    variant === 'ghost'  ? 'tt-btn tt-btn-ghost'
  : variant === 'accent' ? 'tt-btn tt-btn-accent'
  : 'tt-btn tt-btn-primary';
  const cls = `${variantCls} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) return <a href={href} target={target} rel={rel} className={cls}>{children}</a>;
  return <button type={type} onClick={onClick} className={cls}>{children}</button>;
};

export const Pill: React.FC<{ children: React.ReactNode; className?: string; accent?: boolean }> = ({
  children, className = '', accent = false,
}) => (
  <span className={`tt-pill ${accent ? 'tt-pill-accent' : ''} ${className}`}>{children}</span>
);
