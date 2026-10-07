import React from 'react';
import { Package, CheckCircle2, XCircle } from 'lucide-react';
import { GenericCRUD } from './GenericCRUD';

const STATUSES = ['IDEA','PROTOTYPE','IN_DEV','BETA','LIVE','ARCHIVED'];

export default function ProductsSection() {
  return <GenericCRUD config={{
    entity: 'products',
    title: 'Products',
    description: 'Product portfolio (e.g. launches, side projects).',
    addLabel: 'Add product',
    emptyTitle: 'No products',
    emptyBody: 'Add your first product entry.',
    columns: [
      { key: 'name', label: 'Product', render: (r: any) => (
        <div>
          <div className="adm-table-title">{r.name}</div>
          <div className="adm-table-sub">{(r.description||'').slice(0,70)}{(r.description||'').length>70?'…':''}</div>
        </div>
      )},
      { key: 'status', label: 'Status', render: (r: any) => <span className={`adm-badge ${(r.status||'').toLowerCase()}`}>{r.status}</span> },
      { key: 'published', label: 'Visibility', render: (r: any) => r.isPublished
        ? <span className="adm-badge published"><CheckCircle2 size={11}/>Published</span>
        : <span className="adm-badge draft"><XCircle size={11}/>Hidden</span> },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'slug', label: 'Slug' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'logo', label: 'Logo URL', type: 'url' },
      { key: 'demoUrl', label: 'Demo URL', type: 'url' },
      { key: 'websiteUrl', label: 'Website URL', type: 'url' },
      { key: 'features', label: 'Features', type: 'tags' },
      { key: 'techStack', label: 'Tech stack', type: 'tags' },
      { key: 'status', label: 'Status', type: 'select', options: STATUSES.map(s => ({ value: s, label: s })), initial: 'IDEA' },
      { key: 'order', label: 'Order', type: 'number', initial: 0 },
      { key: 'isPublished', label: 'Published', type: 'checkbox' },
    ],
    beforeSave: (data) => ({ ...data, slug: data.slug || String(data.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'prod-' + Math.random().toString(36).slice(2,8)) }),
  }}/>;
}
