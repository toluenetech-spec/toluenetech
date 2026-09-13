import React from 'react';
import { PageHero } from '../components/Sections';
import { Reveal, StaggerGroup, StaggerItem } from '../components/motion';
import { CTASection } from '../components/Sections';
import {
  Search, Lightbulb, PenTool, Code, PlugZap, Bug, Rocket, Headphones,
} from 'lucide-react';

const STEPS = [
  { icon: Search,    title: '01 · Discover', desc: 'We dig into your business, users, goals and constraints. No assumptions, no templates.' },
  { icon: Lightbulb, title: '02 · Strategy', desc: 'Define scope, architecture, stack, KPIs and a realistic roadmap before writing a line of code.' },
  { icon: PenTool,   title: '03 · Design',   desc: 'Wireframes, design systems and polished visual UI — reviewed with you at every stage.' },
  { icon: Code,      title: '04 · Build',    desc: 'We ship in small, visible increments so you see progress weekly, not in one big reveal.' },
  { icon: PlugZap,   title: '05 · Integrate', desc: 'Connect third-party tools, APIs, AI providers, payments and internal systems.' },
  { icon: Bug,       title: '06 · Test',     desc: 'Cross-device QA, accessibility checks and performance budgets before launch.' },
  { icon: Rocket,    title: '07 · Launch',   desc: 'We handle deployment, DNS, monitoring and a smooth go-live.' },
  { icon: Headphones,title: '08 · Support', desc: 'Post-launch care, iteration and continuous improvement so your product keeps improving.' },
];

const Process: React.FC = () => (
  <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
    <PageHero
      eyebrow="Process"
      title="A process designed to remove surprises."
      subtitle="Eight clear stages from first conversation to launch and beyond — with transparent communication at every step."
    />
    <StaggerGroup className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {STEPS.map(s => {
        const Icon = s.icon;
        return (
          <StaggerItem key={s.title}>
            <div className="tt-glass tt-glow-border h-full rounded-2xl p-7 transition-all hover:-translate-y-1">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-brand-400/5 ring-1 ring-brand-400/20">
                <Icon className="h-6 w-6 text-brand-500" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.desc}</p>
            </div>
          </StaggerItem>
        );
      })}
    </StaggerGroup>

    <div className="mt-20"><CTASection /></div>
  </div>
);

export default Process;
