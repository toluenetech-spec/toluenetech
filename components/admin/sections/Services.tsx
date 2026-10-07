import React from 'react';
import { Briefcase, CheckCircle2, XCircle, Eye, Sparkles } from 'lucide-react';
import { GenericCRUD } from './GenericCRUD';

const ICON_OPTIONS = ['Globe','Code','Layout','PenTool','Smartphone','Layers','Video','BrainCircuit','Shield','BarChart3','Rocket','Briefcase','Megaphone','Bot','Palette'];

export default function ServicesSection() {
  return <GenericCRUD config={{
    entity: 'services',
    title: 'Services',
    description: 'Manage the public services catalog that powers /services and Tolesh retrieval.',
    addLabel: 'Add service',
    emptyTitle: 'No services yet',
    emptyBody: 'Add your first service to appear on the public site and in Tolesh answers.',
    searchPlaceholder: 'Search services…',
    columns: [
      { key: 'title', label: 'Service', render: (r: any) => (
        <div>
          <div className="adm-table-title">{r.title}</div>
          <div className="adm-table-sub">{r.shortDescription}</div>
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
      { key: 'title', label: 'Title', required: true, type: 'text', placeholder: 'e.g. AI Integration & Automation' },
      { key: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from title if blank' },
      { key: 'shortDescription', label: 'Short description', type: 'textarea', placeholder: 'One-line summary shown in cards.' },
      { key: 'longDescription', label: 'Long description', type: 'textarea', placeholder: 'Full service copy.' },
      { key: 'icon', label: 'Icon', type: 'select', options: ICON_OPTIONS.map(o => ({ value: o, label: o })) },
      { key: 'capabilities', label: 'Capabilities', type: 'tags', placeholder: 'Responsive design, SEO, ...' },
      { key: 'order', label: 'Display order', type: 'number', initial: 0 },
      { key: 'isPublished', label: 'Published', type: 'checkbox', initial: true },
      { key: 'isFeatured', label: 'Featured on homepage', type: 'checkbox' },
      { key: 'seoTitle', label: 'SEO title', type: 'text' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
    ],
    beforeSave: (data) => {
      const slug = data.slug || String(data.title || 'service').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'svc-' + Math.random().toString(36).slice(2, 8));
      return { ...data, slug };
    },
  }}/>;
}
