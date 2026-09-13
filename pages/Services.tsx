import React from 'react';
import { SERVICES } from '../constants';
import { SectionHeading, ServiceCard } from '../components/UI';

const Services: React.FC = () => {
  return (
    <div className="pt-12 pb-24 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">Our Services</h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Comprehensive digital solutions tailored for modern businesses. 
            We focus on frontend technologies and high-fidelity design.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((service, idx) => (
            <div key={service.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
              <ServiceCard service={service} />
            </div>
          ))}
        </div>

        <div className="mt-20 bg-white dark:bg-slate-800 p-10 rounded-2xl border border-slate-200 dark:border-slate-700 text-center shadow-sm animate-fade-in-up">
            <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Need something custom?</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
                We understand that every business is unique. If you don't see exactly what you're looking for, let's chat. 
                (Note: We do not offer mobile app development at this time).
            </p>
            <a href="/contact" className="inline-block bg-slate-900 dark:bg-brand-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 dark:hover:bg-brand-500 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 transform">
                Contact Us
            </a>
        </div>
      </div>
    </div>
  );
};

export default Services;
