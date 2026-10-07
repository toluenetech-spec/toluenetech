import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, RefreshCw, HelpCircle } from 'lucide-react';
import { api } from '../../../lib/admin';
import { Button, useToast } from '../UI';

interface Status { status: 'operational' | 'degraded' | 'unavailable' | 'unknown'; uptime?: number; latencyMs?: number; [k: string]: any }

const SURFACES = ['public','admin','client','planner','advisor','idea'] as const;
const LABELS: Record<string, string> = {
  public:'Public Tolesh', admin:'Admin AI', client:'Client AI', planner:'Project Planner', advisor:'Business Advisor', idea:'Idea Analyzer',
};

function statusOf(s: any): Status['status'] {
  if (!s) return 'unknown';
  const v = String(s.status || s.state || s.availability || '').toLowerCase();
  if (/operational|up|healthy|ok|available/.test(v)) return 'operational';
  if (/degrad|warn|partial|latency/.test(v)) return 'degraded';
  if (/down|unavailable|error|outage/.test(v)) return 'unavailable';
  return 'unknown';
}

export default function AIHealth() {
  const toast = useToast();
  const [status, setStatus] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const [s, c] = await Promise.all([api.aiStatus().catch((e: any) => { setErr(e.message); return null; }), api.aiConfig()]);
      setStatus(s); setConfig(c); setLastChecked(new Date());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Merge per-model status from the status endpoint with our assignments
  const models = config?.catalog ? Object.keys(config.catalog) : [];
  const assignments: Record<string, { surface: string; role: 'primary' | 'fallback' }[]> = {};
  if (config?.surfaces) {
    for (const [surf, s] of Object.entries(config.surfaces) as any) {
      const key = (s as any).primary;
      if (key) (assignments[key] ||= []).push({ surface: surf, role: 'primary' });
      if ((s as any).fallback) (assignments[(s as any).fallback] ||= []).push({ surface: surf, role: 'fallback' });
    }
  }

  const modelStatus = (id: string): Status['status'] => {
    if (!status?.models) return 'unknown';
    const found = status.models[id] || status.models[id.split('/').pop()];
    return statusOf(found);
  };

  return (<>
    <div className="adm-page-header">
      <div>
        <div className="adm-page-title">AI Usage &amp; Health</div>
        <div className="adm-page-sub">Live availability of models and per-surface routing status.</div>
      </div>
      <div className="adm-page-actions">
        <Button variant="secondary" icon={<RefreshCw size={16}/>} onClick={load} disabled={loading}>{loading?'Refreshing…':'Refresh'}</Button>
      </div>
    </div>

    {err && <div className="adm-card" style={{ borderColor:'#fecaca', color:'#b91c1c' }}><AlertCircle size={16} style={{ verticalAlign:-2, marginRight:6 }}/>Could not reach Dahl status endpoint: {err}</div>}

    <div className="adm-card">
      <div className="adm-card-title"><Activity size={16}/> Models</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'0.75rem', marginTop:'0.5rem' }}>
        {models.length === 0 ? (
          <div className="adm-muted">Loading model catalog…</div>
        ) : models.map(id => {
          const s = modelStatus(id);
          const dot = s === 'operational' ? 'ok' : s === 'degraded' ? 'warn' : s === 'unavailable' ? 'err' : 'warn';
          const as = assignments[id] || [];
          return (
            <div key={id} className="adm-status-card">
              <div className={`adm-status-dot ${dot}`}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="adm-status-card-title">{shortName(id)}</div>
                <div className="adm-status-card-sub"><span className={`adm-badge ${s}`}>{s}</span></div>
                {as.length > 0 && (
                  <div style={{ display:'flex', gap:'0.3rem', flexWrap:'wrap', marginTop:'0.3rem' }}>
                    {as.map(a => <span key={`${a.surface}-${a.role}`} className="adm-badge" style={{ fontSize:'0.65rem' }}>{LABELS[a.surface] || a.surface} · {a.role}</span>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="adm-card-sub adm-mt-md">
        {lastChecked ? <>Last checked: {lastChecked.toLocaleTimeString()}</> : 'Checking…'}
      </div>
    </div>

    <div className="adm-card">
      <div className="adm-card-title">Per-surface routing</div>
      <div className="adm-card-sub">These are the models currently in use.</div>
      <div style={{ display:'grid', gap:'0' }}>
        {SURFACES.map(k => {
          const s = config?.surfaces?.[k]; if (!s) return null;
          const pStatus = modelStatus(s.primary);
          const fStatus = s.fallback ? modelStatus(s.fallback) : null;
          return (
            <div key={k} className="adm-model-row">
              <div style={{ minWidth:0 }}>
                <div className="adm-model-name">{LABELS[k] || k}</div>
                <div className="adm-model-meta">Tier: {s.tier}</div>
              </div>
              <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
                <span className={`adm-badge ${pStatus}`}><strong>{shortName(s.primary)}</strong></span>
                {s.fallback && <span style={{ color:'var(--muted-soft)', fontSize:'0.8rem' }}>→</span>}
                {s.fallback && s.fallbackEnabled && <span className={`adm-badge ${fStatus || 'unknown'}`}>{shortName(s.fallback)}</span>}
                {!s.fallbackEnabled && <span className="adm-badge unknown">fallback off</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </>);
}
function shortName(id: string) { return id.split('/').pop()?.replace(/-0731$/,'').replace(/^MiniMax-?/,'MiniMax ').replace(/^GLM-?/,'GLM ').replace(/^DeepSeek-?/,'DeepSeek ') || id; }
