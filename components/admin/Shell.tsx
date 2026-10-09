import React, { Component, useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Sidebar, { NAV, NavItem } from './Sidebar';
import { ToastProvider, ConfirmProvider } from './UI';
import { apiBase } from '../../lib/api';

// Sections (lazy-ish — static imports keep things simple, heavy sections use sub-components).
import Dashboard from './sections/Dashboard';
import LeadsSection from './sections/Leads';
import ClientsSection from './sections/Clients';
import JobsSection from './sections/Jobs';
import ComingSoon from './sections/ComingSoon';
import ServicesSection from './sections/Services';
import Placeholder from './sections/ComingSoon'; // re-export under more names below
import PortfolioSection from './sections/Portfolio';
import TestimonialsSection from './sections/Testimonials';
import FAQsSection from './sections/FAQs';
import InsightsSection from './sections/Insights';
import ProductsSection from './sections/Products';
import PricingSection from './sections/Pricing';
import MediaSection from './sections/Media';
import ToolsSection from './sections/Tools';
import SolutionsSection from './sections/Solutions';
import AIChatSection from './sections/AIChat';
import AIModelControl from './sections/AIModelControl';
import AIHealth from './sections/AIHealth';
import AIConversations from './sections/AIConversations';
import MessagesSection from './sections/Messages';
import FilesSection from './sections/Files';
import InvoicesSection from './sections/Invoices';
import SettingsGeneral from './sections/settings/General';
import SettingsSocial from './sections/settings/Social';
import SettingsAvailability from './sections/settings/Availability';
import SettingsNotifications from './sections/settings/Notifications';
import SettingsBrand from './sections/settings/Brand';
import SettingsFounder from './sections/settings/Founder';
import SettingsSEO from './sections/settings/SEO';
import SettingsSecurity from './sections/settings/Security';

function findNavTitle(pathname: string): { section: string; page: string } {
  const flat: NavItem[] = [];
  for (const n of NAV) {
    if (n.children) {
      for (const c of n.children) flat.push({ ...c, _section: n.label } as any);
    } else {
      flat.push({ ...n, _section: 'Overview' } as any);
    }
  }
  for (const n of flat) {
    if (n.to && pathname.startsWith(n.to)) return { section: (n as any)._section, page: n.label };
  }
  return { section: 'Overview', page: 'Dashboard' };
}

function TopBar({ onToggleMobile, onCollapse, collapsed }: { onToggleMobile: () => void; onCollapse?: () => void; collapsed?: boolean }) {
  const { pathname } = useLocation();
  const [health, setHealth] = useState<'ok' | 'checking' | 'warn' | 'err'>('checking');
  const crumbs = useMemo(() => findNavTitle(pathname), [pathname]);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch(`${apiBase()}/healthz`);
        if (!alive) return;
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.toLowerCase().includes('application/json')) setHealth('ok'); else setHealth('err');
      } catch { if (alive) setHealth('warn'); }
    };
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const dot = health === 'ok' ? <span className="adm-dot"/> : health === 'checking' ? <span className="adm-dot warn"/> : <span className="adm-dot err"/>;
  const label = health === 'ok' ? 'All systems operational' : health === 'checking' ? 'Connecting…' : health === 'warn' ? 'Partial connectivity' : 'API unreachable';
  return (
    <header className="adm-topbar">
      <button className="adm-btn adm-btn-ghost adm-btn-icon adm-menu-btn" onClick={onToggleMobile} aria-label="Menu" style={{ display: 'none' }}>
        <Menu size={18}/>
      </button>
      <div>
        <div className="adm-topbar-breadcrumb">{crumbs.section} <span style={{ margin: '0 0.3rem', color: 'var(--line-strong)' }}>/</span></div>
        <div className="adm-topbar-title">{crumbs.page}</div>
      </div>
      <div className="adm-topbar-spacer"/>
      <span className="adm-topbar-indicator">{dot}{label}</span>
    </header>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  // Remember collapsed state
  useEffect(() => {
    try { const v = localStorage.getItem('tt_admin_collapsed'); if (v === '1') setCollapsed(true); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('tt_admin_collapsed', collapsed ? '1' : '0'); } catch {} }, [collapsed]);

  return (
    <div className={`tt-admin${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-nav-open' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onLogout={onLogout}
      />
      <main className="adm-main">
        <TopBar onToggleMobile={() => setMobileOpen(true)}/>
        <div className="adm-content">
          <div className="adm-content-inner">
            <AnimatePresence>
              <Routes location={location}>
                <Route index element={<Navigate to="/admin/dashboard" replace/>}/>
                <Route path="dashboard" element={<PageWrap><Dashboard/></PageWrap>}/>
                <Route path="leads" element={<PageWrap><LeadsSection/></PageWrap>}/>
                <Route path="leads/:id" element={<PageWrap><LeadsSection/></PageWrap>}/>
                <Route path="clients" element={<PageWrap><ClientsSection/></PageWrap>}/>
                <Route path="jobs" element={<PageWrap><JobsSection/></PageWrap>}/>
                <Route path="messages" element={<PageWrap><MessagesSection/></PageWrap>}/>
                <Route path="files" element={<PageWrap><FilesSection/></PageWrap>}/>
                <Route path="invoices" element={<PageWrap><InvoicesSection/></PageWrap>}/>
                <Route path="services" element={<PageWrap><ServicesSection/></PageWrap>}/>
                <Route path="solutions" element={<PageWrap><SolutionsSection/></PageWrap>}/>
                <Route path="portfolio" element={<PageWrap><PortfolioSection/></PageWrap>}/>
                <Route path="testimonials" element={<PageWrap><TestimonialsSection/></PageWrap>}/>
                <Route path="faqs" element={<PageWrap><FAQsSection/></PageWrap>}/>
                <Route path="insights" element={<PageWrap><InsightsSection/></PageWrap>}/>
                <Route path="products" element={<PageWrap><ProductsSection/></PageWrap>}/>
                <Route path="labs" element={<PageWrap><ComingSoon title="AI Lab Content" subtitle="Manage the Planner, Advisor and Idea Analyzer context data." icon="FlaskConical"/></PageWrap>}/>
                <Route path="pricing" element={<PageWrap><PricingSection/></PageWrap>}/>
                <Route path="tools" element={<PageWrap><ToolsSection/></PageWrap>}/>
                <Route path="media" element={<PageWrap><MediaSection/></PageWrap>}/>
                <Route path="ai/chat" element={<AIChatSection/>}/>
                <Route path="ai/chat/:id" element={<AIChatSection/>}/>
                <Route path="ai/models" element={<PageWrap><AIModelControl/></PageWrap>}/>
                <Route path="ai/health" element={<PageWrap><AIHealth/></PageWrap>}/>
                <Route path="ai/conversations" element={<PageWrap><AIConversations/></PageWrap>}/>
                <Route path="settings/general" element={<PageWrap><SettingsGeneral/></PageWrap>}/>
                <Route path="settings/social" element={<PageWrap><SettingsSocial/></PageWrap>}/>
                <Route path="settings/availability" element={<PageWrap><SettingsAvailability/></PageWrap>}/>
                <Route path="settings/notifications" element={<PageWrap><SettingsNotifications/></PageWrap>}/>
                <Route path="settings/brand" element={<PageWrap><SettingsBrand/></PageWrap>}/>
                <Route path="settings/founder" element={<PageWrap><SettingsFounder/></PageWrap>}/>
                <Route path="settings/seo" element={<PageWrap><SettingsSEO/></PageWrap>}/>
                <Route path="settings/security" element={<PageWrap><SettingsSecurity/></PageWrap>}/>
                <Route path="*" element={<Navigate to="/admin/dashboard" replace/>}/>
              </Routes>
            </AnimatePresence>
          </div>
        </div>
        <style>{`
          @media (max-width: 960px) { .adm-menu-btn { display: inline-flex !important; } }
        `}</style>
      </main>
    </div>
  );
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: '100%' }}>
      {children}
    </motion.div>
  );
}

export default function AdminShell({ onLogout }: { onLogout: () => void }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ErrorBoundary>
          <Shell onLogout={onLogout}/>
        </ErrorBoundary>
      </ConfirmProvider>
    </ToastProvider>
  );
}

// Real React error boundary — catches render errors in children that
// window 'error' listeners miss (React swallows synchronous render errors
// before they reach window.onerror, which is why a function-component-only
// "boundary" left the page blank when Dashboard threw on bad stats data).
// Implemented via createClass-style object passed to React's base Component
// so it works cleanly with React 19's strict JSX types.
interface EBProps { children: React.ReactNode }
interface EBState { err: string | null }
const ErrorBoundary: React.ComponentType<EBProps> = (() => {
  const C: any = class extends Component<EBProps, EBState> {
    state: EBState = { err: null };
    static getDerivedStateFromError(e: unknown): EBState {
      return { err: String((e as any)?.stack || (e as any)?.message || e) };
    }
    componentDidCatch(error: unknown, info: React.ErrorInfo) {
      console.error('[Admin error boundary]', error, info);
    }
    render() {
      const err: string | null = (this as any).state?.err;
      if (err) {
        return (
          <div style={{ padding: '2rem', maxWidth: 820, margin: '0 auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, color: '#222', whiteSpace: 'pre-wrap' }}>
            <div style={{ color: '#dc2626', fontWeight: 700, fontSize: 15, marginBottom: '0.75rem' }}>Admin crashed</div>
            <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 8, padding: '1rem', overflow: 'auto' }}>{err}</div>
            <div style={{ marginTop: '1rem', fontSize: 12, color: '#64748b' }}>Open the browser console for the full stack. Clicking below will clear the admin session and reload.</div>
            <button style={{ marginTop: '1rem', padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', background: '#fff' }} onClick={() => { sessionStorage.clear(); location.hash = '#/admin'; location.reload(); }}>Clear session and reload</button>
          </div>
        );
      }
      return <ErrorWindowListeners>{(this as any).props.children}</ErrorWindowListeners>;
    }
  };
  return C as any;
})();

// Companion listener funnels window 'error' and 'unhandledrejection' events
// into the class boundary above by re-throwing inside a microtask.
function ErrorWindowListeners({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      const msg = e.error?.stack || e.error?.message || `${e.message} @ ${e.filename}:${e.lineno}`;
      console.error('[Admin runtime error]', e.error || e);
      queueMicrotask(() => { throw new Error('[window.error] ' + msg); });
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const msg = (e.reason as any)?.stack || (e.reason as any)?.message || String(e.reason);
      console.error('[Admin unhandled rejection]', e.reason);
      queueMicrotask(() => { throw new Error('[unhandledrejection] ' + msg); });
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);
  return <>{children}</>;
}
