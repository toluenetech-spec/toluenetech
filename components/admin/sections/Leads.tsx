import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Inbox, Plus, Mail, Phone, Building2, Calendar, DollarSign, Clock, FileText, Trash2, Pencil, User, ChevronRight, X, Check } from 'lucide-react';
import { api } from '../../../lib/admin';
import DataTable, { TitleCell, StatusCell } from '../DataTable';
import { Badge, Button, Drawer, EmptyState, Modal, SkeletonLine, useConfirm, useToast } from '../UI';

const STATUSES = ['NEW','CONTACTED','QUALIFIED','DISCOVERY','PROPOSAL','NEGOTIATION','WON','LOST','ARCHIVED'] as const;
const SOURCES = ['website-form','contact','service','portfolio','assistant','ai-lab','whatsapp','direct','referral','manual','other','unknown'] as const;

export default function LeadsSection() {
  const nav = useNavigate();
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [selected, setSelected] = useState<any | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const load = () => {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (status) params.status = status;
    if (source) params.source = source;
    api.list('leads', params).then(d => setItems(d.items)).catch(e => toast.push('error', 'Failed to load leads', e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status, source]);
  useEffect(() => {
    if (id) api.get('leads', id).then(setSelected).catch(() => setSelected(null));
    else setSelected(null);
  }, [id]);

  const filtered = useMemo(() => items || [], [items]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: items?.length || 0 };
    for (const s of STATUSES) c[s] = 0;
    for (const l of items || []) c[l.status] = (c[l.status] || 0) + 1;
    return c;
  }, [items]);

  const updateStatus = async (leadId: string, next: string) => {
    try {
      await api.updateLeadStatus(leadId, next);
      setItems(prev => (prev || []).map(l => l.id === leadId ? { ...l, status: next } : l));
      if (selected?.id === leadId) setSelected({ ...selected, status: next });
      toast.push('success', 'Status updated');
    } catch (e: any) { toast.push('error', 'Update failed', e.message); }
  };
  const saveNote = async () => {
    if (!selected || !noteDraft.trim()) return;
    const body = noteDraft.trim();
    try {
      await api.addLeadNote(selected.id, body, 'note');
      setNoteDraft('');
      toast.push('success', 'Note added to timeline');
      api.get('leads', selected.id).then(setSelected).catch(() => {});
    } catch (e: any) { toast.push('error', 'Could not add note', e.message); }
  };
  const convert = async () => {
    if (!selected) return;
    const ok = await confirm.confirm({
      title: 'Convert to client?',
      message: `This will mark ${selected.name} as WON and create (or link to) a client record with the same email. History is preserved.`,
      confirmLabel: 'Convert',
    });
    if (!ok) return;
    try {
      const res = await api.convertLead(selected.id, true);
      toast.push('success', 'Converted', `${selected.name} is now a client.`);
      setItems(prev => (prev || []).map(l => l.id === selected.id ? { ...l, status: 'WON', convertedClientId: res.data.client.id } : l));
      setSelected({ ...selected, status: 'WON', convertedClientId: res.data.client.id });
    } catch (e: any) { toast.push('error', 'Conversion failed', e.message); }
  };
  const remove = async (l: any) => {
    const ok = await confirm.confirm({ title: 'Archive lead?', message: `${l.name} (${l.ref}) will be marked as ARCHIVED. History is preserved — this is a soft archive, not a hard delete.`, confirmLabel: 'Archive', danger: true });
    if (!ok) return;
    try {
      await api.remove('leads', l.id);
      setItems(prev => (prev || []).map(x => x.id === l.id ? { ...x, status: 'ARCHIVED' } : x));
      toast.push('success', 'Lead archived');
      if (selected?.id === l.id) setSelected({ ...selected, status: 'ARCHIVED' });
    }
    catch (e: any) { toast.push('error', 'Archive failed', e.message); }
  };

  return (
    <>
      <div className="adm-page-header">
        <div>
          <div className="adm-page-title">Leads</div>
          <div className="adm-page-sub">{items ? `${items.length} total` : 'Loading…'}</div>
        </div>
        <div className="adm-page-actions">
          <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setAddOpen(true)}>New lead</Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        <FilterPill label={`All ${counts.ALL || ''}`} active={status === ''} onClick={() => setStatus('')}/>
        {STATUSES.map(s => (
          <FilterPill key={s} label={`${s.replace('_',' ')} ${counts[s] || 0}`} active={status === s} onClick={() => setStatus(status === s ? '' : s)}/>
        ))}
      </div>

      <DataTable
        title="Leads"
        items={filtered}
        searchable
        searchPlaceholder="Search by name, email, company or TT ref…"
        searchValue={q}
        onSearchChange={setQ}
        filter={
          <select className="adm-select adm-select-sm" value={source} onChange={e => setSource(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">All sources</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        }
        emptyTitle="No leads found"
        emptyBody="Leads captured from the Start a Project form, Tolesh AI and direct submissions will appear here."
        emptyIcon={Inbox}
        onAdd={() => setAddOpen(true)}
        addLabel="New lead"
        onEdit={(r) => nav(`/admin/leads/${r.id}`)}
        onDelete={remove}
        columns={[
          { key: 'name', label: 'Name', render: (r: any) => <TitleCell title={r.name} sub={<><span className="adm-mono">{r.ref}</span> · {r.email}</>}/> },
          { key: 'status', label: 'Status', render: (r: any) => <StatusCell status={r.status}/> },
          { key: 'source', label: 'Source', render: (r: any) => <Badge>{r.source || 'other'}</Badge> },
          { key: 'company', label: 'Company', render: (r: any) => <span className="adm-muted">{r.company || '—'}</span> },
          { key: 'date', label: 'Created', render: (r: any) => <span className="adm-muted" style={{ fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString()}</span> },
        ]}
      />

      <Drawer
        open={!!selected}
        onClose={() => { setSelected(null); nav('/admin/leads'); }}
        title={selected ? (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span>{selected.name}</span>
            <StatusCell status={selected.status}/>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 400, marginTop: 4 }}>
            <span className="adm-mono">{selected.ref}</span> · {selected.source || 'other'}
          </div>
        </>) : 'Lead details'}
        footer={selected && (
          <>
            <Button variant="ghost" onClick={() => { setSelected(null); nav('/admin/leads'); }}>Close</Button>
            {selected.status !== 'WON' && selected.status !== 'ARCHIVED' && (
              <Button variant="primary" icon={<Check size={14}/>} onClick={convert}>Convert to client</Button>
            )}
            <Button variant="danger" icon={<Trash2 size={14}/>} onClick={() => remove(selected)}>Archive</Button>
          </>
        )}
      >
        {selected && (
          <>
            <div className="adm-detail-section">
              <h4>Contact</h4>
              <dl className="adm-kv">
                <dt><User size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Name</dt><dd>{selected.name}</dd>
                <dt><Mail size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Email</dt>
                <dd><a className="adm-link" href={`mailto:${selected.email}`}>{selected.email}</a></dd>
                {selected.phone && <><dt><Phone size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Phone</dt>
                  <dd><a className="adm-link" href={`https://wa.me/${String(selected.phone).replace(/\D/g,'')}`} target="_blank" rel="noreferrer">{selected.phone}</a></dd></>}
                {selected.company && <><dt><Building2 size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Company</dt><dd>{selected.company}</dd></>}
                <dt><Calendar size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Created</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                {selected.sourcePage && <><dt>Source page</dt><dd style={{ wordBreak: 'break-all' }}><a className="adm-link" href={selected.sourcePage} target="_blank" rel="noreferrer">{selected.sourcePage}</a></dd></>}
                {selected.aiRef && <><dt>AI session</dt><dd className="adm-mono" style={{ fontSize: '0.75rem' }}>{selected.aiRef}</dd></>}
                {selected.convertedClientId && <><dt>Client</dt><dd><span className="adm-badge published">WON</span> <span className="adm-mono">{String(selected.convertedClientId).slice(0,8)}</span></dd></>}
              </dl>
            </div>

            <div className="adm-detail-section">
              <h4>Project</h4>
              <dl className="adm-kv">
                <dt>Services</dt><dd>{Array.isArray(selected.services) && selected.services.length ? selected.services.join(', ') : <span className="adm-muted">—</span>}</dd>
                {selected.budget && <><dt><DollarSign size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Budget</dt><dd>{selected.budget}</dd></>}
                {selected.timeline && <><dt><Clock size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Timeline</dt><dd>{selected.timeline}</dd></>}
                <dt><FileText size={13} style={{ verticalAlign: -2, marginRight: 4 }}/>Requirements</dt>
                <dd style={{ whiteSpace: 'pre-wrap' }}>{selected.requirements || <span className="adm-muted">—</span>}</dd>
              </dl>
            </div>

            <div className="adm-detail-section">
              <h4>Update status</h4>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} className={`adm-btn adm-btn-sm${selected.status === s ? ' adm-btn-primary' : ''}`} onClick={() => updateStatus(selected.id, s)}>
                    {selected.status === s && <Check size={12}/>}{s.replace('_',' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="adm-detail-section">
              <h4>Notes</h4>
              {selected.notes ? <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 8, padding: '0.75rem' }}>{selected.notes}</div>
                : <div className="adm-muted" style={{ fontSize: '0.84rem' }}>No notes yet.</div>}
              <textarea className="adm-textarea adm-mt-sm" rows={3} placeholder="Add a note…" value={noteDraft} onChange={e => setNoteDraft(e.target.value)}/>
              <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                <Button variant="primary" size="sm" onClick={saveNote} disabled={!noteDraft.trim()}>Save note</Button>
              </div>
            </div>
          </>
        )}
      </Drawer>

      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={(l) => { setAddOpen(false); setItems(prev => [l, ...(prev || [])]); toast.push('success', 'Lead created', `${l.ref} added`); nav(`/admin/leads/${l.id}`); }}/>
    </>
  );
}

function FilterPill({ label, active, onClick, ...rest }: { label: string; active?: boolean; onClick?: () => void; } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" onClick={onClick} className={`adm-subtab${active ? ' active' : ''}`} style={{ borderRadius: 999, border: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 0 }} {...rest}>{label}</button>
  );
}

function AddLeadModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (l: any) => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', services: [] as string[], budget: '', timeline: '', requirements: '', source: 'manual' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const svcOptions = ['Web Design','Frontend Development','UI/UX Design','App Design','App Development','Graphic Design','Video Editing','AI Integration & Automation','Other / Not sure'];
  const toggleSvc = (s: string) => setF(x => ({ ...x, services: x.services.includes(s) ? x.services.filter(v => v !== s) : [...x.services, s] }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const l = await api.create('leads', f);
      onCreated(l);
      setF({ name: '', email: '', phone: '', company: '', services: [], budget: '', timeline: '', requirements: '', source: 'manual' });
    } catch (e: any) { setErr(e.message); toast.push('error', 'Could not create lead', e.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New lead"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit as any} disabled={busy || !f.name || !f.email}>Create lead</Button>
      </>}>
      {err && <div style={{ color: '#dc2626', fontSize: '0.82rem' }}>{err}</div>}
      <form onSubmit={submit} className="adm-grid-2">
        <div className="adm-field"><label className="adm-label">Name *</label><input required className="adm-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })}/></div>
        <div className="adm-field"><label className="adm-label">Email *</label><input required type="email" className="adm-input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })}/></div>
        <div className="adm-field"><label className="adm-label">Phone</label><input className="adm-input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })}/></div>
        <div className="adm-field"><label className="adm-label">Company</label><input className="adm-input" value={f.company} onChange={e => setF({ ...f, company: e.target.value })}/></div>
        <div className="adm-field"><label className="adm-label">Budget</label><input className="adm-input" value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })}/></div>
        <div className="adm-field"><label className="adm-label">Timeline</label><input className="adm-input" value={f.timeline} onChange={e => setF({ ...f, timeline: e.target.value })}/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}>
          <label className="adm-label">Services</label>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {svcOptions.map(s => (
              <button type="button" key={s} className={`adm-btn adm-btn-sm${f.services.includes(s) ? ' adm-btn-primary' : ''}`} onClick={() => toggleSvc(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}>
          <label className="adm-label">Requirements</label>
          <textarea className="adm-textarea" rows={3} value={f.requirements} onChange={e => setF({ ...f, requirements: e.target.value })}/>
        </div>
      </form>
    </Modal>
  );
}
