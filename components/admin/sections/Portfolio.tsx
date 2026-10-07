import React, { useEffect, useState } from 'react';
import { FolderKanban, Image as ImageIcon, CheckCircle2, XCircle, Star, ExternalLink, Github } from 'lucide-react';
import DataTable, { TitleCell } from '../DataTable';
import { api } from '../../../lib/admin';
import { Button, Drawer, useConfirm, useToast } from '../UI';

const STATUS_OPTS = ['ACTIVE','PAUSED','COMPLETED','ARCHIVED'];

export default function PortfolioSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.list('projects', q ? { q } : undefined)
      .then(d => setItems(d.items))
      .catch(e => toast.push('error', 'Failed to load projects', e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const blank = { title: '', slug: '', clientName: '', role: '', platform: '', framework: '', status: 'ACTIVE',
    coverImage: '', gallery: [], videoUrl: '', challenge: '', objective: '', solution: '', features: [], results: '',
    metrics: [], liveUrl: '', githubUrl: '', appStoreUrl: '', playStoreUrl: '', serviceIds: [],
    isPublished: false, isFeatured: false, hasClientPermission: false, order: 0,
    seoTitle: '', seoDescription: '' };
  const openNew = () => { setForm({ ...blank }); setIsNew(true); setEditing({}); };
  const openEdit = (r: any) => { setForm({ ...blank, ...r }); setIsNew(false); setEditing(r); };
  const close = () => { setEditing(null); setForm({}); setIsNew(false); };

  const save = async () => {
    setSaving(true);
    try {
      const features = typeof form.features === 'string' ? form.features.split(',').map((s: string) => s.trim()).filter(Boolean) : form.features;
      const data = { ...form, features, slug: form.slug || String(form.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, 'prj-' + Math.random().toString(36).slice(2,8)) };
      if (isNew) {
        const created = await api.create('projects', data);
        setItems(prev => [created, ...(prev || [])]); toast.push('success', 'Project created');
      } else {
        const updated = await api.update('projects', editing.id, data);
        setItems(prev => (prev || []).map(x => x.id === editing.id ? updated : x)); toast.push('success', 'Saved');
      }
      close();
    } catch (e: any) { toast.push('error', 'Save failed', e.message); }
    finally { setSaving(false); }
  };
  const remove = async (r: any) => {
    const ok = await confirm.confirm({ title: 'Delete project?', message: `This will permanently remove "${r.title}".`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await api.remove('projects', r.id); setItems(prev => (prev || []).filter(x => x.id !== r.id)); toast.push('success', 'Deleted'); }
    catch (e: any) { toast.push('error', 'Delete failed', e.message); }
  };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (<>
    <DataTable
      title="Portfolio"
      description="Manage client work shown in the public portfolio and surfaced by Tolesh."
      items={items}
      searchable
      searchPlaceholder="Search projects…"
      searchValue={q}
      onSearchChange={setQ}
      emptyTitle="No projects yet"
      emptyBody="Add your first portfolio project."
      emptyIcon={FolderKanban}
      addLabel="Add project"
      onAdd={openNew}
      onEdit={openEdit}
      onDelete={remove}
      columns={[
        { key: 'title', label: 'Project', render: (r: any) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {r.coverImage
              ? <img src={r.coverImage} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--line)' }}/>
              : <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-soft)', display: 'grid', placeItems: 'center', color: 'var(--muted-soft)' }}><ImageIcon size={16}/></div>}
            <TitleCell title={r.title} sub={r.clientName || 'Anonymous'}/>
          </div>
        )},
        { key: 'status', label: 'Status', render: (r: any) => <span className={`adm-badge ${(r.status||'').toLowerCase()}`}>{(r.status||'').replace('_',' ')}</span> },
        { key: 'published', label: 'Visibility', render: (r: any) => r.isPublished
          ? <span className="adm-badge published"><CheckCircle2 size={11}/>Published</span>
          : <span className="adm-badge draft"><XCircle size={11}/>Draft</span> },
        { key: 'featured', label: 'Featured', render: (r: any) => r.isFeatured ? <span className="adm-badge featured"><Star size={11}/>Featured</span> : <span className="adm-muted">—</span> },
      ]}
    />
    <Drawer open={!!editing} onClose={close} title={isNew ? 'New project' : (form.title || 'Edit project')}
      footer={<>
        <Button variant="ghost" onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving || !form.title}>{saving ? 'Saving…' : 'Save'}</Button>
      </>}>
      <div className="adm-grid-2">
        <div className="adm-field"><label className="adm-label">Title *</label><input className="adm-input" value={form.title||''} onChange={e => set('title', e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Slug</label><input className="adm-input" value={form.slug||''} onChange={e => set('slug', e.target.value)} placeholder="auto"/></div>
        <div className="adm-field"><label className="adm-label">Client name</label><input className="adm-input" value={form.clientName||''} onChange={e => set('clientName', e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Role</label><input className="adm-input" value={form.role||''} onChange={e => set('role', e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Platform</label><input className="adm-input" value={form.platform||''} onChange={e => set('platform', e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Framework</label><input className="adm-input" value={form.framework||''} onChange={e => set('framework', e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Status</label>
          <select className="adm-select" value={form.status||'ACTIVE'} onChange={e => set('status', e.target.value)}>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
        <div className="adm-field"><label className="adm-label">Order</label><input type="number" className="adm-input" value={form.order??0} onChange={e => set('order', Number(e.target.value))}/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label className="adm-label">Cover image URL</label><input className="adm-input" value={form.coverImage||''} onChange={e => set('coverImage', e.target.value)} placeholder="https://…"/></div>
        <div className="adm-field"><label className="adm-label"><ExternalLink size={12} style={{ verticalAlign: -2 }}/> Live URL</label><input className="adm-input" value={form.liveUrl||''} onChange={e => set('liveUrl', e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label"><Github size={12} style={{ verticalAlign: -2 }}/> GitHub URL</label><input className="adm-input" value={form.githubUrl||''} onChange={e => set('githubUrl', e.target.value)}/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label className="adm-label">Challenge</label><textarea className="adm-textarea" rows={3} value={form.challenge||''} onChange={e => set('challenge', e.target.value)}/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label className="adm-label">Solution</label><textarea className="adm-textarea" rows={3} value={form.solution||''} onChange={e => set('solution', e.target.value)}/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label className="adm-label">Results</label><textarea className="adm-textarea" rows={3} value={form.results||''} onChange={e => set('results', e.target.value)}/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label className="adm-label">Features (comma-separated)</label><input className="adm-input" value={Array.isArray(form.features) ? form.features.join(', ') : (form.features||'')} onChange={e => set('features', e.target.value)}/></div>
        <label className="adm-flex-center" style={{ gap: '0.6rem', cursor: 'pointer' }}><input type="checkbox" checked={!!form.isPublished} onChange={e => set('isPublished', e.target.checked)}/><span style={{ fontSize: '0.87rem' }}>Published</span></label>
        <label className="adm-flex-center" style={{ gap: '0.6rem', cursor: 'pointer' }}><input type="checkbox" checked={!!form.isFeatured} onChange={e => set('isFeatured', e.target.checked)}/><span style={{ fontSize: '0.87rem' }}>Featured on home</span></label>
        <label className="adm-flex-center" style={{ gap: '0.6rem', cursor: 'pointer' }}><input type="checkbox" checked={!!form.hasClientPermission} onChange={e => set('hasClientPermission', e.target.checked)}/><span style={{ fontSize: '0.87rem' }}>Client permission to publish name/logo</span></label>
      </div>
    </Drawer>
  </>);
}
