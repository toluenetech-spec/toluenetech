import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Project, MediaItem, SocialLinks, FounderNote, SiteNotification,
  Service, Solution, Product, LabItem, Testimonial, FAQ, Insight,
  Lead, Client, ClientProject, Milestone, ProjectFile, ProjectMessage,
  SiteSettings, Tool,
} from '../types';
import { Globe, Layout, PenTool, Video, Code, Layers, Smartphone, BrainCircuit } from 'lucide-react';

// Default services (used as seed when Firestore has none and as type-shape baseline)
const DEFAULT_SERVICES: Service[] = [
  { id: 'svc-web-design', slug: 'web-design', title: 'Web Design', shortTitle: 'Web Design', description: 'Premium websites and landing pages that blend beautiful design with fast, SEO-ready engineering.', icon: Globe, includes: ['Responsive Design','CMS Integration','SEO Optimization','Performance Tuning'], capabilities: ['Responsive design','CMS integration','SEO optimization','Performance tuning','Conversion-focused layouts','Analytics setup'], process: ['Discovery & sitemap','Wireframes','Visual design','Development','QA','Launch'], tech: ['React','Next.js','TypeScript','Tailwind','Figma'], useCases: ['Corporate websites','Marketing landing pages','Portfolio sites','SaaS marketing sites'], isPublished: true, isFeatured: true, order: 1, benefit: 'Establish a credible digital presence that converts visitors into customers.' },
  { id: 'svc-frontend', slug: 'frontend-development', title: 'Frontend Development', shortTitle: 'Frontend', description: 'Scalable, high-performance frontend architecture built on React and modern web standards.', icon: Code, includes: ['React / Next.js','State Management','API Integration','Component Systems'], capabilities: ['React / Next.js apps','State management','API integration','Design systems','Accessibility','Performance audits'], tech: ['React','Next.js','TypeScript','Redux','Tailwind'], useCases: ['Dashboards','SaaS frontends','Complex marketing sites','Web applications'], isPublished: true, isFeatured: true, order: 2, benefit: 'Keep your application fast, interactive, and easy to scale.' },
  { id: 'svc-uiux', slug: 'ui-ux-design', title: 'UI/UX Design', shortTitle: 'UI/UX', description: 'User-centric interfaces designed for clarity, usability, and measurable outcomes.', icon: Layout, includes: ['Wireframing','Prototyping','User Research','Design Systems'], capabilities: ['Wireframing','Prototyping','User research','Design systems','Usability audits','Accessibility reviews'], tech: ['Figma','Adobe XD','Protopie'], useCases: ['SaaS dashboards','Mobile apps','Product redesigns','Marketing sites'], isPublished: true, isFeatured: true, order: 3, benefit: 'Reduce friction for your users and drive higher adoption.' },
  { id: 'svc-app-design', slug: 'app-design', title: 'App Design', shortTitle: 'App Design', description: 'Beautiful, intuitive mobile and web app interfaces that feel native on every device.', icon: PenTool, includes: ['iOS & Android UI','User Flows','Interactive Prototypes','Design Handoff'], capabilities: ['iOS & Android UI','User flows','Interactive prototypes','Design handoff'], tech: ['Figma','Figma Dev Mode','Protopie'], useCases: ['Consumer apps','B2B tools','Fintech apps','Health apps'], isPublished: true, isFeatured: false, order: 4, benefit: 'Deliver app experiences users love.' },
  { id: 'svc-app-dev', slug: 'app-development', title: 'App Development', shortTitle: 'Apps', description: 'Cross-platform and web applications engineered for speed and stability.', icon: Smartphone, includes: ['React-based Apps','API & Backend Integration','Offline Support','App Store Prep'], capabilities: ['React-based apps','API & backend integration','Offline support','App store prep','Push notifications'], tech: ['React Native','Expo','TypeScript','Firebase'], useCases: ['Consumer apps','Internal tools','MVPs','Companion apps'], isPublished: true, isFeatured: false, order: 5, benefit: 'Turn your app idea into a polished product ready to ship.' },
  { id: 'svc-graphic', slug: 'graphic-design', title: 'Graphic Design', shortTitle: 'Graphic', description: 'Visual identity and digital design assets that tell your brand story consistently.', icon: Layers, includes: ['Branding & Logos','Iconography','Marketing Assets','Digital Brochures'], capabilities: ['Branding & logos','Iconography','Marketing assets','Digital brochures','Social media kits'], tech: ['Illustrator','Photoshop','Figma'], useCases: ['Brand identity','Launch campaigns','Sales collateral'], isPublished: true, isFeatured: false, order: 6, benefit: 'Build a cohesive brand image across every channel.' },
  { id: 'svc-video', slug: 'video-editing', title: 'Video Editing', shortTitle: 'Video', description: 'Engaging motion graphics and polished video editing for brands that want to stand out.', icon: Video, includes: ['Explainer Videos','Logo Reveals','Social Media Shorts','Lottie Animations'], capabilities: ['Explainer videos','Logo reveals','Social media shorts','Lottie animations','Product demos'], tech: ['After Effects','Premiere Pro','Illustrator'], useCases: ['Product launches','Social content','Brand videos'], isPublished: true, isFeatured: false, order: 7, benefit: 'Capture attention and explain complex ideas quickly.' },
  { id: 'svc-ai', slug: 'ai-integration', title: 'AI Integration & Automation', shortTitle: 'AI', description: 'Build smarter digital experiences by integrating AI into websites, applications and business workflows.', icon: BrainCircuit, includes: ['AI Chatbots & Assistants','LLM Integrations','Workflow Automation','AI APIs'], capabilities: ['AI chatbots & assistants','LLM / OpenAI & Gemini integrations','RAG & knowledge bases','AI search & recommendations','Business workflow automation','AI forms, dashboards & agents','AI document processing'], process: ['Discovery','Data & model planning','Integration','Guardrails & testing','Deploy','Monitor'], tech: ['OpenAI','Gemini','LangChain','Python','Node.js','Vector Databases'], useCases: ['Customer support bots','Internal knowledge assistants','Lead qualification','Document Q&A','Sales automation'], faqs: [{ q: 'How much does an AI integration cost?', a: 'Pricing depends on complexity, model provider, API usage, integrations and maintenance — custom quote after discovery.' },{ q: 'Do you train custom models?', a: 'We typically integrate foundation models with retrieval-augmented generation over your data rather than training models from scratch.' },{ q: 'Is our data safe?', a: 'We design AI integrations with data minimisation, guardrails and zero-retention API options where available.' }], isPublished: true, isFeatured: true, order: 8, benefit: 'Turn artificial intelligence into practical, revenue-driving digital solutions.' },
];

const DEFAULT_SOLUTIONS: Solution[] = [
  { id: 'sol-website', slug: 'business-website', title: 'Business Website', tagline: 'A premium online presence that converts.', description: 'Fast, SEO-ready marketing websites that establish credibility and turn visitors into customers.', icon: 'Globe', features: ['Responsive design','CMS','SEO','Analytics'], isPublished: true, order: 1 },
  { id: 'sol-ecommerce', slug: 'ecommerce', title: 'E-commerce Website', tagline: 'Sell products beautifully.', description: 'High-converting online stores with modern UX, secure checkout and stack integrations.', icon: 'ShoppingCart', features: ['Product catalog','Cart & checkout','Payments','Inventory'], isPublished: true, order: 2 },
  { id: 'sol-webapp', slug: 'web-application', title: 'Web Application', tagline: 'Custom software for your business.', description: 'Dashboards, SaaS tools and internal platforms engineered for speed and scale.', icon: 'Code', features: ['Auth','Roles','API integration','Admin panels'], isPublished: true, order: 3 },
  { id: 'sol-mobile', slug: 'mobile-application', title: 'Mobile Application', tagline: 'Native-feeling cross-platform apps.', description: 'iOS and Android apps built with React Native for startups and businesses.', icon: 'Smartphone', features: ['Cross-platform','Push','Offline','App store ready'], isPublished: true, order: 4 },
  { id: 'sol-portal', slug: 'customer-portal', title: 'Customer Portal', tagline: 'Self-service for your clients.', description: 'Secure portals where clients can track projects, files and messages.', icon: 'Shield', features: ['Auth','File sharing','Messages','Milestones'], isPublished: true, order: 5 },
  { id: 'sol-dashboard', slug: 'dashboard', title: 'Dashboard', tagline: 'Turn data into decisions.', description: 'Analytics and operations dashboards that surface the metrics that matter.', icon: 'BarChart3', features: ['Charts','Real-time','Role-based','Exports'], isPublished: true, order: 6 },
  { id: 'sol-booking', slug: 'booking-system', title: 'Booking System', tagline: 'Automate scheduling.', description: 'Booking and appointment systems with payments, reminders and calendars.', icon: 'Calendar', features: ['Calendar','Reminders','Payments','Timezones'], isPublished: true, order: 7 },
  { id: 'sol-school', slug: 'school-platform', title: 'School Platform', tagline: 'Digital learning made simple.', description: 'Learning management and school administration platforms.', icon: 'GraduationCap', features: ['Courses','Assignments','Grades','Messaging'], isPublished: true, order: 8 },
  { id: 'sol-ai-assistant', slug: 'ai-assistant', title: 'AI Customer Assistant', tagline: 'Support that never sleeps.', description: 'LLM-powered assistants that answer customer questions instantly and escalate when needed.', icon: 'Bot', features: ['Chatbot','RAG','Escalation','Analytics'], isPublished: true, order: 9 },
  { id: 'sol-ai-search', slug: 'ai-search', title: 'AI Search', tagline: 'Let users find anything.', description: 'Semantic search over your docs, products, or knowledge base.', icon: 'Search', features: ['Semantic search','RAG','Typo tolerant','Analytics'], isPublished: true, order: 10 },
  { id: 'sol-automation', slug: 'business-automation', title: 'Business Automation', tagline: 'Eliminate repetitive work.', description: 'Automate pipelines across CRM, email, internal tools and data entry.', icon: 'Workflow', features: ['Workflows','Integrations','Trigger logic','Monitoring'], isPublished: true, order: 11 },
  { id: 'sol-saas', slug: 'custom-saas', title: 'Custom SaaS', tagline: 'Launch your software product.', description: 'End-to-end SaaS product design, development and launch.', icon: 'Rocket', features: ['Multi-tenant','Billing','Auth','Admin'], isPublished: true, order: 12 },
  { id: 'sol-internal', slug: 'internal-tools', title: 'Internal Business Tools', tagline: 'Tools built around your team.', description: 'Custom internal dashboards, CRMs and automations.', icon: 'Briefcase', features: ['Role-based','Integrations','Automations','Reporting'], isPublished: true, order: 13 },
];

const DEFAULT_PRODUCTS: Product[] = [];
const DEFAULT_LABS: LabItem[] = [];
const DEFAULT_TESTIMONIALS: Testimonial[] = [];
const DEFAULT_INSIGHTS: Insight[] = [];
const DEFAULT_FAQS: FAQ[] = [
  { id: 'faq-1', question: 'Where is Toluene Tech based?', answer: 'We operate remotely, with our primary base in Lagos, Nigeria, and work with clients globally.', category: 'General', order: 1, isPublished: true },
  { id: 'faq-2', question: 'How long does a typical project take?', answer: 'Most marketing websites ship in 2–4 weeks. Web apps, mobile apps, and AI integrations typically take 6–12 weeks depending on scope.', category: 'Projects', order: 2, isPublished: true },
  { id: 'faq-3', question: 'Do you offer fixed-price or hourly pricing?', answer: 'We offer custom quotes after discovery. Well-scoped work can be fixed-price; ongoing development is typically hourly or retainer-based.', category: 'Pricing', order: 3, isPublished: true },
  { id: 'faq-4', question: 'Can you integrate AI into our existing website or app?', answer: 'Yes. AI integration is one of our core services.', category: 'AI', order: 4, isPublished: true },
  { id: 'faq-5', question: 'Do you provide ongoing support after launch?', answer: 'Yes — maintenance retainers and continuous improvement packages are available.', category: 'Support', order: 5, isPublished: true },
];
const DEFAULT_TOOLS: Tool[] = [
  { name: 'Figma', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg' },
  { name: 'Adobe XD', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/xd/xd-original.svg' },
  { name: 'Photoshop', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/photoshop/photoshop-original.svg' },
  { name: 'Illustrator', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/illustrator/illustrator-plain.svg' },
  { name: 'React', category: 'Frontend', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
  { name: 'TypeScript', category: 'Frontend', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg' },
  { name: 'Tailwind CSS', category: 'Frontend', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg' },
  { name: 'Next.js', category: 'Frontend', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg' },
  { name: 'Node.js', category: 'Backend', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg' },
  { name: 'Python', category: 'AI', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg' },
  { name: 'PostgreSQL', category: 'Database', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg' },
  { name: 'MongoDB', category: 'Database', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg' },
  { name: 'Firebase', category: 'Cloud', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg' },
  { name: 'React Native', category: 'Mobile', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
  { name: 'After Effects', category: 'Motion', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/aftereffects/aftereffects-original.svg' },
  { name: 'Premiere Pro', category: 'Motion', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/premierepro/premierepro-original.svg' },
];
const DEFAULT_SITE_SETTINGS: SiteSettings = {
  businessName: 'Toluene Tech',
  tagline: 'Digital Products • Design • Development • AI • Automation',
  availability: 'available',
  availabilityMessage: 'We are currently accepting new projects.',
  heroHeading: 'Design, develop & automate digital products',
  heroSubheading: 'Toluene Tech builds premium websites, applications, brand design, and AI integration & automation solutions for modern businesses.',
  heroCtaPrimary: 'Start a Project',
  heroCtaSecondary: 'Explore Our Work',
  defaultSeoTitle: 'Toluene Tech | Digital Products, Design, Development & AI',
  defaultSeoDescription: 'Toluene Tech builds premium websites, applications, brand design, and AI integration & automation solutions for modern businesses.',
};

import { db, storage } from '../firebase';
import {
  collection, getDocs, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Re-exported for backward compatibility with older imports
export type { FounderNote, SiteNotification } from '../types';

// ---------------- Types ----------------
interface DataContextType {
  // Loading
  isLoading: boolean;

  // Projects
  projects: Project[];
  addProject: (p: Project) => Promise<void>;
  updateProject: (id: string, p: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Project | undefined;
  getProjectBySlug: (slug: string) => Project | undefined;

  // Services
  services: Service[];
  addService: (s: Service) => Promise<void>;
  updateService: (id: string, s: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  getService: (slug: string) => Service | undefined;

  // Solutions
  solutions: Solution[];
  addSolution: (s: Solution) => Promise<void>;
  updateSolution: (id: string, s: Partial<Solution>) => Promise<void>;
  deleteSolution: (id: string) => Promise<void>;

  // Products
  products: Product[];
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (id: string, p: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Labs
  labs: LabItem[];
  addLab: (l: LabItem) => Promise<void>;
  updateLab: (id: string, l: Partial<LabItem>) => Promise<void>;
  deleteLab: (id: string) => Promise<void>;

  // Testimonials
  testimonials: Testimonial[];
  addTestimonial: (t: Testimonial) => Promise<void>;
  updateTestimonial: (id: string, t: Partial<Testimonial>) => Promise<void>;
  deleteTestimonial: (id: string) => Promise<void>;

  // FAQ
  faqs: FAQ[];
  addFaq: (f: FAQ) => Promise<void>;
  updateFaq: (id: string, f: Partial<FAQ>) => Promise<void>;
  deleteFaq: (id: string) => Promise<void>;

  // Insights
  insights: Insight[];
  addInsight: (i: Insight) => Promise<void>;
  updateInsight: (id: string, i: Partial<Insight>) => Promise<void>;
  deleteInsight: (id: string) => Promise<void>;

  // Leads / CRM
  leads: Lead[];
  addLead: (l: Omit<Lead, 'id' | 'createdAt' | 'reference'>) => Promise<Lead>;
  updateLead: (id: string, l: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;

  // Clients
  clients: Client[];
  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  updateClient: (id: string, c: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  verifyClientAccess: (email: string, code: string) => Client | null;

  // Client Projects
  clientProjects: ClientProject[];
  addClientProject: (cp: ClientProject) => Promise<void>;
  updateClientProject: (id: string, cp: Partial<ClientProject>) => Promise<void>;
  deleteClientProject: (id: string) => Promise<void>;

  // Milestones
  milestones: Milestone[];
  addMilestone: (m: Milestone) => Promise<void>;
  updateMilestone: (id: string, m: Partial<Milestone>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;

  // Files
  files: ProjectFile[];
  addFile: (f: Omit<ProjectFile, 'id' | 'uploadedAt' | 'url'> & { file?: File }) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;

  // Messages
  messages: ProjectMessage[];
  addMessage: (m: Omit<ProjectMessage, 'id' | 'createdAt'>) => Promise<void>;

  // Media
  mediaLibrary: MediaItem[];
  addToLibrary: (fileOrUrl: File | string, altText?: string) => Promise<string>;
  deleteFromLibrary: (id: string) => Promise<void>;

  // Tools (from defaults)
  tools: Tool[];

  // Brand assets (legacy)
  brandProfileData: string | null;
  updateBrandProfile: (f: File | string) => Promise<void>;
  portfolioHighlightData: string | null;
  updatePortfolioHighlight: (f: File | string) => Promise<void>;
  pricingGuideData: string | null;
  updatePricingGuide: (f: File | string) => Promise<void>;
  founderImageData: string | null;
  updateFounderImage: (f: File | string) => Promise<void>;

  // Site settings & misc
  founderNote: FounderNote;
  updateFounderNote: (n: FounderNote) => Promise<void>;
  siteNotification: SiteNotification;
  updateSiteNotification: (n: SiteNotification) => Promise<void>;
  socialLinks: SocialLinks;
  updateSocialLinks: (s: SocialLinks) => Promise<void>;
  siteSettings: SiteSettings;
  updateSiteSettings: (s: Partial<SiteSettings>) => Promise<void>;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

const INITIAL_NOTE: FounderNote = {
  heading: 'A Note from the Founder',
  message: 'We founded Toluene Tech because we saw a gap between design studios and engineering shops — and a growing gap between businesses and the AI tools transforming their industries. We are the synthesis: premium design, rigorous engineering, and practical AI integration.',
  name: 'Toluwalase O. Samuel',
  role: 'Lead Engineer & Founder',
};
const INITIAL_NOTIFICATION: SiteNotification = {
  message: 'We now offer AI Integration & Automation — let\'s build something intelligent.',
  isActive: false,
  link: '/services/ai-integration',
  linkText: 'Learn more',
};
const INITIAL_SOCIAL: SocialLinks = {
  facebook: 'https://www.facebook.com/share/1KBRGnTUs9/',
  twitter: 'https://x.com/TolueneTech',
  instagram: 'https://www.instagram.com/toluene_tech0',
  linkedin: '',
  whatsapp: '2347081329509',
  email: 'toluenetech@gmail.com',
};

function uid(prefix = '') {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [solutions, setSolutions] = useState<Solution[]>(DEFAULT_SOLUTIONS);
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [labs, setLabs] = useState<LabItem[]>(DEFAULT_LABS);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [faqs, setFaqs] = useState<FAQ[]>(DEFAULT_FAQS);
  const [insights, setInsights] = useState<Insight[]>(DEFAULT_INSIGHTS);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientProjects, setClientProjects] = useState<ClientProject[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [tools] = useState<Tool[]>(DEFAULT_TOOLS);

  const [brandProfileData, setBrandProfileData] = useState<string | null>(null);
  const [portfolioHighlightData, setPortfolioHighlightData] = useState<string | null>(null);
  const [pricingGuideData, setPricingGuideData] = useState<string | null>(null);
  const [founderImageData, setFounderImageData] = useState<string | null>(null);
  const [founderNote, setFounderNote] = useState<FounderNote>(INITIAL_NOTE);
  const [siteNotification, setSiteNotification] = useState<SiteNotification>(INITIAL_NOTIFICATION);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(INITIAL_SOCIAL);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  // -------- Generic Firestore helpers --------
  const loadCollection = async <T,>(name: string, fallback: T[]): Promise<T[]> => {
    try {
      const snap = await getDocs(collection(db, name));
      if (snap.empty) return fallback;
      return snap.docs.map(d => d.data() as T);
    } catch {
      return fallback;
    }
  };

  const saveDoc = async (coll: string, id: string, data: any) => {
    await setDoc(doc(db, coll, id), data);
  };
  const updateDocById = async (coll: string, id: string, data: any) => {
    await updateDoc(doc(db, coll, id), data);
  };
  const deleteDocById = async (coll: string, id: string) => {
    await deleteDoc(doc(db, coll, id));
  };

  const uploadToStorage = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    const snap = await uploadBytes(storageRef, file);
    return await getDownloadURL(snap.ref);
  };

  // -------- Initial fetch --------
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [
          projs, svcs, sols, prods, lab, tst, faqList, ins,
          leadList, clientList, cps, ms, fls, msgs, media,
        ] = await Promise.all([
          loadCollection<Project>('projects', []),
          loadCollection<Service>('services', DEFAULT_SERVICES),
          loadCollection<Solution>('solutions', DEFAULT_SOLUTIONS),
          loadCollection<Product>('products', DEFAULT_PRODUCTS),
          loadCollection<LabItem>('labs', DEFAULT_LABS),
          loadCollection<Testimonial>('testimonials', DEFAULT_TESTIMONIALS),
          loadCollection<FAQ>('faqs', DEFAULT_FAQS),
          loadCollection<Insight>('insights', DEFAULT_INSIGHTS),
          loadCollection<Lead>('leads', []),
          loadCollection<Client>('clients', []),
          loadCollection<ClientProject>('clientProjects', []),
          loadCollection<Milestone>('milestones', []),
          loadCollection<ProjectFile>('files', []),
          loadCollection<ProjectMessage>('messages', []),
          loadCollection<MediaItem>('media', []),
        ]);

        setProjects(projs);
        setServices(svcs.length ? svcs : DEFAULT_SERVICES);
        setSolutions(sols.length ? sols : DEFAULT_SOLUTIONS);
        setProducts(prods.length ? prods : DEFAULT_PRODUCTS);
        setLabs(lab.length ? lab : DEFAULT_LABS);
        setTestimonials(tst.length ? tst : DEFAULT_TESTIMONIALS);
        setFaqs(faqList.length ? faqList : DEFAULT_FAQS);
        setInsights(ins.length ? ins : DEFAULT_INSIGHTS);
        setLeads(leadList);
        setClients(clientList);
        setClientProjects(cps);
        setMilestones(ms);
        setFiles(fls);
        setMessages(msgs);
        setMediaLibrary(media);

        // Subscribe to settings
        const unsub = onSnapshot(doc(db, 'settings', 'global'), snap => {
          if (!snap.exists()) return;
          const d = snap.data() || {};
          if (d.founderNote) setFounderNote(d.founderNote);
          if (d.siteNotification) setSiteNotification(d.siteNotification);
          if (d.socialLinks) setSocialLinks(d.socialLinks);
          if (d.brandProfileData) setBrandProfileData(d.brandProfileData);
          if (d.portfolioHighlightData) setPortfolioHighlightData(d.portfolioHighlightData);
          if (d.pricingGuideData) setPricingGuideData(d.pricingGuideData);
          if (d.founderImageData) setFounderImageData(d.founderImageData);
          if (d.siteSettings) setSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...d.siteSettings });
        });
        return () => unsub();
      } catch (e) {
        console.error('Error loading data', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ---------- CRUD factories ----------
  const makeCrud = <T extends { id: string },>(
    collectionName: string,
    setState: React.Dispatch<React.SetStateAction<T[]>>,
  ) => ({
    add: async (item: T) => {
      setState(prev => [item, ...prev]);
      await saveDoc(collectionName, item.id, item);
    },
    update: async (id: string, patch: Partial<T>) => {
      setState(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
      await updateDocById(collectionName, id, patch);
    },
    remove: async (id: string) => {
      setState(prev => prev.filter(x => x.id !== id));
      await deleteDocById(collectionName, id);
    },
  });

  const projCrud = makeCrud<Project>('projects', setProjects);
  const svcCrud = makeCrud<Service>('services', setServices);
  const solCrud = makeCrud<Solution>('solutions', setSolutions);
  const prodCrud = makeCrud<Product>('products', setProducts);
  const labCrud = makeCrud<LabItem>('labs', setLabs);
  const tstCrud = makeCrud<Testimonial>('testimonials', setTestimonials);
  const faqCrud = makeCrud<FAQ>('faqs', setFaqs);
  const insCrud = makeCrud<Insight>('insights', setInsights);
  const leadCrud = makeCrud<Lead>('leads', setLeads);
  const clientCrud = makeCrud<Client>('clients', setClients);
  const cpCrud = makeCrud<ClientProject>('clientProjects', setClientProjects);
  const msCrud = makeCrud<Milestone>('milestones', setMilestones);
  const fileCrud = makeCrud<ProjectFile>('files', setFiles);

  // ---------- Specialized actions ----------
  const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getProjectBySlug = useCallback(
    (slug: string) => projects.find(p => (p.slug || p.id) === slug),
    [projects],
  );
  const getService = useCallback((slug: string) => services.find(s => s.slug === slug), [services]);

  const updateSettingsField = async (field: string, value: any) => {
    await setDoc(doc(db, 'settings', 'global'), { [field]: value }, { merge: true });
  };

  const addToLibrary = async (fileOrUrl: File | string, altText?: string): Promise<string> => {
    let url = '';
    let name = '';
    let type = 'image/jpeg';
    let size = 0;
    if (typeof fileOrUrl === 'string') {
      url = fileOrUrl;
      name = 'External Image';
    } else {
      const fileName = `${Date.now()}_${fileOrUrl.name}`;
      url = await uploadToStorage(fileOrUrl, `media/${fileName}`);
      name = fileOrUrl.name;
      type = fileOrUrl.type;
      size = fileOrUrl.size;
    }
    const item: MediaItem = {
      id: uid('m_'),
      data: url,
      name,
      type,
      size,
      altText: altText || '',
      uploadedAt: new Date().toISOString(),
    };
    setMediaLibrary(prev => [item, ...prev]);
    await saveDoc('media', item.id, item);
    return url;
  };

  const deleteFromLibrary = async (id: string) => {
    setMediaLibrary(prev => prev.filter(m => m.id !== id));
    await deleteDocById('media', id);
  };

  // Brand asset helpers
  const assetUpdate = async (
    fileOrUrl: File | string,
    storagePath: string,
    setter: (v: string | null) => void,
    field: string,
  ) => {
    const url = typeof fileOrUrl === 'string'
      ? fileOrUrl
      : await uploadToStorage(fileOrUrl, `${storagePath}_${Date.now()}`);
    setter(url);
    await updateSettingsField(field, url);
  };

  const updateBrandProfile = (f: File | string) => assetUpdate(f, 'docs/brand_cv', setBrandProfileData, 'brandProfileData');
  const updatePortfolioHighlight = (f: File | string) => assetUpdate(f, 'docs/portfolio', setPortfolioHighlightData, 'portfolioHighlightData');
  const updatePricingGuide = (f: File | string) => assetUpdate(f, 'docs/pricing', setPricingGuideData, 'pricingGuideData');
  const updateFounderImage = (f: File | string) => assetUpdate(f, 'images/founder', setFounderImageData, 'founderImageData');

  const updateFounderNote = async (n: FounderNote) => { setFounderNote(n); await updateSettingsField('founderNote', n); };
  const updateSiteNotification = async (n: SiteNotification) => { setSiteNotification(n); await updateSettingsField('siteNotification', n); };
  const updateSocialLinks = async (s: SocialLinks) => { setSocialLinks(s); await updateSettingsField('socialLinks', s); };
  const updateSiteSettings = async (patch: Partial<SiteSettings>) => {
    const next = { ...siteSettings, ...patch };
    setSiteSettings(next);
    await updateSettingsField('siteSettings', next);
  };

  // Lead generation
  const nextLeadReference = () => {
    const maxNum = leads.reduce((acc, l) => {
      const m = l.reference?.match(/TT-(\d+)/);
      return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
    }, 1000);
    return `TT-${maxNum + 1}`;
  };

  const addLead = async (input: Omit<Lead, 'id' | 'createdAt' | 'reference'>): Promise<Lead> => {
    const now = new Date().toISOString();
    const lead: Lead = {
      ...input,
      id: uid('l_'),
      reference: nextLeadReference(),
      createdAt: now,
      status: input.status || 'new',
      source: input.source || 'website',
    };
    setLeads(prev => [lead, ...prev]);
    await saveDoc('leads', lead.id, lead);
    return lead;
  };

  // Clients
  const addClient = async (input: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
    const client: Client = { ...input, id: uid('c_'), createdAt: new Date().toISOString() };
    setClients(prev => [client, ...prev]);
    await saveDoc('clients', client.id, client);
    return client;
  };
  const verifyClientAccess = (email: string, code: string): Client | null => {
    const normalizedEmail = email.trim().toLowerCase();
    return clients.find(c => c.email.toLowerCase() === normalizedEmail && c.accessCode === code && c.status === 'active') || null;
  };

  // Files
  const addFile = async (f: Omit<ProjectFile, 'id' | 'uploadedAt' | 'url'> & { file?: File }) => {
    let url = '';
    if (f.file) url = await uploadToStorage(f.file, `projects/${f.projectId}/${Date.now()}_${f.name}`);
    const item: ProjectFile = {
      id: uid('f_'),
      projectId: f.projectId,
      name: f.name,
      url,
      type: f.type,
      size: f.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: f.uploadedBy,
    };
    setFiles(prev => [item, ...prev]);
    await saveDoc('files', item.id, item);
  };
  const deleteFile = fileCrud.remove;

  // Messages
  const addMessage = async (m: Omit<ProjectMessage, 'id' | 'createdAt'>) => {
    const item: ProjectMessage = { ...m, id: uid('msg_'), createdAt: new Date().toISOString() };
    setMessages(prev => [item, ...prev]);
    await saveDoc('messages', item.id, item);
  };

  const value: DataContextType = {
    isLoading,
    projects,
    addProject: projCrud.add,
    updateProject: projCrud.update,
    deleteProject: projCrud.remove,
    getProject,
    getProjectBySlug,
    services,
    addService: svcCrud.add,
    updateService: svcCrud.update,
    deleteService: svcCrud.remove,
    getService,
    solutions,
    addSolution: solCrud.add,
    updateSolution: solCrud.update,
    deleteSolution: solCrud.remove,
    products,
    addProduct: prodCrud.add,
    updateProduct: prodCrud.update,
    deleteProduct: prodCrud.remove,
    labs,
    addLab: labCrud.add,
    updateLab: labCrud.update,
    deleteLab: labCrud.remove,
    testimonials,
    addTestimonial: tstCrud.add,
    updateTestimonial: tstCrud.update,
    deleteTestimonial: tstCrud.remove,
    faqs,
    addFaq: faqCrud.add,
    updateFaq: faqCrud.update,
    deleteFaq: faqCrud.remove,
    insights,
    addInsight: insCrud.add,
    updateInsight: insCrud.update,
    deleteInsight: insCrud.remove,
    leads,
    addLead,
    updateLead: leadCrud.update,
    deleteLead: leadCrud.remove,
    clients,
    addClient,
    updateClient: clientCrud.update,
    deleteClient: clientCrud.remove,
    verifyClientAccess,
    clientProjects,
    addClientProject: cpCrud.add,
    updateClientProject: cpCrud.update,
    deleteClientProject: cpCrud.remove,
    milestones,
    addMilestone: msCrud.add,
    updateMilestone: msCrud.update,
    deleteMilestone: msCrud.remove,
    files,
    addFile,
    deleteFile,
    messages,
    addMessage,
    mediaLibrary,
    addToLibrary,
    deleteFromLibrary,
    tools,
    brandProfileData, updateBrandProfile,
    portfolioHighlightData, updatePortfolioHighlight,
    pricingGuideData, updatePricingGuide,
    founderImageData, updateFounderImage,
    founderNote, updateFounderNote,
    siteNotification, updateSiteNotification,
    socialLinks, updateSocialLinks,
    siteSettings, updateSiteSettings,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
