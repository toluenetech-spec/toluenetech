import React from 'react';
import { Quote, CheckCircle2, XCircle, Star } from 'lucide-react';
import { GenericCRUD } from './GenericCRUD';

export default function TestimonialsSection() {
  return <GenericCRUD config={{
    entity: 'testimonials',
    title: 'Testimonials',
    description: 'Client testimonials displayed on the public site.',
    addLabel: 'Add testimonial',
    emptyTitle: 'No testimonials yet',
    emptyBody: 'Add your first client quote.',
    columns: [
      { key: 'name', label: 'Client', render: (r: any) => (
        <div>
          <div className="adm-table-title">{r.name}</div>
          <div className="adm-table-sub">{[r.role, r.company].filter(Boolean).join(' · ')}</div>
        </div>
      )},
      { key: 'quote', label: 'Quote', render: (r: any) => <span className="adm-muted" style={{ fontSize: '0.82rem' }}>{(r.testimonial||'').slice(0,80)}{(r.testimonial||'').length>80?'…':''}</span> },
      { key: 'featured', label: 'Featured', render: (r: any) => r.isFeatured ? <span className="adm-badge featured"><Star size={11}/>Featured</span> : <span className="adm-muted">—</span> },
      { key: 'published', label: 'Status', render: (r: any) => r.isPublished
        ? <span className="adm-badge published"><CheckCircle2 size={11}/>Published</span>
        : <span className="adm-badge draft"><XCircle size={11}/>Draft</span> },
    ],
    fields: [
      { key: 'name', label: 'Client name', required: true },
      { key: 'role', label: 'Role / title' },
      { key: 'company', label: 'Company' },
      { key: 'photo', label: 'Photo URL', type: 'url' },
      { key: 'testimonial', label: 'Quote', type: 'textarea', required: true, placeholder: 'The client’s words…' },
      { key: 'relatedProjectId', label: 'Related project ID' },
      { key: 'order', label: 'Order', type: 'number', initial: 0 },
      { key: 'isFeatured', label: 'Featured', type: 'checkbox' },
      { key: 'isPublished', label: 'Published', type: 'checkbox', initial: true },
    ],
  }}/>;
}
