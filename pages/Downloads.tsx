import React, { useState } from 'react';
import { FileText, Download, Briefcase, AlertTriangle, MessageCircle, X } from 'lucide-react';
import { SectionHeading } from '../components/UI';
import { useProjects } from '../context/ProjectContext';

const Downloads: React.FC = () => {
  const { brandProfileData, portfolioHighlightData, pricingGuideData, socialLinks } = useProjects();
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [missingFileName, setMissingFileName] = useState("");

  const documents = [
    {
      title: 'Brand CV',
      description: 'A complete overview of Toluene Tech, our services, and value proposition.',
      size: brandProfileData ? 'Updated' : '2.4 MB',
      type: 'PDF',
      icon: Briefcase,
      highlight: true,
      downloadUrl: brandProfileData || '#' 
    },
    {
      title: 'Portfolio Highlights',
      description: 'Curated selection of our best work in web design and motion graphics.',
      size: portfolioHighlightData ? 'Updated' : '12.8 MB',
      type: 'PDF',
      icon: FileText,
      highlight: false,
      downloadUrl: portfolioHighlightData || '#'
    },
    {
      title: 'Service Pricing Guide',
      description: 'Transparent base pricing for our standard packages.',
      size: pricingGuideData ? 'Updated' : '1.1 MB',
      type: 'PDF',
      icon: FileText,
      highlight: false,
      downloadUrl: pricingGuideData || '#'
    }
  ];

  const handleDownload = (url: string, title: string) => {
    if (url === '#') {
        setMissingFileName(title);
        setErrorModalOpen(true);
        return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const whatsappErrorMsg = encodeURIComponent(`Hello, I was trying to download the ${missingFileName} from your site but it wasn't available. Could you please send it to me?`);
  const whatsappErrorLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappErrorMsg}`;

  return (
    <div className="pt-12 pb-24 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        
        {/* Error / Contact Admin Modal */}
        {errorModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full p-6 text-center relative border-t-4 border-yellow-500">
                    <button 
                        onClick={() => setErrorModalOpen(false)} 
                        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">File Not Available</h3>
                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-6">
                        The <strong>{missingFileName}</strong> has not been uploaded yet. Please contact the administrator to request it directly.
                    </p>
                    <div className="flex flex-col gap-3">
                        <a 
                            href={whatsappErrorLink} 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 flex items-center justify-center gap-2 shadow-lg"
                        >
                            <MessageCircle className="h-5 w-5" /> Contact via WhatsApp
                        </a>
                        <button 
                            onClick={() => setErrorModalOpen(false)} 
                            className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Downloads" subtitle="Resources" />
        
        <div className="grid gap-6">
          {documents.map((doc, idx) => (
            <div 
              key={idx} 
              className={`p-6 rounded-xl shadow-sm border flex flex-col sm:flex-row items-center gap-6 transition-all duration-300 hover:shadow-lg animate-fade-in-up
                ${doc.highlight 
                  ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700 ring-1 ring-brand-100 dark:ring-brand-800' 
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${doc.highlight ? 'bg-brand-100 dark:bg-brand-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <doc.icon className={`h-8 w-8 ${doc.highlight ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'}`} />
              </div>
              <div className="flex-grow text-center sm:text-left">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{doc.title} {doc.highlight && <span className="ml-2 inline-block bg-brand-600 text-white text-[10px] uppercase px-2 py-0.5 rounded-full align-middle">Recommended</span>}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{doc.description}</p>
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold">{doc.type} • {doc.size}</span>
              </div>
              <button 
                 onClick={() => handleDownload(doc.downloadUrl, doc.title)}
                 className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors shrink-0 shadow-sm
                 ${doc.highlight 
                    ? 'bg-brand-600 hover:bg-brand-700 text-white' 
                    : 'bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white'
                 }`}>
                <Download className="h-4 w-4" /> Download
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-12 text-center text-slate-500 dark:text-slate-400 text-sm animate-fade-in">
          <p>Need specific case studies? <a href="/contact" className="text-brand-600 dark:text-brand-400 hover:underline">Contact us</a> directly.</p>
        </div>
      </div>
    </div>
  );
};

export default Downloads;
