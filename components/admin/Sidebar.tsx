import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserRound, FolderKanban, MessageSquare, FileText, Receipt,
  Briefcase, Sparkles, Tags, Image as ImageIcon, ImagePlus, Newspaper, Package, FlaskConical,
  BadgeDollarSign, Wrench, Bot, Settings2, Activity, MessagesSquare, PanelLeftClose, PanelLeftOpen,
  LogOut, ChevronRight, Globe, Megaphone, Shield, UserCog, Inbox,
} from 'lucide-react';

export interface NavItem { id: string; label: string; icon: React.ElementType; to?: string; children?: NavItem[]; }

export const NAV: NavItem[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' },
  { id: 'crm', label: 'CRM', icon: Users, children: [
    { id: 'leads', label: 'Leads', icon: Inbox, to: '/admin/leads' },
    { id: 'clients', label: 'Clients', icon: UserRound, to: '/admin/clients' },
    { id: 'projects-jobs', label: 'Projects / Jobs', icon: FolderKanban, to: '/admin/jobs' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, to: '/admin/messages' },
    { id: 'files', label: 'Files', icon: FileText, to: '/admin/files' },
    { id: 'invoices', label: 'Invoices', icon: Receipt, to: '/admin/invoices' },
  ] },
  { id: 'content', label: 'Content', icon: Briefcase, children: [
    { id: 'services', label: 'Services', icon: Sparkles, to: '/admin/services' },
    { id: 'solutions', label: 'Solutions', icon: Tags, to: '/admin/solutions' },
    { id: 'portfolio', label: 'Portfolio', icon: ImageIcon, to: '/admin/portfolio' },
    { id: 'testimonials', label: 'Testimonials', icon: Users, to: '/admin/testimonials' },
    { id: 'faqs', label: 'FAQs', icon: MessageSquare, to: '/admin/faqs' },
    { id: 'insights', label: 'Insights', icon: Newspaper, to: '/admin/insights' },
    { id: 'products', label: 'Products', icon: Package, to: '/admin/products' },
    { id: 'labs', label: 'AI Lab Content', icon: FlaskConical, to: '/admin/labs' },
    { id: 'pricing', label: 'Pricing', icon: BadgeDollarSign, to: '/admin/pricing' },
    { id: 'tools', label: 'Tools / Stack', icon: Wrench, to: '/admin/tools' },
    { id: 'media', label: 'Media Library', icon: ImagePlus, to: '/admin/media' },
  ] },
  { id: 'ai', label: 'AI', icon: Bot, children: [
    { id: 'ai-chat', label: 'Admin AI Chat', icon: MessagesSquare, to: '/admin/ai/chat' },
    { id: 'ai-control', label: 'Model Control', icon: Settings2, to: '/admin/ai/models' },
    { id: 'ai-health', label: 'Usage & Health', icon: Activity, to: '/admin/ai/health' },
    { id: 'ai-conversations', label: 'Conversations', icon: MessagesSquare, to: '/admin/ai/conversations' },
  ] },
  { id: 'settings', label: 'Settings', icon: Settings2, children: [
    { id: 'general', label: 'General', icon: Globe, to: '/admin/settings/general' },
    { id: 'social', label: 'Social & Contact', icon: Users, to: '/admin/settings/social' },
    { id: 'availability', label: 'Site Availability', icon: Activity, to: '/admin/settings/availability' },
    { id: 'notifications', label: 'Notifications', icon: Megaphone, to: '/admin/settings/notifications' },
    { id: 'brand', label: 'Brand Assets', icon: ImageIcon, to: '/admin/settings/brand' },
    { id: 'founder', label: 'Founder Information', icon: UserCog, to: '/admin/settings/founder' },
    { id: 'seo', label: 'SEO', icon: Tags, to: '/admin/settings/seo' },
    { id: 'security', label: 'Security', icon: Shield, to: '/admin/settings/security' },
  ] },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onLogout: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, onLogout }: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ crm: true, content: false, ai: false, settings: false });
  const toggleGroup = (id: string) => setOpenGroups(g => ({ ...g, [id]: !g[id] }));

  const renderItem = (item: NavItem, depth = 0) => {
    if (item.children) {
      const open = openGroups[item.id];
      return (
        <div key={item.id} className={`adm-nav-group ${open ? 'open' : ''}`}>
          <div className="adm-nav-item" onClick={() => toggleGroup(item.id)}>
            <item.icon />
            <span className="adm-nav-label">{item.label}</span>
            <ChevronRight className="adm-nav-chevron" />
          </div>
          <div className="adm-nav-children">{item.children.map(c => renderItem(c, depth+1))}</div>
        </div>
      );
    }
    return (
      <NavLink key={item.id} to={item.to!} className={({ isActive }) => `adm-nav-item${isActive ? ' active' : ''}`}
        onClick={onMobileClose}>
        <item.icon />
        <span className="adm-nav-label">{item.label}</span>
      </NavLink>
    );
  };

  const inner = (
    <>
      <div className="adm-brand">
        <div className="adm-mark">TT</div>
        <div>
          <div className="adm-brand-name">Toluene Tech</div>
          <div className="adm-brand-sub">Control Center</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {NAV.map(section => {
          // Section labels only for top-level groups; Dashboard has no children so label it OVERVIEW.
          if (!section.children) {
            return <div key={section.id}>{renderItem(section)}</div>;
          }
          return (
            <div key={section.id}>
              <div className="adm-nav-section-label">{section.label}</div>
              {section.children.map(c => renderItem(c))}
            </div>
          );
        })}
      </div>
      <div className="adm-sidebar-footer">
        <button className="adm-nav-item" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <PanelLeftOpen/> : <PanelLeftClose/>}
          <span className="adm-nav-label">{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
        <button className="adm-nav-item" onClick={onLogout} style={{ color: '#dc2626' }}>
          <LogOut/>
          <span className="adm-nav-label">Log out</span>
        </button>
        <div className="adm-collapsed-note">v2.2</div>
      </div>
    </>
  );

  return (
    <>
      <aside className={`adm-sidebar ${collapsed ? 'collapsed' : ''}`}>{inner}</aside>
      {mobileOpen && (
        <>
          <div className="adm-scrim" onClick={onMobileClose} style={{ zIndex: 65 }}/>
          <aside className="adm-mobile-drawer" style={{ zIndex: 70 }}>{inner}</aside>
        </>
      )}
    </>
  );
}
