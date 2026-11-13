import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useData } from '../../../../context/DataContext';
import { SaveBar, TextField, TextArea, ToggleField } from './shared';
import { useToast } from '../../UI';

export default function Notifications() {
  const data = useData();
  const toast = useToast();
  const [f, setF] = useState(data.siteNotification);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setF(data.siteNotification); }, [data.siteNotification]);
  const set = (k: string, v: any) => { setF((x: any) => ({ ...x, [k]: v })); setDirty(true); };
  const save = async () => { setSaving(true); try { await data.updateSiteNotification(f); toast.push('success','Saved'); setDirty(false); } catch (e: any) { toast.push('error','Save failed',e.message); } finally { setSaving(false); } };
  return (
    <div className="adm-card">
      <div className="adm-card-title"><Megaphone size={16}/> Site Notification Banner</div>
      <div className="adm-card-sub">Display a dismissable banner at the top of every public page.</div>
      <div className="adm-mt-md" style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
        <ToggleField label="Banner active" checked={f.isActive} onChange={v => set('isActive',v)}/>
        <TextArea label="Message" value={f.message} onChange={v => set('message',v)} rows={2}/>
        <div className="adm-grid-2">
          <TextField label="Link URL" value={f.link || ''} onChange={v => set('link',v)} placeholder="/services/ai-integration"/>
          <TextField label="Link text" value={f.linkText || ''} onChange={v => set('linkText',v)} placeholder="Learn more"/>
        </div>
      </div>
      <SaveBar onSave={save} saving={saving} dirty={dirty}/>
    </div>
  );
}
