import React, { useRef, useState, useEffect } from 'react';
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  MotionValue,
} from 'framer-motion';

/* ------------------------------------------------------------------ *
 * Premium animated primitives shared across the site.
 * ------------------------------------------------------------------ */

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

const offsetFor = (dir: Direction, distance: number): { x?: number; y?: number } => {
  switch (dir) {
    case 'up': return { y: distance };
    case 'down': return { y: -distance };
    case 'left': return { x: distance };
    case 'right': return { x: -distance };
    default: return {};
  }
};

/** Reveal — fades/slides content in when it scrolls into view. */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  direction?: Direction;
  distance?: number;
  className?: string;
  once?: boolean;
}> = ({ children, delay = 0, direction = 'up' as Direction, distance = 28, className, once = true }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...offsetFor(direction, distance) }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/** Stagger container + item for orchestrated list reveals. */
export const StaggerGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
}> = ({ children, className, stagger = 0.12, once = true }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={{ show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: 26 },
      show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
    }}
  >
    {children}
  </motion.div>
);

/**
 * Magnetic / Tilt — intentionally disabled. Cursor-following buttons and
 * 3D-tilting cards read as AI-generated and distract from content. We keep
 * the exports as no-ops so existing call-sites don't break.
 */
export const Magnetic: React.FC<{ children: React.ReactNode; className?: string; strength?: number }> = ({ children, className }) => (
  <div className={className}>{children}</div>
);
export const TiltCard: React.FC<{ children: React.ReactNode; className?: string; max?: number }> = ({ children, className }) => (
  <div className={className}>{children}</div>
);

/** AnimatedHeadline — simplified fade-in. */
export const AnimatedHeadline: React.FC<{
  text: string; className?: string; highlight?: string; as?: 'h1' | 'h2' | 'h3'; delay?: number;
}> = ({ text, className = '', as = 'h1', delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {as === 'h1' && <h1 className={className}>{text}</h1>}
      {as === 'h2' && <h2 className={className}>{text}</h2>}
      {as === 'h3' && <h3 className={className}>{text}</h3>}
    </motion.div>
  );
};

/** Counter — animates a number up when scrolled into view. */
export const Counter: React.FC<{
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}> = ({ to, suffix = '', prefix = '', duration = 1.8, className }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * to));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{value}{suffix}
    </span>
  );
};

/** Parallax — translates a child based on scroll progress. */
export const useParallax = (value: MotionValue<number>, distance: number) =>
  useTransform(value, [0, 1], [-distance, distance]);

export const Parallax: React.FC<{
  children: React.ReactNode;
  className?: string;
  distance?: number;
}> = ({ children, className, distance = 60 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useParallax(scrollYProgress, distance);
  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
};

export { motion };
