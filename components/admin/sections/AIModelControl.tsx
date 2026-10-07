import React, { useEffect, useState } from 'react';
import { Settings2, Bot, Cpu, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/admin';
import { Button, useToast } from '../UI';

const SURFACE_LABELS: Record<string, { label: string; sub: string }> = {
  public:  { label: 'Public Tolesh',  sub: 'Floating chat on the public website' },
  admin:   { label: 'Admin AI',       sub: 'You are here — internal copilot' },
  client:  { label: 'Client AI',      sub: 'Client portal assistant' },
  planner: { label: 'Project Planner',sub: 'AI Lab structured planner' },
  advisor: { label: 'Business Advisor', sub: 'AI Lab business advisor' },
  idea:    { label: 'Idea Analyzer',  sub: 'AI Lab idea analyzer' },
};

export default function AIModelControl() {
  const toast = useToast();
  const [config, setConfig] = useState<any>(null);
  const [models, setModels] = useState<string[]>([]);
  const [form, setForm] = useState<Record<string, { primary: string; fallback: string | null; fallbackEnabled: boolean }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.aiConfig(), api.aiModels()]).then(([c, m]) => {
      setConfig(c); setModels(m.models || []);
      const f: Record<string, any> = {};
      for (const [k, v] of Object.entries(c.surfaces || {})) f[k] = { ...(v as any) };
      setForm(f);
    }).catch(e => toast.push('error','Failed to load AI config',e.message));
  }, []);

  if (!config) {
    return <div className="adm-card"><div className="adm-skel adm-skel-line"/><div className="adm-skel adm-skel-line w-2-3"/></div>;
  }
  const modelList = models.length > 0 ? models : Object.keys(config.catalog || {});

  const setSurface = (key: string, patch: any) => setForm(f => ({ ...f, [key]: { ...f[key], ...patch } }));
  const save = async () => {
    setSaving(true);
    try {
      const res = await api.aiSaveConfig(form);
      toast.push('success', 'Configuration saved', res.warnings?.length ? `${res.warnings.length} warning(s)` : undefined);
      if (res.warnings?.length) console.warn('AI config warnings:', res.warnings);
    } catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setSaving(false); }
  };

  return (<>
    <div className="adm-page-header">
      <div>
        <div className="adm-page-title">AI Model Control</div>
        <div className="adm-page-sub">Choose the primary and fallback model for each AI surface.</div>
      </div>
      <div className="adm-page-actions">
        <Button variant="primary" icon={<Save size={16}/>} onClick={save} disabled={saving}>{saving?'Saving…':'Save configuration'}</Button>
      </div>
    </div>

    <div className="adm-card" style={{ padding:'1rem 1.1rem', borderColor:'#fde68a', background:'#fffbeb' }}>
      <div className="adm-flex-center" style={{ gap:'0.6rem', color:'#92400e' }}>
        <AlertTriangle size={18}/>
        <div style={{ fontSize:'0.85rem' }}>
          <strong>Note:</strong> Changes are staged in the database and become live the next time the Worker is deployed with matching <code>AI_MODEL_*</code> secrets. Your browser never sees the API key.
        </div>
      </div>
    </div>

    <div className="adm-card" style={{ padding:0 }}>
      <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--line)' }}>
        <div className="adm-card-title" style={{ marginBottom:4 }}><Cpu size={16}/> Model assignments</div>
        <div className="adm-card-sub" style={{ marginBottom:0 }}>
          Provider: <strong>{config.provider}</strong> · Catalog source: <strong>{config.catalogSource || 'dahl'}</strong> · {modelList.length} models available
        </div>
      </div>
      <div style={{ padding:'0.25rem 1.25rem' }}>
        {Object.entries(SURFACE_LABELS).map(([k, lbl]) => {
          const s = form[k] || { primary:'', fallback:null, fallbackEnabled:true };
          return (
            <div key={k} className="adm-model-row">
              <div style={{ minWidth:0 }}>
                <div className="adm-model-name"><Bot size={14} style={{ verticalAlign:-2, marginRight:6, color:'var(--brand-accent)' }}/>{lbl.label}</div>
                <div className="adm-model-meta">{lbl.sub}</div>
              </div>
              <div className="adm-model-controls">
                <select className="adm-select adm-select-sm" value={s.primary} onChange={e => setSurface(k, { primary: e.target.value })}>
                  {modelList.map(m => <option key={m} value={m}>{shortName(m)}</option>)}
                </select>
                <label className="adm-flex-center" style={{ gap:'0.35rem', fontSize:'0.78rem', color:'var(--muted)' }}>
                  <span>Fallback</span>
                  <select className="adm-select adm-select-sm" value={s.fallback || ''} disabled={!s.fallbackEnabled} onChange={e => setSurface(k, { fallback: e.target.value || null })}>
                    <option value="">None</option>
                    {modelList.filter(m => m !== s.primary).map(m => <option key={m} value={m}>{shortName(m)}</option>)}
                  </select>
                  <label className="adm-switch" title="Enable fallback">
                    <input type="checkbox" checked={s.fallbackEnabled} onChange={e => setSurface(k, { fallbackEnabled: e.target.checked })}/>
                    <span className="adm-switch-slider"/>
                  </label>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </>);
}

function shortName(id: string) {
  const last = id.split('/').pop() || id;
  return last
    .replace(/-0731$/,'')
    .replace(/^MiniMax-?/,'MiniMax ')
    .replace(/^GLM-?/,'GLM ')
    .replace(/^DeepSeek-?/,'DeepSeek ');
}
