import { Project, Service, Tool, SocialLinks } from './types';
import {
  Layout,
  PenTool,
  Video,
  Code,
  Layers,
  Globe,
  Smartphone,
  BrainCircuit,
} from 'lucide-react';

export const INITIAL_SOCIAL_LINKS: SocialLinks = {
  facebook: "https://www.facebook.com/share/1KBRGnTUs9/",
  twitter: "https://x.com/TolueneTech?t=6JmT42Bp7PybJ_Yooj6RlQ&s=09",
  instagram: "https://www.instagram.com/toluene_tech0?igsh=d2VzejhzMDV3c3lw",
  linkedin: "",
  whatsapp: "2347081329509",
  email: "toluenetech@gmail.com"
};

export const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'FinEdge Banking Portal',
    category: 'Web Design',
    shortDescription: 'A secure, high-performance banking dashboard for enterprise clients.',
    fullDescription: 'FinEdge required a complete overhaul of their legacy banking portal. We focused on security, speed, and a clutter-free interface to improve transaction efficiency.',
    tools: ['React', 'TypeScript', 'Tailwind', 'Figma'],
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    isFeatured: true,
    isPublished: true,
    clientProblem: 'Slow load times and confusing navigation led to a 20% drop-off rate.',
    solution: 'Built a SPA using React with optimized state management and a fresh UI system.',
    outcome: 'Load times reduced by 60%, user satisfaction scores increased by 40%.'
  },
  {
    id: '2',
    title: 'AeroStream Motion Branding',
    category: 'Video Editing',
    shortDescription: 'Comprehensive motion identity for an aviation logistics firm.',
    fullDescription: 'We created a kinetic typography system and a series of explainer videos to simplify complex logistics concepts for AeroStream.',
    tools: ['After Effects', 'Premiere Pro', 'Illustrator'],
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    isFeatured: true,
    isPublished: true,
    clientProblem: 'Brand felt static and outdated in a high-tech industry.',
    solution: 'Developed a dynamic motion language applied to all digital touchpoints.',
    outcome: 'Social media engagement rose by 150% in the first quarter.'
  },
  {
    id: '3',
    title: 'Nexus SaaS Interface',
    category: 'UI/UX',
    shortDescription: 'User-centered design for a complex data analytics platform.',
    fullDescription: 'Nexus helps businesses visualize big data. We designed a dark-mode first UI that reduces eye strain and highlights critical metrics effectively.',
    tools: ['Figma', 'Adobe XD', 'Protopie'],
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80',
    isFeatured: true,
    isPublished: true,
    clientProblem: 'Users found the old dashboard overwhelming and difficult to customize.',
    solution: 'Created a modular widget system allowing full user customization.',
    outcome: 'Reduced support tickets related to usability by 75%.'
  },
  {
    id: '4',
    title: 'EcoMarket Frontend',
    category: 'Frontend',
    shortDescription: 'Pixel-perfect implementation of a sustainable e-commerce platform.',
    fullDescription: 'Translating a beautiful design into performant code. We used modern CSS techniques and a React-based architecture for SEO-friendly rendering.',
    tools: ['Next.js', 'SCSS', 'Redux'],
    imageUrl: 'https://images.unsplash.com/photo-1661956602116-aa6865609028?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80',
    isFeatured: false,
    isPublished: true,
    clientProblem: 'Previous site had poor SEO and slow mobile performance.',
    solution: 'Rebuilt frontend with semantic HTML and optimized asset loading.',
    outcome: 'Organic traffic increased by 35% within two months.'
  },
  {
    id: '5',
    title: 'NovaSupport AI Assistant',
    category: 'AI Integration & Automation',
    shortDescription: 'An intelligent customer-support chatbot integrated into a SaaS product to resolve common tickets instantly.',
    fullDescription: 'We designed and implemented an AI-powered support assistant that answers product questions, triages tickets, and hands off complex issues to human agents with full conversation context. The assistant was wired into the existing knowledge base using retrieval-augmented generation so responses stay accurate and up to date.',
    tools: ['OpenAI', 'LangChain', 'Node.js', 'TypeScript', 'React', 'Vector Database'],
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80',
    isFeatured: true,
    isPublished: true,
    clientProblem: 'Support team was overwhelmed by repetitive questions, leading to long response times and low CSAT scores.',
    solution: 'Deployed an LLM-powered chatbot with RAG over internal docs, smart escalation, and an analytics dashboard for the support team.',
    outcome: 'Demo/sample case study — metrics to be provided by the client after launch.'
  },
];

export const SERVICES: Service[] = [
  {
    id: 'web-design',
    title: 'Web Design',
    description: 'Corporate websites, landing pages, and web platforms that blend premium aesthetics with rock-solid engineering.',
    icon: Globe,
    includes: ['Responsive Layouts', 'CMS Integration', 'SEO Optimization', 'Performance Tuning'],
    benefit: 'Establish a credible digital presence that converts visitors into customers.'
  },
  {
    id: 'frontend',
    title: 'Frontend Development',
    description: 'Scalable, maintainable, and high-performance frontend architecture built on modern React.',
    icon: Code,
    includes: ['React / Next.js', 'State Management', 'API Integration', 'Component Systems'],
    benefit: 'Keep your application fast, interactive, and easy to scale as your product grows.'
  },
  {
    id: 'ui-ux',
    title: 'UI/UX Design',
    description: 'User-centric interfaces designed for clarity, usability, and measurable business outcomes.',
    icon: Layout,
    includes: ['Wireframing', 'Prototyping', 'User Research', 'Design Systems'],
    benefit: 'Reduce friction for your users and drive higher product adoption.'
  },
  {
    id: 'app-design',
    title: 'App Design',
    description: 'Beautiful, intuitive mobile and web app interfaces that feel native on every device.',
    icon: PenTool,
    includes: ['iOS & Android UI', 'User Flows', 'Interactive Prototypes', 'Design Handoff'],
    benefit: 'Deliver app experiences users love to open and effortless to navigate.'
  },
  {
    id: 'app-development',
    title: 'App Development',
    description: 'Cross-platform and web applications engineered for speed, stability, and long-term maintainability.',
    icon: Smartphone,
    includes: ['React-based Apps', 'API & Backend Integration', 'Offline Support', 'App Store Prep'],
    benefit: 'Turn your app idea into a polished product ready to ship and scale.'
  },
  {
    id: 'graphic-design',
    title: 'Graphic Design',
    description: 'Visual identity and digital design assets that tell your brand story consistently.',
    icon: Layers,
    includes: ['Branding & Logos', 'Iconography', 'Marketing Assets', 'Digital Brochures'],
    benefit: 'Build a cohesive brand image that earns trust across every channel.'
  },
  {
    id: 'video-editing',
    title: 'Video Editing',
    description: 'Engaging motion graphics and polished video editing for brands that want to stand out.',
    icon: Video,
    includes: ['Explainer Videos', 'Logo Reveals', 'Social Media Shorts', 'Lottie Animations'],
    benefit: 'Capture attention instantly and explain complex ideas in seconds.'
  },
  {
    id: 'ai-integration',
    title: 'AI Integration & Automation',
    description: 'Build smarter digital experiences by integrating AI into websites, applications, and business workflows — from AI chatbots and intelligent assistants to automation pipelines, LLM integrations, and custom AI-powered features.',
    icon: BrainCircuit,
    includes: [
      'AI Chatbots & Assistants',
      'LLM / OpenAI Integrations',
      'Workflow Automation',
      'AI-Powered Features & APIs',
    ],
    benefit: 'Turn artificial intelligence into practical, revenue-driving digital solutions for your business.'
  },
];

// Using CDN logos for generic tools
export const TOOLS_LIST: Tool[] = [
  { name: 'Figma', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/figma/figma-original.svg' },
  { name: 'Adobe XD', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/xd/xd-original.svg' },
  { name: 'Photoshop', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/photoshop/photoshop-original.svg' },
  { name: 'Illustrator', category: 'Design', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/illustrator/illustrator-plain.svg' },
  { name: 'React', category: 'Development', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
  { name: 'TypeScript', category: 'Development', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg' },
  { name: 'Tailwind CSS', category: 'Development', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg' },
  { name: 'Node.js', category: 'Development', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg' },
  { name: 'Next.js', category: 'Development', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg' },
  { name: 'Python', category: 'AI', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg' },
  { name: 'After Effects', category: 'Motion', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/aftereffects/aftereffects-original.svg' },
  { name: 'Premiere Pro', category: 'Motion', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/premierepro/premierepro-original.svg' },
];

/** Suggested tech tags for AI projects (shown in admin UI as quick-add chips). */
export const AI_TECH_SUGGESTIONS = [
  'OpenAI',
  'Gemini',
  'Claude',
  'LLM',
  'RAG',
  'Vector Database',
  'AI Agents',
  'Automation',
  'AI APIs',
  'Python',
  'Node.js',
  'TypeScript',
];
