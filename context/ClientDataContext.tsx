/**
 * ClientDataContext — live client-portal data.
 *
 * Source of truth: Neon-backed Worker (/client/*). This replaces the demo/
 * Firebase-seeded DataContext for the Client Portal UI. Data is fetched with
 * the JWT bearer token from ClientAuthContext and cached locally; mutations
 * trigger targeted refetches to keep the UI consistent.
 *
 * The legacy DataContext is still used for the public site and admin CMS.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useClientAuth } from './ClientAuthContext';
import { createClientApi, type ClientApi, type ClientProject, type Milestone, type Task, type ProjectFile, type Message, type Invoice, type InvoiceItem, type Notification, type DashboardData, type ClientMe } from '../lib/client';

interface ClientDataState {
  me: ClientMe | null;
  dashboard: DashboardData | null;
  projects: ClientProject[];
  milestonesByProject: Record<string, Milestone[]>;
  tasksByProject: Record<string, Task[]>;
  filesByProject: Record<string, ProjectFile[]>;
  messagesByProject: Record<string, Message[]>;
  invoices: Invoice[];
  invoiceItems: Record<string, InvoiceItem[]>;
  notifications: Notification[];
  loading: {
    me: boolean; dashboard: boolean; projects: boolean; invoices: boolean; notifications: boolean;
    [k: string]: boolean;
  };
  error: string | null;
}

interface ClientDataContextType extends ClientDataState {
  refreshAll: () => Promise<void>;
  refreshProject: (projectId: string) => Promise<void>;
  refreshDashboard: () => Promise<void>;
  refreshInvoices: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  selectProject: (id: string | null) => void;
  selectedProjectId: string | null;
  // Actions
  sendMessage: (projectId: string, body: string) => Promise<void>;
  approveMilestone: (projectId: string, milestoneId: string, comment?: string) => Promise<void>;
  rejectMilestone: (projectId: string, milestoneId: string, reason: string) => Promise<void>;
  uploadFile: (projectId: string, file: File, onProgress?: (pct: number) => void) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  getFileDownloadUrl: (fileId: string) => Promise<string>;
  getInvoiceWithItems: (id: string) => Promise<{ item: Invoice; items: InvoiceItem[] }>;
  getPaymentsConfig: () => Promise<{ configured: boolean; provider: string; publicKey: string | null }>;
  verifyPayment: (tx: { transaction_id: string; invoice_id: string; tx_ref: string }) => Promise<any>;
}

const ClientDataContext = createContext<ClientDataContextType | undefined>(undefined);

const INITIAL_STATE: ClientDataState = {
  me: null,
  dashboard: null,
  projects: [],
  milestonesByProject: {},
  tasksByProject: {},
  filesByProject: {},
  messagesByProject: {},
  invoices: [],
  invoiceItems: {},
  notifications: [],
  loading: { me: true, dashboard: true, projects: true, invoices: true, notifications: true },
  error: null,
};

async function safeCall<T>(
  fn: () => Promise<T>,
  setLoading: (k: string, v: boolean) => void,
  key: string,
  setError: (e: string | null) => void,
): Promise<T | null> {
  try {
    setLoading(key, true);
    return await fn();
  } catch (e: any) {
    if (e?.status !== 401) setError(e?.message || 'Something went wrong.');
    return null;
  } finally {
    setLoading(key, false);
  }
}

export const ClientDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, client, logout } = useClientAuth();
  const api = useMemo<ClientApi | null>(() => (token ? createClientApi(token) : null), [token]);
  const [state, setState] = useState<ClientDataState>(INITIAL_STATE);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const setLoading = useCallback((key: string, val: boolean) => {
    setState(s => ({ ...s, loading: { ...s.loading, [key]: val } }));
  }, []);
  const setError = useCallback((msg: string | null) => {
    setState(s => ({ ...s, error: msg }));
  }, []);

  // Handle auth errors globally.
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      const err = (e.error ?? e) as any;
      if (err?.status === 401) {
        logout();
      }
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, [logout]);

  const refreshAll = useCallback(async () => {
    if (!api || !mounted.current) return;
    setError(null);
    const [me, dash, projects, invoices, notifs] = await Promise.all([
      safeCall(() => api.me(), setLoading, 'me', setError),
      safeCall(() => api.dashboard(), setLoading, 'dashboard', setError),
      safeCall(() => api.listProjects(), setLoading, 'projects', setError),
      safeCall(() => api.listInvoices(), setLoading, 'invoices', setError),
      safeCall(() => api.listNotifications(), setLoading, 'notifications', setError),
    ]);
    if (!mounted.current) return;
    setState(s => ({
      ...s,
      me: me ?? s.me,
      dashboard: (dash as DashboardData | null) ?? s.dashboard,
      projects: (projects as ClientProject[] | null) ?? s.projects,
      invoices: (invoices as Invoice[] | null) ?? s.invoices,
      notifications: (notifs as { items: Notification[] } | null)?.items ?? s.notifications,
    }));
  }, [api, setLoading, setError]);

  const refreshProject = useCallback(async (projectId: string) => {
    if (!api || !mounted.current) return;
    const [milestones, tasks, files, messages] = await Promise.all([
      safeCall(() => api.listMilestones(projectId), setLoading, `ms-${projectId}`, setError),
      safeCall(() => api.listTasks(projectId), setLoading, `tk-${projectId}`, setError),
      safeCall(() => api.listFiles(projectId), setLoading, `fl-${projectId}`, setError),
      safeCall(() => api.listMessages(projectId), setLoading, `mg-${projectId}`, setError),
    ]);
    if (!mounted.current) return;
    setState(s => ({
      ...s,
      milestonesByProject: { ...s.milestonesByProject, [projectId]: milestones ?? s.milestonesByProject[projectId] ?? [] },
      tasksByProject: { ...s.tasksByProject, [projectId]: tasks ?? s.tasksByProject[projectId] ?? [] },
      filesByProject: { ...s.filesByProject, [projectId]: files ?? s.filesByProject[projectId] ?? [] },
      messagesByProject: { ...s.messagesByProject, [projectId]: messages ?? s.messagesByProject[projectId] ?? [] },
    }));
  }, [api, setLoading, setError]);

  const refreshDashboard = useCallback(async () => {
    if (!api) return;
    const dash = await safeCall(() => api.dashboard(), setLoading, 'dashboard', setError);
    if (dash) {
      const d = dash as DashboardData;
      setState(s => ({ ...s, dashboard: d, projects: d.projectsList?.length ? d.projectsList : s.projects }));
    }
  }, [api, setLoading, setError]);

  const refreshInvoices = useCallback(async () => {
    if (!api) return;
    const items = await safeCall(() => api.listInvoices(), setLoading, 'invoices', setError);
    if (items) setState(s => ({ ...s, invoices: items }));
  }, [api, setLoading, setError]);

  const refreshNotifications = useCallback(async () => {
    if (!api) return;
    const r = await safeCall(() => api.listNotifications(), setLoading, 'notifications', setError);
    if (r) setState(s => ({ ...s, notifications: (r as { items: Notification[] }).items }));
  }, [api, setLoading, setError]);

  // Initial load when token is available.
  useEffect(() => {
    if (api && client) {
      refreshAll();
    } else {
      setState(INITIAL_STATE);
    }
  }, [api, client, refreshAll]);

  // Auto-select first project.
  useEffect(() => {
    if (!selectedProjectId && state.projects.length > 0) setSelectedProjectId(state.projects[0].id);
  }, [state.projects, selectedProjectId]);

  // ---------- Actions ----------
  const sendMessage = useCallback(async (projectId: string, body: string) => {
    if (!api) throw new Error('Not authenticated.');
    await api.sendMessage(projectId, body);
    // Refetch messages + dashboard (notifications badge).
    await Promise.all([refreshProject(projectId), refreshNotifications(), refreshDashboard()]);
  }, [api, refreshProject, refreshNotifications, refreshDashboard]);

  const approveMilestone = useCallback(async (projectId: string, milestoneId: string, comment?: string) => {
    if (!api) throw new Error('Not authenticated.');
    await api.approveMilestone(projectId, milestoneId, true, comment);
    await Promise.all([refreshProject(projectId), refreshDashboard(), refreshNotifications()]);
  }, [api, refreshProject, refreshDashboard, refreshNotifications]);

  const rejectMilestone = useCallback(async (projectId: string, milestoneId: string, reason: string) => {
    if (!api) throw new Error('Not authenticated.');
    await api.approveMilestone(projectId, milestoneId, false, reason);
    await Promise.all([refreshProject(projectId), refreshDashboard(), refreshNotifications()]);
  }, [api, refreshProject, refreshDashboard, refreshNotifications]);

  const uploadFile = useCallback(async (projectId: string, file: File, onProgress?: (pct: number) => void) => {
    if (!api) throw new Error('Not authenticated.');
    await api.uploadFile(projectId, file, onProgress);
    await Promise.all([refreshProject(projectId), refreshNotifications()]);
  }, [api, refreshProject, refreshNotifications]);

  const markNotificationRead = useCallback(async (id: string) => {
    if (!api) return;
    await api.markNotificationRead(id);
    setState(s => ({ ...s, notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n) }));
  }, [api]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!api) return;
    await api.markAllNotificationsRead();
    setState(s => ({ ...s, notifications: s.notifications.map(n => ({ ...n, isRead: true })) }));
  }, [api]);

  const getFileDownloadUrl = useCallback(async (fileId: string) => {
    if (!api) throw new Error('Not authenticated.');
    const r = await api.getFileDownloadUrl(fileId);
    // Convert relative worker paths to full URLs.
    if (r.url.startsWith('/')) return apiBase() + r.url;
    return r.url;
  }, [api]);

  const getInvoiceWithItems = useCallback(async (id: string) => {
    if (!api) throw new Error('Not authenticated.');
    return api.getInvoice(id);
  }, [api]);

  const getPaymentsConfig = useCallback(async () => {
    if (!api) throw new Error('Not authenticated.');
    return api.getPaymentsConfig();
  }, [api]);

  const verifyPayment = useCallback(async (tx: { transaction_id: string; invoice_id: string; tx_ref: string }) => {
    if (!api) throw new Error('Not authenticated.');
    const r = await api.verifyPayment(tx);
    await refreshInvoices();
    await refreshDashboard();
    return r;
  }, [api, refreshInvoices, refreshDashboard]);

  const value: ClientDataContextType = {
    ...state,
    selectedProjectId,
    refreshAll, refreshProject, refreshDashboard, refreshInvoices, refreshNotifications,
    selectProject: setSelectedProjectId,
    sendMessage, approveMilestone, rejectMilestone, uploadFile,
    markNotificationRead, markAllNotificationsRead,
    getFileDownloadUrl, getInvoiceWithItems, getPaymentsConfig, verifyPayment,
  };

  return <ClientDataContext.Provider value={value}>{children}</ClientDataContext.Provider>;
}

export const useClientData = () => {
  const ctx = useContext(ClientDataContext);
  if (!ctx) throw new Error('useClientData must be used within ClientDataProvider');
  return ctx;
};

// Needed for getFileDownloadUrl absolute-URL resolution.
import { apiBase } from '../lib/api';
