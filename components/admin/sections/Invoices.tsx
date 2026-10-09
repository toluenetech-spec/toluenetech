import React, { useEffect, useMemo, useState } from 'react';
import { Receipt, Plus, Download, Send, Trash2, Pencil, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/admin';
import DataTable from '../DataTable';
import { Badge, Button, Drawer, EmptyState, Modal, useConfirm, useToast } from '../UI';

const STATUSES = ['DRAFT','SENT','VIEWED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','VOID'] as const;

const emptyLine = () => ({ id: crypto.randomUUID(), kind: 'CUSTOM', description: '', quantity: 1, unitPriceCents: 0, amountCents: 0 });

function fmtMoney(cents: number, cur = 'USD') {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format((cents || 0) / 100); }
  catch { return `${(cents || 0) / 100} ${cur}`; }
}

export default function InvoicesSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const load = () => api.invoices().then(d => setItems(d.items)).catch(e => toast.push('error','Failed to load invoices',e.message));
  useEffect(() => {
    load();
    Promise.all([api.list('clients'), api.clientProjects()])
      .then(([c, p]) => { setClients(c.items); setProjects(p.items); })
      .catch(() => {});
  }, []);

  const openNew = () => {
    setForm({ clientId: '', projectId: '', status: 'DRAFT', currency: 'USD', dueDate: '', notes: '',
      taxCents: 0, discountCents: 0, items: [emptyLine()] });
    setIsNew(true); setEditing({});
  };
  const openEdit = async (r: any) => {
    try {
      const full = await api.invoice(r.id);
      setForm({
        ...full.item,
        items: full.items.length ? full.items.map((li: any) => ({ ...li })) : [emptyLine()],
      });
      setIsNew(false); setEditing(full.item);
    } catch (e: any) { toast.push('error','Load failed',e.message); }
  };
  const close = () => { setEditing(null); setForm(null); setIsNew(false); };

  const set = (k: string, v: any) => setForm((f: any) => (f ? { ...f, [k]: v } : f));
  const setItem = (idx: number, patch: any) => setForm((f: any) => {
    if (!f) return f;
    const items = f.items.slice();
    const prev = items[idx] || {};
    const next = { ...prev, ...patch };
    if (patch.quantity !== undefined || patch.unitPriceCents !== undefined) {
      const q = Number(next.quantity) || 0;
      const up = Number(next.unitPriceCents) || 0;
      next.amountCents = Math.round(q * up);
    }
    items[idx] = next;
    return { ...f, items };
  });
  const addItem = () => setForm((f: any) => f ? { ...f, items: [...f.items, emptyLine()] } : f);
  const removeItem = (idx: number) => setForm((f: any) => f ? { ...f, items: f.items.filter((_: any, i: number) => i !== idx) } : f);

  const subtotal = useMemo(() => (form?.items || []).reduce((s: number, li: any) => s + (Number(li.amountCents) || 0), 0), [form]);
  const tax = Number(form?.taxCents) || 0;
  const disc = Number(form?.discountCents) || 0;
  const total = Math.max(0, subtotal + tax - disc);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId,
        projectId: form.projectId || null,
        status: form.status || 'DRAFT',
        currency: form.currency || 'USD',
        dueDate: form.dueDate || null,
        notes: form.notes || null,
        taxCents: Number(form.taxCents) || 0,
        discountCents: Number(form.discountCents) || 0,
        amountCents: total,
        items: form.items.filter((li: any) => li.description && li.description.trim()).map((li: any) => ({
          kind: li.kind || 'CUSTOM',
          description: li.description,
          quantity: Number(li.quantity) || 1,
          unitPriceCents: Number(li.unitPriceCents) || 0,
          amountCents: Number(li.amountCents) || 0,
        })),
      };
      if (isNew) {
        await api.createInvoice(payload);
        toast.push('success','Invoice created');
      } else {
        await api.updateInvoice(editing.id, payload);
        toast.push('success','Invoice saved');
      }
      close();
      load();
    } catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setSaving(false); }
  };

  const send = async (r: any) => {
    const ok = await confirm.confirm({ title:'Send invoice?', message:`Invoice ${r.number} will be marked SENT and the client will be notified.`, confirmLabel:'Send' });
    if (!ok) return;
    try { await api.sendInvoice(r.id); toast.push('success','Invoice sent'); load(); }
    catch (e: any) { toast.push('error','Send failed',e.message); }
  };
  const remove = async (r: any) => {
    const ok = await confirm.confirm({ title:'Delete invoice?', message:`${r.number} will be permanently removed.`, confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.deleteInvoice(r.id); toast.push('success','Deleted'); load(); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || '—';
  const projectName = (id: string) => projects.find(p => p.id === id)?.title || '—';

  return (<>
    <DataTable title="Invoices" description="Client invoices and payment status." items={items}
      addLabel="New invoice" onAdd={openNew}
      emptyTitle="No invoices" emptyBody="Create the first client invoice." emptyIcon={Receipt}
      columns={[
        { key:'number', label:'Invoice', render:(r:any) => (
          <div>
            <div className="adm-table-title">{r.number}</div>
            <div className="adm-table-sub">{clientName(r.clientId)} · {projectName(r.projectId)}</div>
          </div>
        )},
        { key:'status', label:'Status', render:(r:any)=><Badge className={`status-${(r.status||'').toLowerCase()}`}>{(r.status||'').replace(/_/g,' ')}</Badge> },
        { key:'amount', label:'Amount', render:(r:any)=><span style={{ fontWeight:600 }}>{fmtMoney(r.amountCents, r.currency)}</span> },
        { key:'due', label:'Due', render:(r:any)=><span className="adm-muted" style={{fontSize:'0.8rem'}}>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</span> },
        { key:'_actions', label:'', render:(r:any)=>(
          <div style={{ display:'flex', gap:'0.25rem', justifyContent:'flex-end' }}>
            {r.status === 'DRAFT' && (
              <button className="adm-btn adm-btn-ghost adm-btn-icon" title="Send" onClick={() => send(r)}><Send size={13}/></button>
            )}
            <button className="adm-btn adm-btn-ghost adm-btn-icon" title="Edit" onClick={() => openEdit(r)}><Pencil size={13}/></button>
            <button className="adm-btn adm-btn-ghost adm-btn-icon" title="Delete" onClick={() => remove(r)}><Trash2 size={13}/></button>
          </div>
        )},
      ]}/>

    <Drawer open={!!editing} onClose={close} title={isNew ? 'New invoice' : `Invoice ${form?.number || ''}`}
      footer={<>
        <Button variant="ghost" onClick={close}>Cancel</Button>
        {!isNew && form?.status === 'DRAFT' && (
          <Button variant="accent" icon={<Send size={14}/>} onClick={async () => { await save(); await api.sendInvoice(editing.id); toast.push('success','Sent'); close(); load(); }}>Save & send</Button>
        )}
        <Button variant="primary" onClick={save} disabled={saving || !form?.clientId}>{saving?'Saving…':'Save'}</Button>
      </>}>
      {form && (<>
        <div className="adm-grid-2">
          <div className="adm-field"><label className="adm-label">Client *</label>
            <select className="adm-select" value={form.clientId||''} onChange={e => set('clientId', e.target.value)}>
              <option value="">— select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="adm-field"><label className="adm-label">Project</label>
            <select className="adm-select" value={form.projectId||''} onChange={e => set('projectId', e.target.value)}>
              <option value="">— none —</option>
              {projects.filter(p => !form.clientId || p.clientId === form.clientId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="adm-field"><label className="adm-label">Status</label>
            <select className="adm-select" value={form.status||'DRAFT'} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div className="adm-field"><label className="adm-label">Currency</label>
            <select className="adm-select" value={form.currency||'USD'} onChange={e => set('currency', e.target.value)}>
              <option value="USD">USD</option><option value="NGN">NGN</option><option value="GBP">GBP</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div className="adm-field"><label className="adm-label">Due date</label>
            <input type="date" className="adm-input" value={(form.dueDate||'').slice(0,10)} onChange={e => set('dueDate', e.target.value)}/>
          </div>
        </div>

        <div className="adm-detail-section" style={{ marginTop:'1rem' }}>
          <h4>Line items</h4>
          <div style={{ border:'1px solid var(--line)', borderRadius:8, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 90px 110px 110px 30px', padding:'0.5rem 0.75rem', background:'var(--bg-soft)', fontSize:'0.72rem', fontWeight:600, color:'var(--muted)' }}>
              <div>Description</div><div style={{textAlign:'right'}}>Qty</div><div style={{textAlign:'right'}}>Unit</div><div style={{textAlign:'right'}}>Amount</div><div/>
            </div>
            {form.items.map((li: any, i: number) => (
              <div key={li.id || i} style={{ display:'grid', gridTemplateColumns:'2fr 90px 110px 110px 30px', gap:'0.4rem', padding:'0.4rem 0.75rem', borderTop:'1px solid var(--line)', alignItems:'center' }}>
                <input className="adm-input" placeholder="Item description" value={li.description||''} onChange={e => setItem(i, { description: e.target.value })}/>
                <input type="number" step="0.01" min="0" className="adm-input" style={{textAlign:'right'}} value={li.quantity||1} onChange={e => setItem(i, { quantity: Number(e.target.value) })}/>
                <input type="number" min="0" className="adm-input" style={{textAlign:'right'}} value={Math.round((Number(li.unitPriceCents)||0)/1)/1} onChange={e => setItem(i, { unitPriceCents: Math.round(Number(e.target.value)||0) })}/>
                <div style={{textAlign:'right', fontWeight:600, fontSize:'0.85rem'}}>{fmtMoney(Number(li.amountCents)||0, form.currency)}</div>
                <button className="adm-btn adm-btn-ghost adm-btn-icon" onClick={() => removeItem(i)} disabled={form.items.length===1}><X size={12}/></button>
              </div>
            ))}
            <div style={{ padding:'0.4rem 0.75rem', borderTop:'1px solid var(--line)' }}>
              <button className="adm-btn adm-btn-ghost adm-btn-sm" onClick={addItem}><Plus size={12}/> Add line</button>
            </div>
          </div>
        </div>

        <div className="adm-grid-2" style={{ marginTop:'1rem' }}>
          <div className="adm-field"><label className="adm-label">Tax (cents)</label>
            <input type="number" min="0" className="adm-input" value={form.taxCents||0} onChange={e => set('taxCents', Math.round(Number(e.target.value)||0))}/>
          </div>
          <div className="adm-field"><label className="adm-label">Discount (cents)</label>
            <input type="number" min="0" className="adm-input" value={form.discountCents||0} onChange={e => set('discountCents', Math.round(Number(e.target.value)||0))}/>
          </div>
        </div>

        <div style={{ marginTop:'0.75rem', padding:'0.85rem 1rem', border:'1px solid var(--line)', borderRadius:8, background:'var(--bg-soft)', fontSize:'0.85rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span className="adm-muted">Subtotal</span><span>{fmtMoney(subtotal, form.currency)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span className="adm-muted">Tax</span><span>{fmtMoney(tax, form.currency)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span className="adm-muted">Discount</span><span>-{fmtMoney(disc, form.currency)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, marginTop:'0.4rem', paddingTop:'0.4rem', borderTop:'1px solid var(--line)' }}>
            <span>Total</span><span>{fmtMoney(total, form.currency)}</span>
          </div>
        </div>

        <div className="adm-field" style={{ marginTop:'1rem' }}>
          <label className="adm-label">Notes</label>
          <textarea className="adm-textarea" rows={3} value={form.notes||''} onChange={e => set('notes', e.target.value)}/>
        </div>
      </>)}
    </Drawer>
  </>);
}
