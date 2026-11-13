import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { useData } from '../../../../context/DataContext';
import { SaveBar, TextField, TextArea } from './shared';
import { useToast } from '../../UI';

export default function General() {
  const data = useData();
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setF(data.siteSettings); }, [data.siteSettings]);
  const set = (k: string, v: any) => { setF((x: any) => ({ ...x, [k]: v })); setDirty(true); };
  const save = async () => { setSaving(true); try { await data.updateSiteSettings(f); toast.push('success','Saved'); setDirty(false); } catch (e: any) { toast.push('error','Save failed',e.message); } finally { setSaving(false); } };
  return (
    <div className="adm-card">
      <div className="adm-card-title"><Globe size={16}/> General</div>
      <div className="adm-card-sub">Business identity and public hero copy.</div>
      <div className="adm-grid-2 adm-mt-md">
        <TextField label="Business name" value={f.businessName} onChange={v => set('businessName',v)}/>
        <TextField label="Tagline" value={f.tagline} onChange={v => set('tagline',v)}/>
        <TextField label="Hero heading" value={f.heroHeading} onChange={v => set('heroHeading',v)} help="Used on the homepage."/>
        <TextField label="Hero CTA (primary)" value={f.heroCtaPrimary} onChange={v => set('heroCtaPrimary',v)}/>
        <TextField label="Hero CTA (secondary)" value={f.heroCtaSecondary} onChange={v => set('heroCtaSecondary',v)}/>
      </div>
      <TextArea label="Hero subheading" value={f.heroSubheading} onChange={v => set('heroSubheading',v)} rows={3}/>
      <SaveBar onSave={save} saving={saving} dirty={dirty}/>
    </div>
  );
}
