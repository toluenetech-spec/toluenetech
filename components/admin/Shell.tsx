import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Sidebar, { NAV, NavItem } from './Sidebar';
import { ToastProvider, ConfirmProvider } from './UI';

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
        const res = await fetch('/healthz');
        if (!alive) return;
        if (res.ok) setHealth('ok'); else setHealth('err');
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
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace/>}/>
                <Route path="/admin/" element={<Navigate to="/admin/dashboard" replace/>}/>
                <Route path="/admin/dashboard" element={<PageWrap><Dashboard/></PageWrap>}/>
                <Route path="/admin/leads" element={<PageWrap><LeadsSection/></PageWrap>}/>
                <Route path="/admin/leads/:id" element={<PageWrap><LeadsSection/></PageWrap>}/>
                <Route path="/admin/clients" element={<PageWrap><ClientsSection/></PageWrap>}/>
                <Route path="/admin/jobs" element={<PageWrap><JobsSection/></PageWrap>}/>
                <Route path="/admin/messages" element={<PageWrap><ComingSoon title="Messages" subtitle="Project messaging and inbox will be managed here when the client portal rollout is complete." icon="MessageSquare"/></PageWrap>}/>
                <Route path="/admin/files" element={<PageWrap><MediaSection tab="files"/></PageWrap>}/>
                <Route path="/admin/invoices" element={<PageWrap><ComingSoon title="Invoices" subtitle="Invoice management will be available once payment integrations are live." icon="Receipt"/></PageWrap>}/>
                <Route path="/admin/services" element={<PageWrap><ServicesSection/></PageWrap>}/>
                <Route path="/admin/solutions" element={<PageWrap><SolutionsSection/></PageWrap>}/>
                <Route path="/admin/portfolio" element={<PageWrap><PortfolioSection/></PageWrap>}/>
                <Route path="/admin/testimonials" element={<PageWrap><TestimonialsSection/></PageWrap>}/>
                <Route path="/admin/faqs" element={<PageWrap><FAQsSection/></PageWrap>}/>
                <Route path="/admin/insights" element={<PageWrap><InsightsSection/></PageWrap>}/>
                <Route path="/admin/products" element={<PageWrap><ProductsSection/></PageWrap>}/>
                <Route path="/admin/labs" element={<PageWrap><ComingSoon title="AI Lab Content" subtitle="Manage the Planner, Advisor and Idea Analyzer context data." icon="FlaskConical"/></PageWrap>}/>
                <Route path="/admin/pricing" element={<PageWrap><PricingSection/></PageWrap>}/>
                <Route path="/admin/tools" element={<PageWrap><ToolsSection/></PageWrap>}/>
                <Route path="/admin/media" element={<PageWrap><MediaSection/></PageWrap>}/>
                <Route path="/admin/ai/chat" element={<AIChatSection/>}/>
                <Route path="/admin/ai/chat/:id" element={<AIChatSection/>}/>
                <Route path="/admin/ai/models" element={<PageWrap><AIModelControl/></PageWrap>}/>
                <Route path="/admin/ai/health" element={<PageWrap><AIHealth/></PageWrap>}/>
                <Route path="/admin/ai/conversations" element={<PageWrap><AIConversations/></PageWrap>}/>
                <Route path="/admin/settings/general" element={<PageWrap><SettingsGeneral/></PageWrap>}/>
                <Route path="/admin/settings/social" element={<PageWrap><SettingsSocial/></PageWrap>}/>
                <Route path="/admin/settings/availability" element={<PageWrap><SettingsAvailability/></PageWrap>}/>
                <Route path="/admin/settings/notifications" element={<PageWrap><SettingsNotifications/></PageWrap>}/>
                <Route path="/admin/settings/brand" element={<PageWrap><SettingsBrand/></PageWrap>}/>
                <Route path="/admin/settings/founder" element={<PageWrap><SettingsFounder/></PageWrap>}/>
                <Route path="/admin/settings/seo" element={<PageWrap><SettingsSEO/></PageWrap>}/>
                <Route path="/admin/settings/security" element={<PageWrap><SettingsSecurity/></PageWrap>}/>
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
        <Shell onLogout={onLogout}/>
      </ConfirmProvider>
    </ToastProvider>
  );
}
