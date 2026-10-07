import React, { useEffect, useState } from 'react';
import { Users, Plus, Mail, Phone, Building2, Copy, Check, Eye } from 'lucide-react';
import { api } from '../../../lib/admin';
import DataTable, { TitleCell } from '../DataTable';
import { Button, Drawer, useConfirm, useToast, Badge } from '../UI';

export default function ClientsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopied] = useState<string | null>(null);

  const load = () => api.list('clients', q ? { q } : undefined).then(d => setItems(d.items)).catch(e => toast.push('error','Failed to load clients',e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const openNew = () => { setForm({ name:'', email:'', phone:'', company:'', status:'ACTIVE' }); setIsNew(true); setEditing({}); };
  const openView = async (r: any) => {
    try { const full = await api.get('clients', r.id); setForm(full); setIsNew(false); setEditing(full); }
    catch (e: any) { toast.push('error','Load failed',e.message); }
  };
  const close = () => { setEditing(null); setForm({}); setIsNew(false); };
  const save = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.create('clients', form);
        setItems(prev => [created, ...(prev||[])]);
        toast.push('success','Client created', `Access code: ${created.accessCode}`);
      } else {
        // Don't send accessCode back
        const { accessCode, projects, ...patch } = form;
        const updated = await api.update('clients', editing.id, patch);
        setItems(prev => (prev||[]).map(x => x.id === editing.id ? updated : x));
        toast.push('success','Saved');
      }
      close();
    } catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setSaving(false); }
  };
  const remove = async (r: any) => {
    const ok = await confirm.confirm({ title:'Delete client?', message:`This will remove ${r.name} and revoke their portal access.`, confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.remove('clients', r.id); setItems(prev => (prev||[]).filter(x => x.id !== r.id)); toast.push('success','Deleted'); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };
  const copyCode = async (code: string, id: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch {}
  };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (<>
    <DataTable title="Clients" description="Clients with access to the portal and active projects." items={items}
      searchable searchPlaceholder="Search clients…" searchValue={q} onSearchChange={setQ}
      addLabel="Add client" onAdd={openNew} onEdit={openView} onDelete={remove}
      emptyTitle="No clients yet" emptyBody="Add a client to grant them portal access." emptyIcon={Users}
      columns={[
        { key:'name', label:'Client', render:(r:any)=><TitleCell title={r.name} sub={r.email}/> },
        { key:'company', label:'Company', render:(r:any)=><span className="adm-muted">{r.company||'—'}</span> },
        { key:'status', label:'Status', render:(r:any)=><span className={`adm-badge ${(r.status||'').toLowerCase()}`}>{r.status}</span> },
        { key:'date', label:'Added', render:(r:any)=><span className="adm-muted" style={{fontSize:'0.8rem'}}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</span> },
      ]}/>
    <Drawer open={!!editing} onClose={close} title={isNew ? 'New client' : (form.name || 'Client details')}
      footer={<>
        <Button variant="ghost" onClick={close}>Close</Button>
        {!isNew && form.accessCode && <Button variant="secondary" icon={copiedId===form.id?<Check size={14}/>:<Copy size={14}/>} onClick={() => copyCode(form.accessCode, form.id)}>{copiedId===form.id?'Copied':'Copy code'}</Button>}
        <Button variant="primary" onClick={save} disabled={saving || !form.name || !form.email}>{saving?'Saving…': isNew ? 'Create client' : 'Save'}</Button>
      </>}>
      {isNew ? (
        <div className="adm-grid-2">
          <div className="adm-field"><label className="adm-label">Name *</label><input className="adm-input" value={form.name||''} onChange={e => set('name',e.target.value)}/></div>
          <div className="adm-field"><label className="adm-label">Email *</label><input type="email" className="adm-input" value={form.email||''} onChange={e => set('email',e.target.value)}/></div>
          <div className="adm-field"><label className="adm-label">Phone</label><input className="adm-input" value={form.phone||''} onChange={e => set('phone',e.target.value)}/></div>
          <div className="adm-field"><label className="adm-label">Company</label><input className="adm-input" value={form.company||''} onChange={e => set('company',e.target.value)}/></div>
          <div className="adm-field" style={{ gridColumn:'1 / -1' }}>
            <div className="adm-label-hint">After creating, an access code will be generated for you to share.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="adm-detail-section">
            <h4>Contact</h4>
            <dl className="adm-kv">
              <dt>Name</dt><dd>{form.name}</dd>
              <dt><Mail size={13} style={{ verticalAlign:-2, marginRight:4 }}/>Email</dt><dd><a className="adm-link" href={`mailto:${form.email}`}>{form.email}</a></dd>
              {form.phone && <><dt><Phone size={13} style={{ verticalAlign:-2, marginRight:4 }}/>Phone</dt><dd>{form.phone}</dd></>}
              {form.company && <><dt><Building2 size={13} style={{ verticalAlign:-2, marginRight:4 }}/>Company</dt><dd>{form.company}</dd></>}
              <dt>Access code</dt><dd><span className="adm-mono" style={{ fontSize:'0.85rem', padding:'0.1rem 0.4rem', background:'var(--bg-soft)', borderRadius:4 }}>{form.accessCode || '(generated on create)'}</span></dd>
              <dt>Status</dt><dd><Badge>{form.status}</Badge></dd>
            </dl>
          </div>
          {form.projects && form.projects.length > 0 && (
            <div className="adm-detail-section">
              <h4>Projects ({form.projects.length})</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {form.projects.map((p: any) => (
                  <div key={p.id} style={{ padding:'0.55rem 0.7rem', border:'1px solid var(--line)', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'0.88rem' }}>{p.title}</div>
                      <div className="adm-muted" style={{ fontSize:'0.75rem' }}>{p.progress}% · {p.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Drawer>
  </>);
}
