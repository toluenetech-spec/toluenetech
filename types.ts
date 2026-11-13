import React from 'react';

/* ---------------- Categories ---------------- */
export type ProjectCategory =
  | 'Websites' | 'Web Apps' | 'Mobile Apps' | 'UI/UX' | 'AI' | 'Branding' | 'Graphics' | 'Video'
  | 'Web Design' | 'Frontend' | 'App Design' | 'App Development' | 'Graphic Design'
  | 'Video Editing' | 'Product Design' | 'Motion & Video' | 'AI Integration & Automation';

export const PROJECT_CATEGORY_ORDER: ProjectCategory[] = [
  'Websites', 'Web Apps', 'Mobile Apps', 'UI/UX', 'AI', 'Branding', 'Graphics', 'Video',
];
export const CATEGORY_ORDER = PROJECT_CATEGORY_ORDER;

export const CATEGORY_DISPLAY: Record<ProjectCategory, string> = {
  'Websites': 'Websites', 'Web Apps': 'Web Apps', 'Mobile Apps': 'Mobile Apps',
  'UI/UX': 'UI/UX', 'AI': 'AI', 'Branding': 'Branding', 'Graphics': 'Graphics', 'Video': 'Video',
  'Web Design': 'Websites', 'Frontend': 'Web Apps', 'App Design': 'Mobile Apps',
  'App Development': 'Mobile Apps', 'Graphic Design': 'Graphics', 'Video Editing': 'Video',
  'Product Design': 'Branding', 'Motion & Video': 'Video', 'AI Integration & Automation': 'AI',
};

export function canonicalCategory(c: ProjectCategory): ProjectCategory {
  const map: Record<string, ProjectCategory> = {
    'Web Design':'Websites','Frontend':'Web Apps','App Design':'Mobile Apps',
    'App Development':'Mobile Apps','Graphic Design':'Graphics','Video Editing':'Video',
    'Product Design':'Branding','Motion & Video':'Video','AI Integration & Automation':'AI',
  };
  return map[c] || c;
}

/* ---------------- Project ---------------- */
export interface Project {
  id: string; title: string; slug?: string; category: ProjectCategory;
  shortDescription: string; fullDescription: string; tools: string[];
  imageUrl: string; videoUrl?: string; liveUrl?: string; githubUrl?: string;
  client?: string; completionDate?: string; isFeatured: boolean; isPublished: boolean; order?: number;
  clientProblem?: string; solution?: string; outcome?: string; objective?: string;
  features?: string[]; tags?: string[]; gallery?: string[];
  appStoreUrl?: string; playStoreUrl?: string; clientRole?: string;
  platform?: string; framework?: string;
  seoTitle?: string; seoDescription?: string;
}

/* ---------------- Service ---------------- */
export interface Service {
  id: string; slug: string; title: string; shortTitle?: string; description: string; longDescription?: string;
  icon: React.ElementType | string;
  includes: string[]; capabilities?: string[]; process?: string[]; tech?: string[];
  useCases?: string[]; faqs?: { q: string; a: string }[]; benefit?: string;
  isPublished: boolean; isFeatured: boolean; order?: number;
}

/* ---------------- Solution ---------------- */
export interface Solution {
  id: string; slug: string; title: string; tagline: string; description: string; icon: string;
  features: string[]; relatedServiceIds?: string[]; isPublished: boolean; order?: number;
}

/* ---------------- Product ---------------- */
export type ProductStatus = 'idea' | 'prototype' | 'in-development' | 'beta' | 'live' | 'archived';
export interface Product {
  id: string; slug: string; name: string; tagline: string; description: string;
  logoUrl?: string; imageUrl?: string; screenshots?: string[]; features: string[];
  tech?: string[]; status: ProductStatus; demoUrl?: string; websiteUrl?: string;
  caseStudyId?: string; isPublished: boolean; order?: number;
}

/* ---------------- Labs ---------------- */
export type LabCategory = 'AI' | 'Web' | 'Mobile' | 'UI Experiments' | 'Automation' | 'Prototypes';
export type LabStatus = 'experiment' | 'prototype' | 'beta' | 'live' | 'archived';
export interface LabItem {
  id: string; title: string; description: string; category: LabCategory;
  tech?: string[]; demoUrl?: string; status: LabStatus; imageUrl?: string; date?: string; isPublished: boolean;
}

/* ---------------- Testimonial ---------------- */
export interface Testimonial {
  id: string; clientName: string; role?: string; company?: string; photoUrl?: string;
  quote: string; relatedProjectId?: string; isFeatured: boolean; isPublished: boolean; order?: number;
}

/* ---------------- FAQ ---------------- */
export type FAQCategory = 'General' | 'Services' | 'Pricing' | 'AI' | 'Projects' | 'Support';
export interface FAQ {
  id: string; question: string; answer: string; category: FAQCategory; order?: number; isPublished: boolean;
}

/* ---------------- Insights ---------------- */
export type InsightCategory = 'AI' | 'Web Development' | 'UI/UX' | 'Technology' | 'Business Automation' | 'Case Studies';
export interface Insight {
  id: string; slug: string; title: string; excerpt: string; coverUrl?: string; content: string;
  author?: string; category: InsightCategory; tags?: string[]; publishDate?: string;
  seoTitle?: string; seoDescription?: string; isFeatured: boolean; isPublished: boolean;
}

/* ---------------- Leads / CRM ---------------- */
export type LeadStatus = 'new'|'contacted'|'qualified'|'discovery'|'proposal'|'negotiation'|'won'|'lost';
export type LeadSource = 'website'|'whatsapp'|'email'|'referral'|'ai-lab'|'estimate'|'other';
export interface Lead {
  id: string; reference: string; name: string; email: string; phone?: string; company?: string;
  services?: string[]; projectType?: string[]; requirements?: string; features?: string[];
  budget?: string; timeline?: string; existingAssets?: string; aiDetails?: Record<string, string>;
  source: LeadSource; status: LeadStatus; notes?: string; followUpDate?: string;
  createdAt: any; convertedToClientId?: string;
}

/* ---------------- Client portal ---------------- */
export interface Client {
  id: string; name: string; email: string; phone?: string; company?: string;
  accessCode: string; status: 'active' | 'inactive'; createdAt: any;
}
export type ProjectClientStatus = 'PLANNING' | 'IN_PROGRESS' | 'ACTIVE' | 'ON_HOLD' | 'PAUSED' | 'REVIEW' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED' | 'active' | 'in-progress' | 'on-hold' | 'completed';
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export interface ClientProject {
  id: string; clientId: string; title: string; description?: string | null;
  status: ProjectClientStatus; priority?: ProjectPriority; progress?: number;
  assignee?: string | null; startDate?: string | null; dueDate?: string | null;
  totalCents?: number | null; currency?: string;
  createdAt?: any; updatedAt?: any;
}
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED' | 'pending' | 'in-progress' | 'completed';
export interface Milestone {
  id: string; projectId: string; title: string; description?: string | null;
  status: MilestoneStatus; dueDate?: string | null; completedDate?: string;
  amountCents?: number | null; approvedAt?: string | null; approvedBy?: string | null; rejectionReason?: string | null;
  notes?: string; order?: number; createdAt?: any; updatedAt?: any;
}
export interface ProjectFile {
  id: string; projectId: string; clientId?: string | null;
  name?: string; filename?: string; url?: string; r2Key?: string;
  type?: string; mimeType?: string; size?: number | null; sizeBytes?: number | null;
  uploadedAt?: any; updatedAt?: any; uploadedBy?: string | null; uploadedByRole?: 'admin' | 'client' | null;
  visibility?: 'PUBLIC' | 'PRIVATE';
}
export interface ProjectMessage {
  id: string; projectId?: string; contextType?: string; contextId?: string | null; threadId?: string | null;
  author?: 'admin' | 'client'; isFromClient?: boolean;
  authorName?: string; fromName?: string;
  text?: string; body?: string; attachmentUrl?: string;
  attachments?: { filename: string; r2Key: string; sizeBytes?: number; mimeType?: string }[];
  toClientId?: string | null; toUid?: string | null;
  isRead?: boolean; readAt?: string | null;
  createdAt: any;
  readByClient?: boolean; readByAdmin?: boolean;
}
export interface ClientNotification {
  id: string; type: string; title: string; body?: string | null; link?: string | null;
  isRead: boolean; createdAt: any;
}
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';
export interface ClientInvoice {
  id: string; number: string; clientId: string; projectId?: string | null;
  subtotalCents?: number; taxCents?: number; discountCents?: number;
  amountCents: number; currency: string;
  status: InvoiceStatus; notes?: string | null;
  dueDate?: string | null; issuedAt?: string | null; viewedAt?: string | null;
  paidAt?: string | null; cancelledAt?: string | null;
  createdAt: any;
}
export interface ClientInvoiceItem {
  id: string; invoiceId: string; kind: string; description: string;
  quantity: number; unitPriceCents: number; amountCents: number; order: number;
}

/* ---------------- Tool ---------------- */
export interface Tool {
  name: string; logoUrl: string;
  category: 'Frontend'|'Backend'|'Mobile'|'Database'|'AI'|'Cloud'|'Design'|'Automation'|'Motion'|'Development';
}

/* ---------------- Misc ---------------- */
export interface MediaItem {
  id: string; data: string; name: string; type: string; size?: number; altText?: string; uploadedAt?: any;
}
export interface SocialLinks {
  facebook: string; twitter: string; instagram: string; linkedin: string; whatsapp: string; email: string;
}
export interface FounderNote { heading: string; message: string; name: string; role: string; }
export interface SiteNotification { message: string; link?: string; linkText?: string; isActive: boolean; }
export type AvailabilityStatus = 'available' | 'limited' | 'unavailable';
export interface SiteSettings {
  businessName: string; tagline: string; availability: AvailabilityStatus; availabilityMessage?: string;
  heroHeading?: string; heroSubheading?: string; heroCtaPrimary?: string; heroCtaSecondary?: string;
  defaultSeoTitle?: string; defaultSeoDescription?: string;
}

export const SERVICE_OPTIONS = [
  'Web Design','Frontend Development','UI/UX Design','App Design','App Development',
  'Graphic Design','Video Editing','AI Integration & Automation','Other / Not sure',
] as const;
export type ServiceOption = typeof SERVICE_OPTIONS[number];
