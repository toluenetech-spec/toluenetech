import React, { useEffect, useState, useCallback } from 'react';
import DataTable, { TitleCell, StatusCell } from '../DataTable';
import { Button, Drawer, Modal, useConfirm, useToast, Badge } from '../UI';
import { api } from '../../../lib/admin';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'tags' | 'chips' | 'url';
  options?: { value: string; label: string }[];
  chipOptions?: string[];
  placeholder?: string;
  required?: boolean;
  help?: string;
  wide?: boolean;
  initial?: any;
}
export interface CRUDConfig {
  entity: string;            // e.g. 'services'
  title: string;
  description: string;
  addLabel: string;
  emptyTitle: string;
  emptyBody: string;
  columns: { key: string; label: string; render: (row: any) => React.ReactNode }[];
  fields: FieldDef[];
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Optional transform before POST/PUT */
  beforeSave?: (data: Record<string, any>) => Record<string, any>;
}

/**
 * A generic, reusable CRUD list + drawer editor. Composes DataTable and Drawer.
 */
export function GenericCRUD({ config }: { config: CRUDConfig }) {
  const { entity } = config;
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.list(entity, q ? { q } : undefined)
      .then(d => setItems(d.items))
      .catch(e => toast.push('error', `Failed to load ${config.title}`, e.message));
  }, [entity, q, config.title, toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    const initial: Record<string, any> = {};
    for (const f of config.fields) initial[f.key] = f.initial ?? (f.type === 'checkbox' ? false : f.type === 'tags' || f.type === 'chips' ? [] : '');
    setForm(initial); setIsNew(true); setEditing({});
  };
  const openEdit = (row: any) => { setForm({ ...row }); setIsNew(false); setEditing(row); };
  const close = () => { setEditing(null); setForm({}); setIsNew(false); };

  const save = async () => {
    setSaving(true);
    try {
      const data = config.beforeSave ? config.beforeSave(form) : form;
      if (isNew) {
        const created = await api.create(entity, data);
        setItems(prev => [created, ...(prev || [])]);
        toast.push('success', `${config.addLabel.replace('Add ','')} created`);
      } else {
        const updated = await api.update(entity, editing.id, data);
        setItems(prev => (prev || []).map(x => x.id === editing.id ? updated : x));
        toast.push('success', 'Saved');
      }
      close();
    } catch (e: any) {
      toast.push('error', 'Save failed', e.message);
    } finally { setSaving(false); }
  };

  const remove = async (row: any) => {
    const ok = await confirm.confirm({
      title: 'Delete this item?', message: `This will permanently remove "${row.title || row.name || row.question || row.id}". This cannot be undone.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try { await api.remove(entity, row.id); setItems(prev => (prev || []).filter(x => x.id !== row.id)); toast.push('success', 'Deleted'); }
    catch (e: any) { toast.push('error', 'Delete failed', e.message); }
  };

  const setField = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleChip = (k: string, v: string) => setForm(f => {
    const arr: string[] = Array.isArray(f[k]) ? f[k] : [];
    return { ...f, [k]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] };
  });

  return (
    <>
      <DataTable
        title={config.title}
        description={config.description}
        items={items}
        columns={config.columns}
        searchable={config.searchable !== false}
        searchPlaceholder={config.searchPlaceholder || `Search ${config.title.toLowerCase()}…`}
        searchValue={q}
        onSearchChange={setQ}
        emptyTitle={config.emptyTitle}
        emptyBody={config.emptyBody}
        addLabel={config.addLabel}
        onAdd={openNew}
        onEdit={openEdit}
        onDelete={remove}
      />
      <Drawer open={!!editing} onClose={close}
        title={isNew ? `New ${config.addLabel.replace('Add ','').toLowerCase()}` : (form.title || form.name || form.question || 'Edit')}
        footer={<>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {config.fields.map(f => {
            const val = form[f.key];
            if (f.type === 'textarea') return (
              <div className="adm-field" key={f.key}>
                <label className="adm-label">{f.label}</label>
                <textarea className="adm-textarea" rows={5} value={val || ''} placeholder={f.placeholder}
                  onChange={e => setField(f.key, e.target.value)}/>
                {f.help && <span className="adm-label-hint">{f.help}</span>}
              </div>
            );
            if (f.type === 'checkbox') return (
              <label className="adm-flex-center" key={f.key} style={{ gap: '0.6rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!val} onChange={e => setField(f.key, e.target.checked)}/>
                <span style={{ fontSize: '0.87rem' }}>{f.label}</span>
              </label>
            );
            if (f.type === 'select') return (
              <div className="adm-field" key={f.key}>
                <label className="adm-label">{f.label}</label>
                <select className="adm-select" value={val || ''} onChange={e => setField(f.key, e.target.value)}>
                  <option value="">—</option>
                  {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            );
            if (f.type === 'number') return (
              <div className="adm-field" key={f.key}>
                <label className="adm-label">{f.label}</label>
                <input type="number" className="adm-input" value={val ?? ''} placeholder={f.placeholder}
                  onChange={e => setField(f.key, e.target.value === '' ? null : Number(e.target.value))}/>
              </div>
            );
            if (f.type === 'chips') return (
              <div className="adm-field" key={f.key}>
                <label className="adm-label">{f.label}</label>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {(f.chipOptions || []).map(o => (
                    <button type="button" key={o} className={`adm-btn adm-btn-sm${(val || []).includes(o) ? ' adm-btn-primary' : ''}`}
                      onClick={() => toggleChip(f.key, o)}>{o}</button>
                  ))}
                </div>
              </div>
            );
            if (f.type === 'tags') return (
              <div className="adm-field" key={f.key}>
                <label className="adm-label">{f.label} <span className="adm-label-hint">comma-separated</span></label>
                <input className="adm-input" placeholder={f.placeholder}
                  value={Array.isArray(val) ? val.join(', ') : (val || '')}
                  onChange={e => setField(f.key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}/>
              </div>
            );
            // default: text/url
            return (
              <div className={`adm-field${f.wide ? '' : ''}`} key={f.key}>
                <label className="adm-label">{f.label}{f.required ? ' *' : ''}</label>
                <input className="adm-input" type={f.type === 'url' ? 'url' : 'text'}
                  value={val || ''} placeholder={f.placeholder}
                  onChange={e => setField(f.key, e.target.value)}/>
                {f.help && <span className="adm-label-hint">{f.help}</span>}
              </div>
            );
          })}
        </div>
      </Drawer>
    </>
  );
}
