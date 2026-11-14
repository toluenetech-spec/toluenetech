import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useData } from '../../../../context/DataContext';
import { SaveBar, TextField } from './shared';
import { useToast } from '../../UI';

export default function Social() {
  const data = useData();
  const toast = useToast();
  const [f, setF] = useState(data.socialLinks);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setF(data.socialLinks); }, [data.socialLinks]);
  const set = (k: string, v: string) => { setF(x => ({ ...x, [k]: v })); setDirty(true); };
  const save = async () => { setSaving(true); try { await data.updateSocialLinks(f); toast.push('success','Saved'); setDirty(false); } catch (e: any) { toast.push('error','Save failed',e.message); } finally { setSaving(false); } };
  return (
    <div className="adm-card">
      <div className="adm-card-title"><Users size={16}/> Social &amp; Contact</div>
      <div className="adm-card-sub">Public links and contact information.</div>
      <div className="adm-grid-2 adm-mt-md">
        <TextField label="Email" type="email" value={f.email} onChange={v => set('email',v)}/>
        <TextField label="WhatsApp" value={f.whatsapp} onChange={v => set('whatsapp',v)} help="International format with country code."/>
        <TextField label="LinkedIn" value={f.linkedin} onChange={v => set('linkedin',v)} placeholder="https://…"/>
        <TextField label="Facebook" value={f.facebook} onChange={v => set('facebook',v)} placeholder="https://…"/>
        <TextField label="X / Twitter" value={f.twitter} onChange={v => set('twitter',v)} placeholder="https://…"/>
        <TextField label="Instagram" value={f.instagram} onChange={v => set('instagram',v)} placeholder="https://…"/>
      </div>
      <SaveBar onSave={save} saving={saving} dirty={dirty}/>
    </div>
  );
}
