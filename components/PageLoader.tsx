import React from 'react';
import { motion } from 'framer-motion';

const LoaderLogo: React.FC<{ className?: string }> = ({ className = 'h-16 w-auto' }) => (
  <svg viewBox="0 0 120 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="loadgrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4f9bff" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="40" height="12" fill="url(#loadgrad)" />
    <rect x="24" y="22" width="12" height="48" fill="url(#loadgrad)" />
    <rect x="55" y="10" width="40" height="12" fill="url(#loadgrad)" />
    <rect x="69" y="22" width="12" height="30" fill="url(#loadgrad)" />
    <path d="M75 52 L 75 58 L 95 72" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="95" cy="72" r="5" fill="#22d3ee" />
  </svg>
);

const PageLoader: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-ink-950"
    >
      <div className="relative">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <LoaderLogo className="h-20 w-auto" />
        </motion.div>
        <div className="absolute -inset-8 rounded-full border-4 border-transparent border-t-brand-500 border-b-cyan-400 animate-spin" />
      </div>
      <p className="mt-8 animate-pulse text-sm font-bold tracking-[0.4em] text-slate-400">LOADING</p>
    </motion.div>
  );
};

export default PageLoader;
