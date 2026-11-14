import React, { useEffect, useState } from 'react';
import { BadgeDollarSign, CheckCircle2, Star, XCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import DataTable from '../DataTable';
import { api } from '../../../lib/admin';
import { Button, Drawer, useConfirm, useToast } from '../UI';

function priceToDollars(cents: number | null | undefined): string {
  if (cents == null) return 'Custom';
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

interface Plan {
  id: string; name: string; tagline?: string;
  priceMonthly?: number | null; priceOneTime?: number | null;
  currency?: string; features: string[];
  ctaLabel?: string; ctaUrl?: string;
  isFeatured: boolean; isPublished: boolean; order: number;
}

export default function PricingSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Plan[] | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = () => api.list('pricing').then(d => setItems(d.items)).catch(e => toast.push('error', 'Failed to load plans', e.message));
  useEffect(() => { load(); }, []);

  const blank = { name: '', tagline: '', priceMonthly: null, priceOneTime: null, currency: 'USD', features: [], ctaLabel: 'Start a project', ctaUrl: '', isFeatured: false, isPublished: true, order: 0 };
  const openNew = () => { setForm({ ...blank }); setIsNew(true); setEditing({} as any); };
  const openEdit = (r: Plan) => { setForm({ ...blank, ...r, priceMonthly: r.priceMonthly != null ? r.priceMonthly/100 : null, priceOneTime: r.priceOneTime != null ? r.priceOneTime/100 : null, features: r.features || [] }); setIsNew(false); setEditing(r); };
  const close = () => { setEditing(null); setForm({}); setIsNew(false); };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const toDollars = (v: any) => (v === '' || v == null) ? null : Math.round(Number(v) * 100);
      const data = {
        ...form,
        priceMonthly: toDollars(form.priceMonthly),
        priceOneTime: toDollars(form.priceOneTime),
        features: typeof form.features === 'string' ? form.features.split(',').map((s: string) => s.trim()).filter(Boolean) : form.features,
      };
      if (isNew) {
        const created = await api.create('pricing', data); setItems(prev => [created, ...(prev||[])]); toast.push('success','Plan created');
      } else {
        const updated = await api.update('pricing', editing!.id, data); setItems(prev => (prev||[]).map(x => x.id === editing!.id ? updated : x)); toast.push('success','Saved');
      }
      close();
    } catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setSaving(false); }
  };
  const remove = async (r: Plan) => {
    const ok = await confirm.confirm({ title: 'Delete plan?', message: `"${r.name}" will be permanently removed.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await api.remove('pricing', r.id); setItems(prev => (prev||[]).filter(x => x.id !== r.id)); toast.push('success','Deleted'); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };

  return (<>
    <DataTable title="Pricing plans" description="Plans shown on /pricing and quoted by Tolesh." items={items}
      addLabel="Add plan" onAdd={openNew} onEdit={openEdit} onDelete={remove}
      emptyTitle="No pricing plans" emptyBody="Add your first pricing tier."
      columns={[
        { key: 'name', label: 'Plan', render: (r: Plan) => (
          <div>
            <div className="adm-table-title">{r.name}{r.isFeatured && <span className="adm-badge featured" style={{ marginLeft: 6 }}><Star size={11}/>Featured</span>}</div>
            <div className="adm-table-sub">{r.tagline}</div>
          </div>
        )},
        { key: 'price', label: 'Price', render: (r: Plan) => {
          const parts: string[] = [];
          if (r.priceMonthly != null) parts.push(`${priceToDollars(r.priceMonthly)}/mo`);
          if (r.priceOneTime != null) parts.push(`${priceToDollars(r.priceOneTime)} once`);
          return <span className="adm-mono">{parts.join(' · ') || 'Custom'}</span>;
        }},
        { key: 'features', label: 'Features', render: (r: Plan) => <span className="adm-muted">{(r.features||[]).length} items</span> },
        { key: 'published', label: 'Status', render: (r: Plan) => r.isPublished ? <span className="adm-badge published"><CheckCircle2 size={11}/>Published</span> : <span className="adm-badge draft"><XCircle size={11}/>Draft</span> },
      ]}/>
    <Drawer open={!!editing} onClose={close} title={isNew ? 'New plan' : form.name} footer={<>
      <Button variant="ghost" onClick={close}>Cancel</Button>
      <Button variant="primary" onClick={save} disabled={saving || !form.name}>{saving?'Saving…':'Save'}</Button>
    </>}>
      <div className="adm-grid-2">
        <div className="adm-field"><label className="adm-label">Name *</label><input className="adm-input" value={form.name||''} onChange={e => set('name',e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Tagline</label><input className="adm-input" value={form.tagline||''} onChange={e => set('tagline',e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Monthly price ($)</label><input type="number" className="adm-input" value={form.priceMonthly ?? ''} onChange={e => set('priceMonthly', e.target.value === '' ? null : Number(e.target.value))} placeholder="blank = contact us"/></div>
        <div className="adm-field"><label className="adm-label">One-time price ($)</label><input type="number" className="adm-input" value={form.priceOneTime ?? ''} onChange={e => set('priceOneTime', e.target.value === '' ? null : Number(e.target.value))}/></div>
        <div className="adm-field"><label className="adm-label">Currency</label><input className="adm-input" value={form.currency||'USD'} onChange={e => set('currency',e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">CTA label</label><input className="adm-input" value={form.ctaLabel||''} onChange={e => set('ctaLabel',e.target.value)}/></div>
        <div className="adm-field" style={{ gridColumn: '1 / -1' }}><label className="adm-label">Features (comma-separated)</label><input className="adm-input" value={Array.isArray(form.features) ? form.features.join(', ') : (form.features||'')} onChange={e => set('features',e.target.value)}/></div>
        <div className="adm-field"><label className="adm-label">Order</label><input type="number" className="adm-input" value={form.order??0} onChange={e => set('order',Number(e.target.value))}/></div>
        <div/>
        <label className="adm-flex-center" style={{ gap:'0.6rem', cursor:'pointer' }}><input type="checkbox" checked={!!form.isPublished} onChange={e => set('isPublished',e.target.checked)}/><span>Published</span></label>
        <label className="adm-flex-center" style={{ gap:'0.6rem', cursor:'pointer' }}><input type="checkbox" checked={!!form.isFeatured} onChange={e => set('isFeatured',e.target.checked)}/><span>Featured</span></label>
      </div>
    </Drawer>
  </>);
}
