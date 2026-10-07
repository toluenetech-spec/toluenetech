import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { useData } from '../../../../context/DataContext';
import { SaveBar, TextField, TextArea, ToggleField } from './shared';
import { useToast } from '../../UI';

const OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'limited', label: 'Limited availability' },
  { value: 'unavailable', label: 'Unavailable' },
];

export default function Availability() {
  const data = useData();
  const toast = useToast();
  const [f, setF] = useState<any>(data.siteSettings);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setF(data.siteSettings); }, [data.siteSettings]);
  const set = (k: string, v: any) => { setF((x: any) => ({ ...x, [k]: v })); setDirty(true); };
  const save = async () => { setSaving(true); try { await data.updateSiteSettings(f); toast.push('success','Saved'); setDirty(false); } catch (e: any) { toast.push('error','Save failed',e.message); } finally { setSaving(false); } };
  return (
    <div className="adm-card">
      <div className="adm-card-title"><Activity size={16}/> Site Availability</div>
      <div className="adm-card-sub">Shown to visitors on the public site.</div>
      <div className="adm-mt-md" style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
        {OPTIONS.map(o => (
          <button key={o.value} className={`adm-btn adm-btn-sm${f.availability === o.value ? ' adm-btn-primary' : ''}`} onClick={() => set('availability', o.value)}>{o.label}</button>
        ))}
      </div>
      <div className="adm-mt-md">
        <TextArea label="Availability message" value={f.availabilityMessage || ''} onChange={v => set('availabilityMessage',v)} placeholder="e.g. Currently accepting bookings for Q1 2027." rows={2}/>
      </div>
      <SaveBar onSave={save} saving={saving} dirty={dirty}/>
    </div>
  );
}
