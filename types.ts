// Fix: Import React to resolve namespace errors for React.ElementType
import React from 'react';

export type ProjectCategory = 'Web Design' | 'Frontend' | 'UI/UX' | 'Product Design' | 'Motion & Video';

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
  isFeatured: boolean;
  isPublished: boolean;
  clientProblem?: string;
  solution?: string;
  outcome?: string;
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
  category: 'Design' | 'Development' | 'Motion';
}

export interface MediaItem {
  id: string;
  data: string; // Base64 string
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