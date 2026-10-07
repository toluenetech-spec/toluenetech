import React, { useEffect, useState } from 'react';
import { FolderKanban, Plus, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../../lib/admin';
import DataTable from '../DataTable';
import { Button, Drawer, useConfirm, useToast } from '../UI';

const JOB_STATUSES = ['ACTIVE','PAUSED','COMPLETED','ARCHIVED'];

export default function JobsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);

  const load = () => Promise.all([api.list('client-projects'), api.list('clients')])
    .then(([jp, cl]) => { setItems(jp.items); setClients(cl.items); })
    .catch(e => toast.push('error','Failed to load',''+e.message));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ title:'', clientId: clients[0]?.id || '', description:'', status:'ACTIVE', progress:0, startDate:'', dueDate:'' }); setIsNew(true); setEditing({}); };
  const openEdit = (r: any) => { setForm({ ...r }); setIsNew(false); setEditing(r); };
  const close = () => { setEditing(null); setForm({}); setIsNew(false); };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const data = { ...form, progress: Number(form.progress) || 0 };
      if (isNew) {
        const c = await api.create('client-projects', data); setItems(prev => [c, ...(prev||[])]); toast.push('success','Job created');
      } else {
        const u = await api.update('client-projects', editing.id, data); setItems(prev => (prev||[]).map(x => x.id === editing.id ? u : x)); toast.push('success','Saved');
      }
      close();
    } catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setSaving(false); }
  };
  const remove = async (r: any) => {
    const ok = await confirm.confirm({ title:'Delete job?', message:`"${r.title}" will be permanently removed.`, confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.remove('client-projects', r.id); setItems(prev => (prev||[]).filter(x => x.id !== r.id)); toast.push('success','Deleted'); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };
  const clientName = (id: string) => clients.find(c => c.id === id)?.name || '—';

  return (<>
    <DataTable title="Projects / Jobs" description="Active client engagements." items={items}
      addLabel="New job" onAdd={openNew} onEdit={openEdit} onDelete={remove}
      emptyTitle="No jobs yet" emptyBody="Add the first client project." emptyIcon={FolderKanban}
      columns={[
        { key:'title', label:'Job', render:(r:any)=>(
          <div>
            <div className="adm-table-title">{r.title}</div>
            <div className="adm-table-sub">{clientName(r.clientId)}</div>
          </div>
        )},
        { key:'status', label:'Status', render:(r:any)=><span className={`adm-badge ${(r.status||'').toLowerCase()}`}>{(r.status||'').replace('_',' ')}</span> },
        { key:'progress', label:'Progress', render:(r:any)=>(
          <div style={{ minWidth:120 }}>
            <div style={{ height:6, background:'var(--line)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ width:`${r.progress||0}%`, height:'100%', background:'var(--brand-accent)' }}/>
            </div>
            <div className="adm-muted" style={{ fontSize:'0.72rem', marginTop:2 }}>{r.progress||0}%</div>
          </div>
        )},
        { key:'due', label:'Due', render:(r:any)=><span className="adm-muted" style={{fontSize:'0.8rem'}}>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</span> },
      ]}/>
    <Drawer open={!!editing} onClose={close} title={isNew ? 'New job' : form.title}
      footer={<>
        <Button variant="ghost" onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving || !form.title || !form.clientId}>{saving?'Saving…':'Save'}</Button>
      </>}>
      <div className="adm-grid-2">
        <div className="adm-field" style={{ gridColumn:'1 / -1' }}><label className="adm-label">Title *</label><input className="adm-input" value={form.title||''} onChange={e=>set('title',e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Client *</label>
          <select className="adm-select" value={form.clientId||''} onChange={e=>set('clientId',e.target.value)}>
            <option value="">— select client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="adm-field"><label className="adm-label">Status</label>
          <select className="adm-select" value={form.status||'ACTIVE'} onChange={e=>set('status',e.target.value)}>
            {JOB_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
        <div className="adm-field"><label className="adm-label">Progress (%)</label><input type="number" min="0" max="100" className="adm-input" value={form.progress??0} onChange={e=>set('progress',Number(e.target.value))}/></div>
        <div className="adm-field"><label className="adm-label">Start date</label><input type="date" className="adm-input" value={(form.startDate||'').slice(0,10)} onChange={e=>set('startDate',e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Due date</label><input type="date" className="adm-input" value={(form.dueDate||'').slice(0,10)} onChange={e=>set('dueDate',e.target.value)}/></div>
        <div className="adm-field" style={{ gridColumn:'1 / -1' }}><label className="adm-label">Description</label><textarea className="adm-textarea" rows={3} value={form.description||''} onChange={e=>set('description',e.target.value)}/></div>
      </div>
    </Drawer>
  </>);
}
