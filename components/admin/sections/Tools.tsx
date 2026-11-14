import React from 'react';
import { CheckCircle2, XCircle, Wrench } from 'lucide-react';
import { GenericCRUD } from './GenericCRUD';

const CATEGORIES = ['Frontend','Backend','Mobile','Database','AI/ML','DevOps','Design','Cloud','Productivity','Testing','Development'];

export default function ToolsSection() {
  return <GenericCRUD config={{
    entity: 'tools',
    title: 'Tech Stack / Tools',
    description: 'Tools and technologies shown publicly (e.g. /technology). Only published items appear publicly.',
    addLabel: 'Add tool',
    emptyTitle: 'No tools yet',
    emptyBody: 'Add tools or technologies to display on the public site.',
    searchPlaceholder: 'Search tools…',
    columns: [
      { key: 'name', label: 'Tool', render: (r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {r.logoUrl ? <img src={r.logoUrl} alt="" style={{ width: 22, height: 22, objectFit: 'contain' }}/> : <Wrench size={16}/>}
          <div>
            <div className="adm-table-title">{r.name}</div>
            <div className="adm-table-sub">{r.category}</div>
          </div>
        </div>
      )},
      { key: 'published', label: 'Status', render: (r: any) => r.isPublished
        ? <span className="adm-badge published"><CheckCircle2 size={11}/>Public</span>
        : <span className="adm-badge draft"><XCircle size={11}/>Hidden</span> },
      { key: 'order', label: 'Order', render: (r: any) => <span className="adm-muted">{r.order ?? 0}</span> },
    ],
    fields: [
      { key: 'name', label: 'Name', required: true, type: 'text', placeholder: 'e.g. React' },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES.map(c => ({ value: c, label: c })) },
      { key: 'logoUrl', label: 'Logo URL', type: 'text' },
      { key: 'websiteUrl', label: 'Website URL', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'order', label: 'Display order', type: 'number', initial: 0 },
      { key: 'isPublished', label: 'Published (visible publicly)', type: 'checkbox', initial: true },
    ],
  }}/>;
}
