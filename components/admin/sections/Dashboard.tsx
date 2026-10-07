import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, UserPlus, Users, FolderKanban, Sparkles, MessageSquare, Plus, ArrowRight,
  Bot, Activity, TrendingUp, Inbox, FileText,
} from 'lucide-react';
import { api } from '../../../lib/admin';
import { Button, SkeletonLine, StatusBadge } from '../UI';

interface Stats {
  projects: { total: number; published: number };
  leads: { total: number; new: number; qualified: number; won: number; conversionRate: number };
  clients: { total: number; active: number };
  content: { services: number; faqs: number; testimonials: number; insights: number };
  recentLeads: any[]; recentProjects: any[];
}

export default function Dashboard() {
  const nav = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.stats().then(d => alive && setStats(d)).catch(e => alive && setErr(String(e.message || e)));
    return () => { alive = false; };
  }, []);

  const quickActions = [
    { label: 'Add project', icon: Plus, to: '/admin/portfolio', primary: true },
    { label: 'View leads', icon: Inbox, to: '/admin/leads' },
    { label: 'Add service', icon: Sparkles, to: '/admin/services' },
    { label: 'Open AI Chat', icon: Bot, to: '/admin/ai/chat' },
    { label: 'AI Control', icon: Activity, to: '/admin/ai/models' },
    { label: 'Upload media', icon: FileText, to: '/admin/media' },
  ];

  return (
    <>
      <div className="adm-page-header">
        <div>
          <div className="adm-page-title">Dashboard</div>
          <div className="adm-page-sub">Overview of Toluene Tech operations, leads, content and AI.</div>
        </div>
        <div className="adm-page-actions">
          <Button variant="primary" icon={<Bot size={16}/>} onClick={() => nav('/admin/ai/chat')}>Ask Tolesh AI</Button>
        </div>
      </div>

      {err ? (
        <div className="adm-card" style={{ borderColor: '#fecaca', color: '#b91c1c' }}>
          Could not load stats: {err}
        </div>
      ) : (
        <div className="adm-stat-grid">
          <StatCard label="Total Projects" value={stats?.projects.total} icon={<Briefcase size={16}/>} sub={`${stats?.projects.published ?? '—'} published`}/>
          <StatCard label="New Leads" value={stats?.leads.new} icon={<UserPlus size={16}/>} sub={`${stats?.leads.total ?? '—'} total`} accent/>
          <StatCard label="Qualified Leads" value={stats?.leads.qualified} icon={<TrendingUp size={16}/>} sub={`${stats?.leads.conversionRate ?? 0}% win rate`}/>
          <StatCard label="Active Clients" value={stats?.clients.active} icon={<Users size={16}/>} sub={`${stats?.clients.total ?? '—'} total`}/>
          <StatCard label="Active Projects" value={stats?.projects.total} icon={<FolderKanban size={16}/>} sub="client jobs"/>
          <StatCard label="Services" value={stats?.content.services} icon={<Sparkles size={16}/>} sub="in the catalog"/>
          <StatCard label="FAQs" value={stats?.content.faqs} icon={<MessageSquare size={16}/>} sub="published"/>
          <StatCard label="Testimonials" value={stats?.content.testimonials} icon={<Users size={16}/>} sub="in rotation"/>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
        {quickActions.map(qa => (
          <button key={qa.label} className="adm-card" onClick={() => nav(qa.to)}
            style={{ textAlign: 'left', cursor: 'pointer', padding: '1rem' }}>
            <div className="adm-flex-center" style={{ gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-accent-soft)', color: 'var(--brand-accent)', display: 'grid', placeItems: 'center' }}>
                <qa.icon size={16}/>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1 }}>{qa.label}</div>
              <ArrowRight size={14} style={{ color: 'var(--muted-soft)' }}/>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem' }} className="adm-recent-grid">
        <div className="adm-card">
          <div className="adm-card-title"><Inbox size={16}/> Recent leads</div>
          <div className="adm-card-sub">Most recent submissions from across the website, AI and referrals.</div>
          {!stats ? (
            <div><SkeletonLine/><SkeletonLine width="60%"/><SkeletonLine/><SkeletonLine width="70%"/></div>
          ) : stats.recentLeads.length === 0 ? (
            <div className="adm-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>No leads yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {stats.recentLeads.map((l: any) => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }} className="adm-truncate">{l.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }} className="adm-truncate">{l.email} · {l.company || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="adm-mono" style={{ fontSize: '0.72rem', color: 'var(--muted-soft)' }}>{l.ref}</span>
                    <StatusBadge status={l.status}/>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={<ArrowRight size={13}/>} onClick={() => nav('/admin/leads')}>View all leads</Button>
            </div>
          )}
        </div>
        <div className="adm-card">
          <div className="adm-card-title"><FolderKanban size={16}/> Recent projects</div>
          <div className="adm-card-sub">Latest portfolio items and client work.</div>
          {!stats ? (
            <div><SkeletonLine/><SkeletonLine width="60%"/><SkeletonLine/></div>
          ) : stats.recentProjects.length === 0 ? (
            <div className="adm-muted" style={{ fontSize: '0.85rem', padding: '0.5rem 0' }}>No projects yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {stats.recentProjects.map((p: any) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }} className="adm-truncate">{p.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }} className="adm-truncate">{p.clientName || 'Anonymous'}</div>
                  </div>
                  <StatusBadge status={p.isPublished ? 'published' : 'draft'}/>
                </div>
              ))}
              <Button variant="ghost" size="sm" icon={<ArrowRight size={13}/>} onClick={() => nav('/admin/portfolio')}>View portfolio</Button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) { .adm-recent-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  );
}

function StatCard({ label, value, icon, sub, accent }: { label: string; value: number | undefined; icon: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="adm-stat">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="adm-stat-label">{label}</div>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: accent ? 'var(--brand-accent-soft)' : 'var(--bg-soft)', color: accent ? 'var(--brand-accent)' : 'var(--muted)', display: 'grid', placeItems: 'center' }}>{icon}</div>
      </div>
      <div className="adm-stat-value">{value === undefined ? '—' : value.toLocaleString()}</div>
      {sub && <div className="adm-stat-meta">{sub}</div>}
    </div>
  );
}
