import React, { useEffect, useState } from 'react';
import { UserCog } from 'lucide-react';
import { useData } from '../../../../context/DataContext';
import { SaveBar, TextField, TextArea } from './shared';
import { useToast } from '../../UI';

export default function Founder() {
  const data = useData();
  const toast = useToast();
  const [f, setF] = useState(data.founderNote);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setF(data.founderNote); }, [data.founderNote]);
  const set = (k: string, v: any) => { setF((x: any) => ({ ...x, [k]: v })); setDirty(true); };
  const save = async () => { setSaving(true); try { await data.updateFounderNote(f); toast.push('success','Saved'); setDirty(false); } catch (e: any) { toast.push('error','Save failed',e.message); } finally { setSaving(false); } };
  return (
    <div className="adm-card">
      <div className="adm-card-title"><UserCog size={16}/> Founder Note</div>
      <div className="adm-card-sub">Shown on the About page.</div>
      <div className="adm-grid-2 adm-mt-md">
        <TextField label="Section heading" value={f.heading} onChange={v => set('heading',v)}/>
        <TextField label="Founder name" value={f.name} onChange={v => set('name',v)}/>
        <TextField label="Role / title" value={f.role} onChange={v => set('role',v)}/>
      </div>
      <div className="adm-mt-md">
        <TextArea label="Message" value={f.message} onChange={v => set('message',v)} rows={6}/>
      </div>
      <SaveBar onSave={save} saving={saving} dirty={dirty}/>
    </div>
  );
}
