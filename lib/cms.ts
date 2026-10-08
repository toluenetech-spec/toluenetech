/**
 * CMS / public-data client.
 *
 * Phase 2: browser never talks to Neon directly. All public reads go through
 * the Worker at /cms/* (proxied by Vite in dev, direct in prod).
 *
 * Caching: short-lived in-memory cache keyed by URL so a single page render
 * doesn't double-fetch. Admin writes do NOT invalidate browser cache; the
 * browser cache is TTL-bounded (60s) to match server Cache-Control.
 */
import { apiBase } from './api';

const API_BASE = apiBase();

const memCache = new Map<string, { ts: number; value: unknown }>();
const TTL_MS = 60_000;

async function cmsGet<T>(path: string, opts?: { ttl?: number }): Promise<T> {
  const key = path;
  const ttl = opts?.ttl ?? TTL_MS;
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.value as T;
  const res = await fetch(`${API_BASE}/cms${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found');
    throw new Error(`CMS error (${res.status}) for ${path}`);
  }
  const data = await res.json() as T;
  memCache.set(key, { ts: Date.now(), value: data });
  return data;
}

export function invalidateCMSCache(prefix?: string) {
  if (!prefix) { memCache.clear(); return; }
  for (const k of Array.from(memCache.keys())) if (k.startsWith(prefix)) memCache.delete(k);
}

export interface ServiceRecord {
  id: string; slug: string; title: string; shortDescription: string; longDescription?: string | null;
  icon?: string; capabilities?: string[]; relatedProjectIds?: string[];
  isPublished: boolean; isFeatured: boolean; order: number;
}
export interface SolutionRecord {
  id: string; slug: string; title: string; tagline?: string | null; description?: string | null;
  icon?: string; features?: string[]; benefits?: string[]; imageUrl?: string | null;
  relatedServiceIds?: string[]; ctaLabel?: string; ctaUrl?: string | null;
  isPublished: boolean; isFeatured: boolean; order: number;
}
export interface ProjectRecord {
  id: string; slug: string; title: string; clientName?: string | null; clientLogo?: string | null;
  role?: string; platform?: string; framework?: string; completionDate?: string | null;
  status?: string; coverImage?: string | null; gallery?: string[]; videoUrl?: string | null;
  challenge?: string | null; objective?: string | null; solution?: string | null;
  features?: string[]; results?: string | null; metrics?: { label: string; value: string }[];
  liveUrl?: string | null; serviceIds?: string[];
  isPublished: boolean; isFeatured: boolean; hasClientPermission: boolean; order: number;
}
export interface ProductRecord {
  id: string; slug: string; name: string; description?: string | null; logo?: string | null;
  screenshots?: string[]; features?: string[]; techStack?: string[]; status?: string;
  demoUrl?: string | null; websiteUrl?: string | null;
  isPublished: boolean; order: number;
}
export interface ToolRecord {
  id: string; name: string; category: string; logoUrl?: string | null; description?: string | null;
  websiteUrl?: string | null; isPublished: boolean; order: number;
}
export interface FAQRecord {
  id: string; question: string; answer: string; category?: string | null; order: number; isPublished: boolean;
}
export interface TestimonialRecord {
  id: string; name: string; role?: string | null; company?: string | null; photo?: string | null;
  testimonial: string; relatedProjectId?: string | null; isFeatured: boolean; isPublished: boolean; order: number;
}
export interface PricingPlanRecord {
  id: string; name: string; tagline?: string | null; priceMonthly?: number | null; priceOneTime?: number | null;
  currency: string; features: string[]; ctaLabel: string; ctaUrl?: string | null;
  isFeatured: boolean; isPublished: boolean; order: number;
}
export interface InsightRecord {
  id: string; slug: string; title: string; excerpt?: string | null; coverImage?: string | null;
  content?: string; author?: string | null; category?: string | null; tags?: string[];
  publishDate?: string | null; isFeatured: boolean; isPublished?: boolean;
}
export interface LabRecord {
  id: string; slug: string; title: string; description?: string | null; category?: string;
  tech?: string[]; demoUrl?: string | null; status?: string; screenshots?: string[];
  publishedAt?: string | null; isPublished: boolean; createdAt?: string; updatedAt?: string;
}
export interface Paginated<T> { items: T[]; total: number; page: number; limit: number; totalPages: number; }

export const getServices = () => cmsGet<{ items: ServiceRecord[] }>('/services');
export const getService = (slug: string) => cmsGet<{ item: ServiceRecord }>(`/services/${encodeURIComponent(slug)}`);
export const getSolutions = () => cmsGet<{ items: SolutionRecord[] }>('/solutions');
export const getSolution = (slug: string) => cmsGet<{ item: SolutionRecord }>(`/solutions/${encodeURIComponent(slug)}`);
export const getProjects = (params?: { page?: number; limit?: number; category?: string; q?: string }) => {
  const usp = new URLSearchParams();
  if (params?.page) usp.set('page', String(params.page));
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.category) usp.set('category', params.category);
  if (params?.q) usp.set('q', params.q);
  const qs = usp.toString();
  return cmsGet<Paginated<ProjectRecord>>(`/projects${qs ? `?${qs}` : ''}`);
};
export const getProject = (slug: string) => cmsGet<{ item: ProjectRecord }>(`/projects/${encodeURIComponent(slug)}`);
export const getProducts = () => cmsGet<{ items: ProductRecord[] }>('/products');
export const getProduct = (slug: string) => cmsGet<{ item: ProductRecord }>(`/products/${encodeURIComponent(slug)}`);
export const getTools = (category?: string) => cmsGet<{ items: ToolRecord[] }>(`/tools${category ? `?category=${encodeURIComponent(category)}` : ''}`);
export const getFAQs = (category?: string) => cmsGet<{ items: FAQRecord[] }>(`/faqs${category ? `?category=${encodeURIComponent(category)}` : ''}`);
export const getPricing = () => cmsGet<{ items: PricingPlanRecord[] }>('/pricing');
export const getTestimonials = () => cmsGet<{ items: TestimonialRecord[] }>('/testimonials');
export const getInsights = (params?: { page?: number; limit?: number; category?: string; tag?: string; q?: string }) => {
  const usp = new URLSearchParams();
  if (params?.page) usp.set('page', String(params.page));
  if (params?.limit) usp.set('limit', String(params.limit));
  if (params?.category) usp.set('category', params.category);
  if (params?.tag) usp.set('tag', params.tag);
  if (params?.q) usp.set('q', params.q);
  const qs = usp.toString();
  return cmsGet<Paginated<InsightRecord>>(`/insights${qs ? `?${qs}` : ''}`);
};
export const getInsight = (slug: string) => cmsGet<{ item: InsightRecord }>(`/insights/${encodeURIComponent(slug)}`);
export const getLabs = (category?: string) => cmsGet<{ items: LabRecord[] }>(`/labs${category ? `?category=${encodeURIComponent(category)}` : ''}`);
export const getLab = (slug: string) => cmsGet<{ item: LabRecord }>(`/labs/${encodeURIComponent(slug)}`);

export interface PublicSiteSettings {
  company?: { name?: string; email?: string; phone?: string; whatsapp?: string; address?: string; tagline?: string };
  contact?: { email?: string; phone?: string; whatsapp?: string; address?: string; hours?: string };
  social?: Record<string, string>;
  founder?: { name?: string; title?: string; bio?: string; photo?: string };
  notification?: { enabled?: boolean; message?: string; tone?: 'info'|'warning'|'success' };
  availability?: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';
  hero?: { title?: string; subtitle?: string; primaryCta?: string; primaryCtaHref?: string; secondaryCta?: string; secondaryCtaHref?: string };
  brand?: { logoUrl?: string; logoDarkUrl?: string; faviconUrl?: string };
  seo_defaults?: { siteName?: string; defaultTitle?: string; defaultDescription?: string; defaultOgImage?: string; twitter?: string };
}
export const getSiteSettings = () => cmsGet<{ settings: PublicSiteSettings }>('/site', { ttl: 5 * 60_000 });

export async function loadCMSData(): Promise<{
  services: ServiceRecord[]; solutions: SolutionRecord[]; projects: ProjectRecord[];
  products: ProductRecord[]; labs: LabRecord[]; tools: ToolRecord[]; faqs: FAQRecord[];
  testimonials: TestimonialRecord[]; pricing: PricingPlanRecord[]; insights: InsightRecord[];
  site: PublicSiteSettings;
}> {
  const [svc, sol, prj, prod, labs, faq, tst, prc, ins, tools, site] = await Promise.all([
    getServices(), getSolutions(), getProjects({ limit: 50 }), getProducts(),
    getLabs(),
    getFAQs(), getTestimonials(), getPricing(),
    getInsights({ limit: 50 }), getTools(), getSiteSettings(),
  ]);
  return {
    services: svc.items, solutions: sol.items, projects: prj.items,
    products: prod.items, labs: labs.items, tools: tools.items, faqs: faq.items,
    testimonials: tst.items, pricing: prc.items, insights: ins.items,
    site: site.settings,
  };
}
