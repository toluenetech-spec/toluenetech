import React, { useEffect, useState } from 'react';
import { Tags } from 'lucide-react';
import DataTable, { TitleCell } from '../DataTable';
import { api } from '../../../lib/admin';
import { Button, Drawer, useConfirm, useToast } from '../UI';

export default function ProjectCategoriesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.list('project-categories', q ? { q } : undefined)
      .then(d => setItems(d.items))
      .catch(e => toast.push('error', 'Failed to load categories', e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const blank = { name: '', slug: '', description: '', color: '', icon: '', isPublished: true, order: 0 };
  const openNew = () => { setForm({ ...blank }); setIsNew(true); setEditing({}); };
  const openEdit = (r: any) => { setForm({ ...blank, ...r }); setIsNew(false); setEditing(r); };
  const close = () => { setEditing(null); setForm({}); setIsNew(false); };

  const save = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        slug: form.slug || String(form.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'cat-' + Math.random().toString(36).slice(2,6)),
        order: Number.isInteger(Number(form.order)) ? Number(form.order) : 0,
        isPublished: !!form.isPublished,
      };
      if (isNew) {
        const created = await api.create('project-categories', data);
        setItems(prev => [created, ...(prev || [])]); toast.push('success', 'Category created');
      } else {
        const updated = await api.update('project-categories', editing.id, data);
        setItems(prev => (prev || []).map(x => x.id === editing.id ? updated : x)); toast.push('success', 'Saved');
      }
      close();
    } catch (e: any) { toast.push('error', 'Save failed', e.message); }
    finally { setSaving(false); }
  };
  const remove = async (r: any) => {
    const ok = await confirm.confirm({ title: 'Delete category?', message: `Projects assigned to "${r.name}" will become uncategorized.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await api.remove('project-categories', r.id); setItems(prev => (prev || []).filter(x => x.id !== r.id)); toast.push('success', 'Deleted'); }
    catch (e: any) { toast.push('error', 'Delete failed', e.message); }
  };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (<>
    <DataTable
      title="Project Categories"
      description="Manage the filterable categories shown on the public Portfolio page. Assign a category to each project on the Portfolio page."
      items={items}
      searchable
      searchPlaceholder="Search categories…"
      searchValue={q}
      onSearchChange={setQ}
      emptyTitle="No categories yet"
      emptyBody="Add your first portfolio category."
      emptyIcon={Tags}
      addLabel="Add category"
      onAdd={openNew}
      onEdit={openEdit}
      onDelete={remove}
      columns={[
        { key: 'name', label: 'Name', render: (r: any) => <TitleCell title={r.name} sub={`/projects?category=${r.slug}`}/> },
        { key: 'order', label: 'Order', render: (r: any) => <span className="adm-muted">#{r.order ?? 0}</span> },
        { key: 'published', label: 'Visibility', render: (r: any) => r.isPublished
          ? <span className="adm-badge published">Visible</span>
          : <span className="adm-badge draft">Hidden</span> },
      ]}
    />
    <Drawer open={!!editing} onClose={close} title={isNew ? 'New category' : (form.name || 'Edit category')}
      footer={<><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" onClick={save} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</Button></>}>
      <div className="adm-grid-2">
        <div className="adm-field"><label className="adm-label">Name *</label><input className="adm-input" value={form.name||''} onChange={e => set('name', e.target.value)} placeholder="e.g. Web Apps"/></div>
        <div className="adm-field"><label className="adm-label">Slug</label><input className="adm-input" value={form.slug||''} onChange={e => set('slug', e.target.value)} placeholder="auto"/></div>
        <div className="adm-field"><label className="adm-label">Order</label><input type="number" className="adm-input" value={form.order??0} onChange={e => set('order', Number(e.target.value))}/></div>
        <div className="adm-field"><label className="adm-label">Color (hex)</label><input className="adm-input" value={form.color||''} onChange={e => set('color', e.target.value)} placeholder="#3b82f6"/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label className="adm-label">Description</label><textarea className="adm-textarea" rows={2} value={form.description||''} onChange={e => set('description', e.target.value)}/></div>
        <label className="adm-flex-center" style={{ gap: '0.6rem', cursor: 'pointer' }}><input type="checkbox" checked={!!form.isPublished} onChange={e => set('isPublished', e.target.checked)}/><span style={{ fontSize: '0.87rem' }}>Visible in public portfolio filters</span></label>
      </div>
    </Drawer>
  </>);
}
