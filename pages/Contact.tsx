import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, MessageCircle, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { SectionHeading } from '../components/UI';
import { useData } from '../context/DataContext';
import { SERVICE_OPTIONS, ServiceOption } from '../types';

const AI_FOLLOW_UPS: { key: string; label: string; placeholder?: string }[] = [
  { key: 'goal', label: 'What would you like the AI system to do?', placeholder: 'e.g. answer customer questions, automate onboarding…' },
  { key: 'problem', label: 'What problem are you trying to solve?' },
  { key: 'existing', label: 'Do you already have an existing website or app?' },
  { key: 'chatbot', label: 'Do you need chatbot / support assistant integration?' },
  { key: 'automation', label: 'Do you need workflow automation?' },
  { key: 'api', label: 'Do you need AI API integration (e.g. OpenAI, Gemini)?' },
  { key: 'provider', label: 'Preferred AI provider (if any)?' },
  { key: 'platforms', label: 'What platforms / tools are you currently using?' },
];

const Contact: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialService = (searchParams.get('service') as ServiceOption) || '';

  const { socialLinks } = useData();
  const [submitted, setSubmitted] = useState(false);

  const [formState, setFormState] = useState({
    name: '',
    email: '',
    service: initialService as ServiceOption | '',
    budget: '',
    message: '',
    // AI-specific
    aiGoal: '',
    aiProblem: '',
    aiExisting: '',
    aiChatbot: '',
    aiAutomation: '',
    aiApi: '',
    aiProvider: '',
    aiPlatforms: '',
  });

  useEffect(() => {
    if (initialService) {
      setFormState(prev => ({ ...prev, service: initialService }));
    }
  }, [initialService]);

  const isAISelected = formState.service === 'AI Integration & Automation';

  const whatsappMsg = useMemo(() => {
    const base = "Hello Toluene Tech, I would like to discuss a potential project.";
    if (formState.service) {
      return encodeURIComponent(`${base} (Service: ${formState.service})`);
    }
    return encodeURIComponent(base);
  }, [formState.service]);

  const whatsappLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappMsg}`;
  const emailLink = `mailto:${socialLinks.email}`;

  const update = (key: keyof typeof formState, value: string) =>
    setFormState(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission. A real backend integration would go here.
    setTimeout(() => {
      setSubmitted(true);
      setFormState({
        name: '',
        email: '',
        service: '',
        budget: '',
        message: '',
        aiGoal: '',
        aiProblem: '',
        aiExisting: '',
        aiChatbot: '',
        aiAutomation: '',
        aiApi: '',
        aiProvider: '',
        aiPlatforms: '',
      });
    }, 800);
  };

  const inputCls =
    'w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all';
  const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div className="pt-12 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Get In Touch" subtitle="Start A Project" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Info */}
          <div className="space-y-8 animate-fade-in-up">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Let's build something great together.</h3>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              Whether you need a website, an app, brand design, video production, or an AI-powered
              solution, our team is ready to help.
            </p>

            <div className="space-y-6 mt-8">
              <div className="flex items-start gap-4">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm"><Mail className="h-6 w-6 text-brand-600 dark:text-brand-400" /></div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Email Us</h4>
                  <a href={emailLink} className="text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">{socialLinks.email}</a>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Response within 2 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm"><Phone className="h-6 w-6 text-brand-600 dark:text-brand-400" /></div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Call / WhatsApp</h4>
                  <a href={whatsappLink} target="_blank" rel="noreferrer" className="text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">+{socialLinks.whatsapp}</a>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Mon–Fri from 9am to 6pm WAT</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm"><MessageCircle className="h-6 w-6 text-brand-600 dark:text-brand-400" /></div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Quick Chat</h4>
                  <p className="text-slate-600 dark:text-slate-300">Prefer real-time? Message us on WhatsApp for the fastest response.</p>
                </div>
              </div>

              {/* Follow Us */}
              <div className="pt-6">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-3">Follow Us</h4>
                  <div className="flex gap-4">
                    {socialLinks.facebook && (
                        <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md"><Facebook className="h-5 w-5" /></a>
                    )}
                    {socialLinks.twitter && (
                        <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md"><Twitter className="h-5 w-5" /></a>
                    )}
                    {socialLinks.instagram && (
                        <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md"><Instagram className="h-5 w-5" /></a>
                    )}
                    {socialLinks.linkedin && (
                        <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md"><Linkedin className="h-5 w-5" /></a>
                    )}
                  </div>
              </div>

              <div className="pt-2">
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-600 transition-all shadow-md hover:-translate-y-1">
                  <MessageCircle className="h-5 w-5" /> Quick Chat on WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 animate-fade-in">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                  <Send className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Message Sent!</h3>
                <p className="text-slate-600 dark:text-slate-300">Thank you for reaching out. We'll be in touch shortly.</p>
                <button onClick={() => setSubmitted(false)} className="mt-6 text-brand-600 dark:text-brand-400 font-bold hover:underline">Send another message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className={labelCls}>Full Name *</label>
                  <input
                    type="text" id="name" required
                    value={formState.name}
                    onChange={e => update('name', e.target.value)}
                    className={inputCls}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="email" className={labelCls}>Business Email *</label>
                  <input
                    type="email" id="email" required
                    value={formState.email}
                    onChange={e => update('email', e.target.value)}
                    className={inputCls}
                    placeholder="john@company.com"
                  />
                </div>

                <div>
                  <label htmlFor="service" className={labelCls}>What service are you interested in?</label>
                  <select
                    id="service"
                    value={formState.service}
                    onChange={e => update('service', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Select a service —</option>
                    {SERVICE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {/* AI-specific follow-ups (progressive disclosure) */}
                {isAISelected && (
                  <div className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-800/60 dark:bg-brand-900/10">
                    <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
                      A few quick questions so we can prepare the best proposal:
                    </p>
                    <div>
                      <label className={labelCls}>{AI_FOLLOW_UPS[0].label}</label>
                      <input
                        type="text"
                        value={formState.aiGoal}
                        onChange={e => update('aiGoal', e.target.value)}
                        className={inputCls}
                        placeholder={AI_FOLLOW_UPS[0].placeholder}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>{AI_FOLLOW_UPS[1].label}</label>
                      <textarea rows={2} value={formState.aiProblem} onChange={e => update('aiProblem', e.target.value)} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {[
                        { key: 'aiExisting', label: AI_FOLLOW_UPS[2].label },
                        { key: 'aiProvider', label: AI_FOLLOW_UPS[6].label },
                      ].map(f => (
                        <div key={f.key}>
                          <label className={labelCls}>{f.label}</label>
                          <input
                            type="text"
                            value={(formState as any)[f.key]}
                            onChange={e => update(f.key as keyof typeof formState, e.target.value)}
                            className={inputCls}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[
                        { key: 'aiChatbot', label: 'Chatbot' },
                        { key: 'aiAutomation', label: 'Automation' },
                        { key: 'aiApi', label: 'AI API' },
                      ].map(f => (
                        <label key={f.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={(formState as any)[f.key] === 'yes'}
                            onChange={e => update(f.key as keyof typeof formState, e.target.checked ? 'yes' : '')}
                            className="h-4 w-4"
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                    <div>
                      <label className={labelCls}>{AI_FOLLOW_UPS[7].label}</label>
                      <input
                        type="text"
                        value={formState.aiPlatforms}
                        onChange={e => update('aiPlatforms', e.target.value)}
                        className={inputCls}
                        placeholder="e.g. WordPress, HubSpot, Shopify, internal CRM…"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="message" className={labelCls}>Project Details *</label>
                  <textarea
                    id="message" required rows={5}
                    value={formState.message}
                    onChange={e => update('message', e.target.value)}
                    className={inputCls}
                    placeholder={isAISelected
                      ? 'Tell us about timelines, success criteria, and anything else we should know…'
                      : 'Tell us about your project goals…'}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-900 dark:bg-brand-600 text-white font-bold py-3 rounded-lg hover:bg-slate-800 dark:hover:bg-brand-500 transition-all shadow-lg hover:-translate-y-1 transform"
                >
                  Send Message
                </button>

                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  By submitting, you agree to be contacted about your enquiry. We never share your details.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
