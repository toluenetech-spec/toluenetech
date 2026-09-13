import { Project, Service, Tool, SocialLinks } from './types';
import { Monitor, Layout, PenTool, Video, Code, Layers, Globe } from 'lucide-react';

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
    category: 'Motion & Video',
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
    fullDescription: 'Translating a beautiful design into performant code. We used modern CSS techniques and React Server Components for SEO mastery.',
    tools: ['Next.js', 'SCSS', 'Redux'],
    imageUrl: 'https://images.unsplash.com/photo-1661956602116-aa6865609028?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80',
    isFeatured: false,
    isPublished: true,
    clientProblem: 'Previous site had poor SEO and slow mobile performance.',
    solution: 'Rebuilt frontend with semantic HTML and optimized asset loading.',
    outcome: 'Organic traffic increased by 35% within two months.'
  }
];

export const SERVICES: Service[] = [
  {
    id: 'web-design',
    title: 'Web Design & Development',
    description: 'Corporate websites that blend aesthetics with technical excellence.',
    icon: Globe,
    includes: ['Responsive Design', 'CMS Integration', 'SEO Optimization', 'Performance Tuning'],
    benefit: 'Establish a credible digital presence that converts visitors into leads.'
  },
  {
    id: 'frontend',
    title: 'Frontend Development',
    description: 'Scalable, maintainable, and high-performance frontend architecture.',
    icon: Code,
    includes: ['React/Vue/Angular', 'State Management', 'API Integration', 'Component Libraries'],
    benefit: 'Ensure your application is fast, interactive, and easy to scale.'
  },
  {
    id: 'ui-ux',
    title: 'UI/UX Design',
    description: 'User-centric interfaces designed for clarity, usability, and delight.',
    icon: Layout,
    includes: ['Wireframing', 'Prototyping', 'User Research', 'Design Systems'],
    benefit: 'Reduce friction for your users and increase product adoption rates.'
  },
  {
    id: 'product',
    title: 'Product / Graphic Design',
    description: 'Visual identity and digital product design that tells your brand story.',
    icon: Layers,
    includes: ['Branding', 'Iconography', 'Marketing Assets', 'Digital Brochures'],
    benefit: 'Create a cohesive brand image that builds trust across all channels.'
  },
  {
    id: 'motion',
    title: 'Motion Graphics & Video Editing',
    description: 'Engaging motion graphics and professional video editing.',
    icon: Video,
    includes: ['Explainer Videos', 'Logo Reveals', 'Social Media Shorts', 'Lottie Animations'],
    benefit: 'Capture attention instantly and explain complex ideas simply.'
  }
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
  { name: 'After Effects', category: 'Motion', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/aftereffects/aftereffects-original.svg' },
  { name: 'Premiere Pro', category: 'Motion', logoUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/premierepro/premierepro-original.svg' },
];