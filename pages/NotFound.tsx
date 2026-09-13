import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Briefcase, Rocket } from 'lucide-react';
import { GlowButton } from '../components/Premium';

const NotFound: React.FC = () => (
  <div className="flex min-h-[70vh] items-center justify-center px-4">
    <div className="text-center">
      <p className="font-display text-8xl font-bold tt-gradient-text md:text-9xl">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white md:text-3xl">Page not found</h1>
      <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <GlowButton to="/"><Home className="h-4 w-4" /> Back to Home</GlowButton>
        <GlowButton to="/portfolio" variant="ghost"><Briefcase className="h-4 w-4" /> See Our Work</GlowButton>
        <GlowButton to="/start-project" variant="ghost"><Rocket className="h-4 w-4" /> Start a Project</GlowButton>
      </div>
    </div>
  </div>
);

export default NotFound;
