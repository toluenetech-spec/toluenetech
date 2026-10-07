import React, { useEffect, useState } from 'react';
import { Tags } from 'lucide-react';
import { useData } from '../../../../context/DataContext';
import { SaveBar, TextField, TextArea } from './shared';
import { useToast } from '../../UI';

export default function SEO() {
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
      <div className="adm-card-title"><Tags size={16}/> SEO Defaults</div>
      <div className="adm-card-sub">Used across the site when a page doesn't specify its own metadata.</div>
      <div className="adm-mt-md" style={{ display:'flex', flexDirection:'column', gap:'0.8rem' }}>
        <TextField label="Default SEO title" value={f.defaultSeoTitle} onChange={v => set('defaultSeoTitle',v)}/>
        <TextArea label="Default SEO description" value={f.defaultSeoDescription} onChange={v => set('defaultSeoDescription',v)} rows={3}/>
      </div>
      <SaveBar onSave={save} saving={saving} dirty={dirty}/>
    </div>
  );
}
