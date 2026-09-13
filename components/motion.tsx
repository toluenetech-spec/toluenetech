import React, { useRef, useState, useEffect } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
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

/** AnimatedHeadline — reveals a headline word-by-word. */
export const AnimatedHeadline: React.FC<{
  text: string;
  className?: string;
  highlight?: string;
  as?: 'h1' | 'h2' | 'h3';
  delay?: number;
}> = ({ text, className = '', highlight, as = 'h1', delay = 0 }) => {
  const words = text.split(' ');
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: delay } } }}
    >
      {words.map((word, i) => {
        const isHighlight = highlight && word.replace(/[.,]/g, '') === highlight;
        return (
          <span key={i} className="inline-block overflow-hidden align-bottom">
            <motion.span
              className={`inline-block ${isHighlight ? 'tt-gradient-text' : ''}`}
              variants={{
                hidden: { y: '110%', opacity: 0 },
                show: { y: '0%', opacity: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
              }}
            >
              {word}&nbsp;
            </motion.span>
          </span>
        );
      })}
    </MotionTag>
  );
};

/** MagneticButton — content is pulled toward the cursor on hover. */
export const Magnetic: React.FC<{
  children: React.ReactNode;
  className?: string;
  strength?: number;
}> = ({ children, className, strength = 0.35 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 18, mass: 0.4 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    x.set(relX * strength);
    y.set(relY * strength);
  };

  const reset = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/** TiltCard — 3D perspective tilt that follows the pointer. */
export const TiltCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  max?: number;
}> = ({ children, className, max = 10 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sry = useSpring(ry, { stiffness: 200, damping: 20 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * max * 2);
    rx.set(-py * max * 2);
  };

  const reset = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ rotateX: srx, rotateY: sry, transformStyle: 'preserve-3d', transformPerspective: 900 }}
      className={className}
    >
      {children}
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
