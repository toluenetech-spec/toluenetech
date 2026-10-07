import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload, Copy, Check } from 'lucide-react';
import { api } from '../../../lib/admin';
import { Button, EmptyState, useConfirm, useToast } from '../UI';

export default function MediaSection({ tab }: { tab?: 'files' | 'all' } = {}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.media().then(d => setItems(d.items)).catch(e => toast.push('error','Failed to load media',e.message));
  useEffect(() => { load(); }, []);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const res = await api.uploadMedia(f);
        if (res?.item) setItems(prev => [res.item, ...(prev||[])]);
      }
      toast.push('success','Upload complete');
    } catch (e: any) { toast.push('error','Upload failed',e.message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const remove = async (it: any) => {
    const ok = await confirm.confirm({ title: 'Delete file?', message: `${it.filename} will be removed from storage and the library.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await api.deleteMedia(it.id); setItems(prev => (prev||[]).filter(x => x.id !== it.id)); toast.push('success','Deleted'); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.push('success','URL copied'); } catch {}
  };

  return (<>
    <div className="adm-page-header">
      <div>
        <div className="adm-page-title">{tab === 'files' ? 'Project Files' : 'Media Library'}</div>
        <div className="adm-page-sub">Uploaded files stored in R2 and referenced across the site.</div>
      </div>
      <div className="adm-page-actions">
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" style={{ display:'none' }} onChange={e => upload(e.target.files)}/>
        <Button variant="primary" icon={<Upload size={16}/>} onClick={() => fileRef.current?.click()} disabled={busy}>{busy?'Uploading…':'Upload'}</Button>
      </div>
    </div>

    <div className="adm-card" style={{ padding: items && items.length === 0 ? '2rem' : '1rem' }}>
      {items === null ? (
        <div style={{ padding:'1rem' }}><div className="adm-skel adm-skel-line"/><div className="adm-skel adm-skel-line w-2-3"/></div>
      ) : items.length === 0 ? (
        <EmptyState icon={ImagePlus} title="No files yet" body="Upload images or PDFs to use across portfolio, services and brand assets."
          action={<Button variant="primary" icon={<Upload size={14}/>} onClick={() => fileRef.current?.click()}>Upload first file</Button>}/>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'0.85rem' }}>
          {items.map(it => {
            const isImage = (it.mimeType || '').startsWith('image/');
            return (
              <div key={it.id} style={{ border:'1px solid var(--line)', borderRadius:10, overflow:'hidden', background:'var(--bg)' }}>
                <div style={{ aspectRatio: '1 / 1', background:'var(--bg-soft)', display:'grid', placeItems:'center', overflow:'hidden' }}>
                  {isImage
                    ? <img src={it.publicUrl} alt={it.alt || it.filename} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    : <div style={{ color:'var(--muted-soft)', textAlign:'center', padding:'1rem', fontSize:'0.75rem' }}>
                        <ImagePlus size={30} style={{ margin:'0 auto 0.4rem', opacity:0.5 }}/>
                        {it.mimeType || 'file'}
                      </div>}
                </div>
                <div style={{ padding:'0.55rem 0.65rem', fontSize:'0.78rem', display:'flex', alignItems:'center', gap:'0.35rem' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="adm-truncate" style={{ fontWeight:600 }}>{it.filename}</div>
                    <div className="adm-muted" style={{ fontSize:'0.7rem' }}>{it.sizeBytes ? `${Math.round(it.sizeBytes/1024)} KB` : ''}</div>
                  </div>
                  <button className="adm-btn adm-btn-ghost adm-btn-icon" title="Copy URL" onClick={() => copy(it.publicUrl)}><Copy size={13}/></button>
                  <button className="adm-btn adm-btn-ghost adm-btn-icon" title="Delete" onClick={() => remove(it)}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </>);
}
