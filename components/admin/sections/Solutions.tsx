import React from 'react';
import { CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { GenericCRUD } from './GenericCRUD';

const ICON_OPTIONS = ['Globe','Code','Layout','PenTool','Smartphone','Layers','Video','BrainCircuit','Shield','BarChart3','Rocket','Briefcase','Megaphone','Bot','Palette','Zap','LineChart','Users'];

export default function SolutionsSection() {
  return <GenericCRUD config={{
    entity: 'solutions',
    title: 'Solutions',
    description: 'Solution bundles (cross-service offerings) shown on the public /solutions page.',
    addLabel: 'Add solution',
    emptyTitle: 'No solutions yet',
    emptyBody: 'Add your first solution offering.',
    searchPlaceholder: 'Search solutions…',
    columns: [
      { key: 'title', label: 'Solution', render: (r: any) => (
        <div>
          <div className="adm-table-title">{r.title}</div>
          <div className="adm-table-sub">{r.tagline}</div>
        </div>
      )},
      { key: 'icon', label: 'Icon', render: (r: any) => <span className="adm-badge">{r.icon || 'Globe'}</span> },
      { key: 'published', label: 'Status', render: (r: any) => r.isPublished
        ? <span className="adm-badge published"><CheckCircle2 size={11}/>Published</span>
        : <span className="adm-badge draft"><XCircle size={11}/>Draft</span> },
      { key: 'featured', label: 'Featured', render: (r: any) => r.isFeatured ? <span className="adm-badge featured"><Sparkles size={11}/>Featured</span> : <span className="adm-muted">—</span> },
      { key: 'order', label: 'Order', render: (r: any) => <span className="adm-muted">{r.order ?? 0}</span> },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true, type: 'text', placeholder: 'e.g. End-to-End AI Product Build' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated if blank' },
      { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Short one-liner' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Long-form copy' },
      { key: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS.map(o => ({ value: o, label: o })) },
      { key: 'imageUrl', label: 'Image URL', type: 'text' },
      { key: 'features', label: 'Features', type: 'tags' },
      { key: 'benefits', label: 'Benefits', type: 'tags' },
      { key: 'relatedServiceIds', label: 'Related service IDs', type: 'tags' },
      { key: 'ctaLabel', label: 'CTA label', type: 'text', initial: 'Learn more' },
      { key: 'ctaUrl', label: 'CTA URL', type: 'text' },
      { key: 'order', label: 'Display order', type: 'number', initial: 0 },
      { key: 'isPublished', label: 'Published', type: 'checkbox' },
      { key: 'isFeatured', label: 'Featured', type: 'checkbox' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
    ],
  }}/>;
}
