import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon, Upload, FileText, ExternalLink } from 'lucide-react';
import { useData } from '../../../../context/DataContext';
import { Button, useToast } from '../../UI';

interface Asset { key: 'brandProfileData' | 'portfolioHighlightData' | 'pricingGuideData' | 'founderImageData'; label: string; accept: string; icon: React.ElementType; updater: (f: File | string) => Promise<void>; current: string | null; }

export default function Brand() {
  const data = useData();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const assets: Asset[] = [
    { key:'brandProfileData', label:'Brand CV (PDF)', accept:'application/pdf', icon:FileText, updater:data.updateBrandProfile, current:data.brandProfileData },
    { key:'portfolioHighlightData', label:'Portfolio Highlight (PDF)', accept:'application/pdf', icon:FileText, updater:data.updatePortfolioHighlight, current:data.portfolioHighlightData },
    { key:'pricingGuideData', label:'Pricing Guide (PDF)', accept:'application/pdf', icon:FileText, updater:data.updatePricingGuide, current:data.pricingGuideData },
    { key:'founderImageData', label:'Founder Image', accept:'image/*', icon:ImageIcon, updater:data.updateFounderImage, current:data.founderImageData },
  ];

  const upload = async (a: Asset, file: File) => {
    setBusy(a.key);
    try { await a.updater(file); toast.push('success', `${a.label} uploaded`); }
    catch (e: any) { toast.push('error','Upload failed',e.message); }
    finally { setBusy(null); }
  };
  const setUrl = async (a: Asset, url: string) => {
    setBusy(a.key);
    try { await a.updater(url); toast.push('success', `${a.label} saved`); }
    catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="adm-card">
      <div className="adm-card-title"><ImageIcon size={16}/> Brand Assets &amp; Downloads</div>
      <div className="adm-card-sub">Files available for download on the public site.</div>
      <div className="adm-grid-2 adm-mt-md">
        {assets.map(a => <AssetCard key={a.key} asset={a} busy={busy===a.key} onFile={f => upload(a,f)} onUrl={u => setUrl(a,u)}/>)}
      </div>
    </div>
  );
}

function AssetCard({ asset, busy, onFile, onUrl, ...rest }: { asset: Asset; busy: boolean; onFile: (f: File) => void; onUrl: (u: string) => void; } & React.HTMLAttributes<HTMLDivElement>) {
  const [url, setUrl] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div {...rest} style={{ border:'1px solid var(--line)', borderRadius:10, padding:'1rem', display:'flex', flexDirection:'column', gap:'0.6rem' }}>
      <div className="adm-flex-center" style={{ gap:'0.5rem' }}>
        <div style={{ width:34, height:34, borderRadius:8, background:'var(--bg-soft)', display:'grid', placeItems:'center', color:'var(--muted)' }}><asset.icon size={16}/></div>
        <div style={{ fontWeight:600, fontSize:'0.9rem' }}>{asset.label}</div>
      </div>
      {asset.current ? (
        <div style={{ fontSize:'0.8rem' }}>
          {asset.accept.startsWith('image/') && asset.current.startsWith('http')
            ? <img src={asset.current} alt="" style={{ maxHeight:120, borderRadius:8, border:'1px solid var(--line)', marginBottom:'0.4rem' }}/>
            : <div className="adm-muted" style={{ marginBottom:'0.4rem' }}>File uploaded</div>}
          <a className="adm-link" href={asset.current} target="_blank" rel="noreferrer"><ExternalLink size={12} style={{ verticalAlign:-2 }}/> Open file</a>
        </div>
      ) : <div className="adm-muted" style={{ fontSize:'0.8rem' }}>No file uploaded.</div>}
      <input ref={ref} type="file" accept={asset.accept} style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); if (ref.current) ref.current.value=''; }}/>
      <div style={{ display:'flex', gap:'0.4rem' }}>
        <Button size="sm" icon={<Upload size={13}/>} onClick={() => ref.current?.click()} disabled={busy}>{busy?'Uploading…':'Upload'}</Button>
      </div>
      <div className="adm-field" style={{ margin:0 }}>
        <input className="adm-input adm-input-sm" placeholder="…or paste a URL" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url) { onUrl(url); setUrl(''); } }}/>
      </div>
    </div>
  );
}
