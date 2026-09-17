import React, { useState } from 'react';
import { SectionHeading } from '../components/UI';
import { CheckCircle2, Users, Target, Rocket, User } from 'lucide-react';
import { useData } from '../context/DataContext';

const About: React.FC = () => {
  const { founderImageData, founderNote } = useData();
  const [imgError, setImgError] = useState(false);

  // Use the uploaded data if available, otherwise try the local default file, otherwise fallback to placeholder
  const displayImage = founderImageData || '/founder.jpg';

  return (
    <div className="pt-12 pb-24 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20 text-center animate-fade-in-up">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">About Toluene Tech</h1>
        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
          We are not just designers or developers. We are strategic partners helping ambitious companies build
          scalable websites, apps, brand systems, and AI-powered digital products.
        </p>
      </div>

      {/* Mission/Vision */}
      <div className="bg-slate-50 dark:bg-slate-900 py-20 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <Target className="h-10 w-10 text-brand-600 dark:text-brand-400 mb-4" />
            <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Our Mission</h3>
            <p className="text-slate-600 dark:text-slate-300">To bridge the gap between beautiful design and rigorous engineering — delivering websites, apps, and AI-powered products that perform as good as they look.</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <Rocket className="h-10 w-10 text-brand-600 dark:text-brand-400 mb-4" />
            <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Our Vision</h3>
            <p className="text-slate-600 dark:text-slate-300">To be the go-to technical partner for businesses that value precision, speed, and modern standards across web, mobile, and AI.</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Users className="h-10 w-10 text-brand-600 dark:text-brand-400 mb-4" />
            <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Our Values</h3>
            <p className="text-slate-600 dark:text-slate-300">Transparency in process, excellence in code, and user-centricity in design. We don't cut corners.</p>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <SectionHeading title="Our Workflow" subtitle="How We Deliver" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-12 relative">
          <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10"></div>
          {[
            { step: '01', title: 'Discovery', desc: 'Requirements, goals & technical strategy — including AI/automation fit.' },
            { step: '02', title: 'Design', desc: 'Wireframes, prototypes & polished visual systems.' },
            { step: '03', title: 'Build', desc: 'Web, app, and AI development — clean code, tested integrations.' },
            { step: '04', title: 'Launch', desc: 'QA, deployment, training and handover.' },
            { step: '05', title: 'Support', desc: 'Ongoing improvements, monitoring & iteration.' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-100 dark:border-slate-700 text-center animate-fade-in-up" style={{ animationDelay: `${idx * 0.15}s` }}>
              <div className="w-12 h-12 bg-brand-600 dark:bg-brand-500 text-white rounded-full flex items-center justify-center font-bold text-lg mx-auto mb-4 border-4 border-white dark:border-slate-800 shadow-sm">
                {item.step}
              </div>
              <h4 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">{item.title}</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team/Founder Note */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-10 md:p-16 flex flex-col md:flex-row gap-10 items-center animate-fade-in shadow-xl">
        <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-700 rounded-full flex-shrink-0 overflow-hidden border-4 border-brand-500 shadow-lg relative group">
             {!imgError ? (
                 <img 
                    src={displayImage} 
                    alt="Founder" 
                    className="w-full h-full object-cover" 
                    onError={() => setImgError(true)}
                 />
             ) : (
                 <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 text-xs text-center p-2">
                     <User className="h-8 w-8 mb-1" />
                     <span>No Image</span>
                 </div>
             )}
        </div>
        <div>
            <h3 className="text-2xl font-bold mb-4">{founderNote.heading}</h3>
            <p className="text-slate-300 italic mb-6 text-lg leading-relaxed">
                "{founderNote.message}"
            </p>
            <div>
                <span className="block font-bold text-white text-lg">{founderNote.name}</span>
                <span className="text-sm text-brand-400 font-medium tracking-wide uppercase">{founderNote.role}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default About;
