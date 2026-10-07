import React from 'react';
import { Newspaper, CheckCircle2, XCircle, Star } from 'lucide-react';
import { GenericCRUD } from './GenericCRUD';

const CATS = ['AI','Web Development','UI/UX','Technology','Business Automation','Case Studies'];

export default function InsightsSection() {
  return <GenericCRUD config={{
    entity: 'insights',
    title: 'Insights / Blog',
    description: 'Articles and thought leadership. Markdown supported in content.',
    addLabel: 'Add insight',
    emptyTitle: 'No insights yet',
    emptyBody: 'Publish your first article.',
    columns: [
      { key: 'title', label: 'Title', render: (r: any) => (
        <div>
          <div className="adm-table-title">{r.title}</div>
          <div className="adm-table-sub">{r.excerpt ? (r.excerpt.slice(0,80)+(r.excerpt.length>80?'…':'')) : '—'}</div>
        </div>
      )},
      { key: 'cat', label: 'Category', render: (r: any) => <span className="adm-badge">{r.category}</span> },
      { key: 'draft', label: 'Status', render: (r: any) => r.isDraft
        ? <span className="adm-badge draft"><XCircle size={11}/>Draft</span>
        : <span className="adm-badge published"><CheckCircle2 size={11}/>Published</span> },
      { key: 'featured', label: 'Featured', render: (r: any) => r.isFeatured ? <span className="adm-badge featured"><Star size={11}/>Featured</span> : <span className="adm-muted">—</span> },
    ],
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'slug', label: 'Slug' },
      { key: 'excerpt', label: 'Excerpt', type: 'textarea' },
      { key: 'coverImage', label: 'Cover image URL', type: 'url' },
      { key: 'content', label: 'Content (Markdown)', type: 'textarea', help: 'Markdown supported.' },
      { key: 'author', label: 'Author' },
      { key: 'category', label: 'Category', type: 'select', options: CATS.map(c => ({ value: c, label: c })), initial: 'Technology' },
      { key: 'tags', label: 'Tags', type: 'tags' },
      { key: 'seoTitle', label: 'SEO title' },
      { key: 'seoDescription', label: 'SEO description', type: 'textarea' },
      { key: 'isDraft', label: 'Draft (not published)', type: 'checkbox', initial: true },
      { key: 'isFeatured', label: 'Featured', type: 'checkbox' },
    ],
    beforeSave: (data) => ({ ...data, slug: data.slug || String(data.title || 'insight').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'ins-' + Math.random().toString(36).slice(2,8)) }),
  }}/>;
}
