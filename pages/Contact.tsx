import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageCircle, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';
import { SectionHeading } from '../components/UI';
import { useProjects } from '../context/ProjectContext';

const Contact: React.FC = () => {
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const { socialLinks } = useProjects();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission
    setTimeout(() => {
      setSubmitted(true);
      setFormState({ name: '', email: '', message: '' });
    }, 1000);
  };

  const whatsappMsg = encodeURIComponent("Hello Toluene Tech, I would like to discuss a potential project.");
  const whatsappLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappMsg}`;
  
  const emailLink = `mailto:${socialLinks.email}`;

  return (
    <div className="pt-12 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Get In Touch" subtitle="Start A Project" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Info */}
          <div className="space-y-8 animate-fade-in-up">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Let's build something great together.</h3>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              Whether you need a complete website overhaul, a new React frontend, or a motion graphics package, our team is ready to help.
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
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Mon-Fri from 9am to 6pm EST</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm"><MapPin className="h-6 w-6 text-brand-600 dark:text-brand-400" /></div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Office</h4>
                  <p className="text-slate-600 dark:text-slate-300">123 Tech District, Suite 400<br/>San Francisco, CA 94105</p>
                </div>
              </div>

              {/* Follow Us Section */}
              <div className="pt-6">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-3">Follow Us</h4>
                  <div className="flex gap-4">
                    {socialLinks.facebook && (
                        <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md">
                            <Facebook className="h-5 w-5" />
                        </a>
                    )}
                    {socialLinks.twitter && (
                        <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md">
                            <Twitter className="h-5 w-5" />
                        </a>
                    )}
                    {socialLinks.instagram && (
                        <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md">
                            <Instagram className="h-5 w-5" />
                        </a>
                    )}
                    {socialLinks.linkedin && (
                        <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-all hover:-translate-y-1 hover:shadow-md">
                            <Linkedin className="h-5 w-5" />
                        </a>
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
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formState.name}
                    onChange={e => setFormState({...formState, name: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Email</label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formState.email}
                    onChange={e => setFormState({...formState, email: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    placeholder="john@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project Details</label>
                  <textarea
                    id="message"
                    required
                    rows={4}
                    value={formState.message}
                    onChange={e => setFormState({...formState, message: e.target.value})}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    placeholder="Tell us about your project goals..."
                  ></textarea>
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 dark:bg-brand-600 text-white font-bold py-3 rounded-lg hover:bg-slate-800 dark:hover:bg-brand-500 transition-all shadow-lg hover:-translate-y-1 transform"
                >
                  Send Message
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
