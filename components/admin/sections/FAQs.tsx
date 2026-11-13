import React from 'react';
import { HelpCircle, CheckCircle2, XCircle } from 'lucide-react';
import { GenericCRUD } from './GenericCRUD';

const CATEGORIES = ['General','Services','Pricing','AI','Projects','Support'];

export default function FAQsSection() {
  return <GenericCRUD config={{
    entity: 'faqs',
    title: 'FAQs',
    description: 'Frequently asked questions shown on /faq and used by Tolesh.',
    addLabel: 'Add FAQ',
    emptyTitle: 'No FAQs yet',
    emptyBody: 'Add common questions and answers.',
    columns: [
      { key: 'q', label: 'Question', render: (r: any) => <div className="adm-table-title">{r.question}</div> },
      { key: 'cat', label: 'Category', render: (r: any) => <span className="adm-badge">{r.category || 'General'}</span> },
      { key: 'published', label: 'Status', render: (r: any) => r.isPublished
        ? <span className="adm-badge published"><CheckCircle2 size={11}/>Published</span>
        : <span className="adm-badge draft"><XCircle size={11}/>Draft</span> },
      { key: 'order', label: 'Order', render: (r: any) => <span className="adm-muted">{r.order ?? 0}</span> },
    ],
    fields: [
      { key: 'question', label: 'Question', required: true, type: 'text' },
      { key: 'answer', label: 'Answer', required: true, type: 'textarea' },
      { key: 'category', label: 'Category', type: 'select', options: CATEGORIES.map(c => ({ value: c, label: c })), initial: 'General' },
      { key: 'order', label: 'Order', type: 'number', initial: 0 },
      { key: 'isPublished', label: 'Published', type: 'checkbox', initial: true },
    ],
  }}/>;
}
