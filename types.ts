// Fix: Import React to resolve namespace errors for React.ElementType
import React from 'react';

export type ProjectCategory =
  | 'Web Design'
  | 'Frontend'
  | 'UI/UX'
  | 'App Design'
  | 'App Development'
  | 'Graphic Design'
  | 'Video Editing'
  | 'AI Integration & Automation'
  // Legacy categories retained for backward compatibility with existing Firestore data
  | 'Product Design'
  | 'Motion & Video';

/**
 * Human-friendly display label for any category (including legacy values).
 */
export const CATEGORY_DISPLAY: Record<ProjectCategory, string> = {
  'Web Design': 'Web Design',
  'Frontend': 'Frontend Development',
  'UI/UX': 'UI/UX Design',
  'App Design': 'App Design',
  'App Development': 'App Development',
  'Graphic Design': 'Graphic Design',
  'Video Editing': 'Video Editing',
  'AI Integration & Automation': 'AI Integration & Automation',
  'Product Design': 'Graphic Design', // legacy mapping
  'Motion & Video': 'Video Editing',  // legacy mapping
};

/** Ordered list of categories shown in public filters / admin selects. */
export const CATEGORY_ORDER: ProjectCategory[] = [
  'Web Design',
  'Frontend',
  'UI/UX',
  'App Design',
  'App Development',
  'Graphic Design',
  'Video Editing',
  'AI Integration & Automation',
];

export interface Project {
  id: string;
  title: string;
  category: ProjectCategory;
  shortDescription: string;
  fullDescription: string;
  tools: string[];
  imageUrl: string;
  videoUrl?: string;
  liveUrl?: string;
  githubUrl?: string;
  isFeatured: boolean;
  isPublished: boolean;
  client?: string;
  completionDate?: string;
  clientProblem?: string;
  solution?: string;
  outcome?: string;
  tags?: string[];
  order?: number;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  includes: string[];
  benefit: string;
}

export interface Tool {
  name: string;
  logoUrl: string; // Changed from optional icon component to required URL
  category: 'Design' | 'Development' | 'Motion' | 'AI';
}

export interface MediaItem {
  id: string;
  data: string; // Base64 string or URL
  name: string;
  type: string;
}

export interface SocialLinks {
  facebook: string;
  twitter: string;
  instagram: string;
  linkedin: string;
  whatsapp: string;
  email: string;
}

/** Service options shown on the contact/order form. */
export const SERVICE_OPTIONS = [
  'Web Design',
  'Frontend Development',
  'UI/UX Design',
  'App Design',
  'App Development',
  'Graphic Design',
  'Video Editing',
  'AI Integration & Automation',
  'Other / Not sure',
] as const;

export type ServiceOption = typeof SERVICE_OPTIONS[number];
