import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { SERVICES } from '../constants';
import { SectionHeading, ServiceCard } from '../components/UI';
import { GlowButton, Pill } from '../components/Premium';
import { Reveal, StaggerGroup, StaggerItem } from '../components/motion';
import { useProjects } from '../context/ProjectContext';

const Services: React.FC = () => {
  const { socialLinks } = useProjects();
  const whatsappMsg = encodeURIComponent("Hello Toluene Tech, I'd like to discuss a project.");
  const whatsappLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappMsg}`;

  return (
    <div className="pt-12 pb-24 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Pill className="mb-6">Full-Service Digital Studio</Pill>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">Our Services</h1>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              Comprehensive digital solutions for modern businesses — from websites and apps
              to brand design, video production, and AI integration &amp; automation.
            </p>
          </div>
        </Reveal>

        <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {SERVICES.map((service) => (
            <StaggerItem key={service.id}>
              <ServiceCard service={service} />
            </StaggerItem>
          ))}
        </StaggerGroup>

        {/* AI service spotlight */}
        <Reveal delay={0.1}>
          <div className="tt-glass tt-glow-border mt-20 rounded-3xl p-10 md:p-14">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <Pill className="mb-5">AI Integration &amp; Automation</Pill>
                <h2 className="font-display text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">
                  Add intelligence to your products &amp; workflows
                </h2>
                <p className="mt-5 text-slate-600 dark:text-slate-300">
                  We help businesses integrate AI practically — from chatbots and intelligent assistants
                  to LLM-powered features, AI APIs, RAG systems, and end-to-end workflow automation.
                </p>
                <ul className="mt-6 grid grid-cols-1 gap-2.5 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  {[
                    'AI chatbots & support assistants',
                    'LLM / OpenAI & Gemini integrations',
                    'RAG & custom knowledge bases',
                    'AI-powered search & recommendations',
                    'Business workflow automation',
                    'AI forms, dashboards & agents',
                  ].map(cap => (
                    <li key={cap} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      {cap}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                  Pricing is project-based and depends on complexity, model/provider, API usage,
                  integrations, data requirements, and ongoing maintenance. We provide a custom quote
                  after a quick discovery call.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <GlowButton to="/contact?service=ai">
                    Request AI Consultation <ArrowRight className="h-4 w-4" />
                  </GlowButton>
                  <GlowButton href={whatsappLink} variant="ghost">
                    <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                  </GlowButton>
                </div>
              </div>
              <div className="tt-glass relative overflow-hidden rounded-2xl p-8">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/20 blur-3xl" />
                <div className="space-y-3 font-mono text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  <div><span className="text-brand-500">// AI workflow we ship</span></div>
                  <div>const assistant = ai.create(&#123;</div>
                  <div className="pl-4">model: 'production-llm',</div>
                  <div className="pl-4">knowledge: yourDocs,</div>
                  <div className="pl-4">tools: [search, crm, email],</div>
                  <div className="pl-4">guardrails: 'enterprise-safe',</div>
                  <div>&#125;);</div>
                  <div>&nbsp;</div>
                  <div>assistant.deploy() <span className="text-brand-500">// 24/7</span></div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal delay={0.15}>
          <div className="mt-20 bg-white dark:bg-slate-900 p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
            <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Not sure what you need?</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              Every business is different. Tell us about your goals and we'll recommend the right
              mix of services — whether it's a website, app, brand refresh, AI automation, or
              something completely custom.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-slate-900 dark:bg-brand-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-brand-500 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 transform"
              >
                Start a Project <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-600 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 transform"
              >
                <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

export default Services;
