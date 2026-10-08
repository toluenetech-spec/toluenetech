import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  LogOut, FolderKanban, MessageSquare, FileText, CheckCircle2, Clock,
  User as UserIcon, Send, AlertCircle, RefreshCw, UploadCloud, File as FileIcon,
  Bell, CreditCard, XCircle, ThumbsUp, ThumbsDown, ChevronRight, Home as HomeIcon,
  Loader2, Plus, Paperclip, X, AlertTriangle,
} from 'lucide-react';
import { useClientAuth } from '../../context/ClientAuthContext';
import { useClientData } from '../../context/ClientDataContext';
import type { Milestone, ProjectFile, Message, Invoice, InvoiceItem, Task, Notification } from '../../lib/client';

type Tab = 'overview' | 'milestones' | 'tasks' | 'files' | 'messages' | 'invoices';

const STATUS_STYLES: Record<string, string> = {
  PLANNING: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ON_HOLD: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PAUSED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  REVIEW: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ARCHIVED: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  // Legacy
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'in-progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'on-hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};
const MILESTONE_COLOR: Record<string, string> = {
  PENDING: 'bg-slate-300 dark:bg-slate-700',
  IN_PROGRESS: 'bg-brand-500',
  COMPLETED: 'bg-amber-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-slate-400',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-amber-500',
  URGENT: 'text-red-500',
};
const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  SENT: { label: 'Awaiting payment', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  VIEWED: { label: 'Viewed', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  PARTIALLY_PAID: { label: 'Partially paid', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PAID: { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  OVERDUE: { label: 'Overdue', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  VOID: { label: 'Void', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; }
}
function fmtMoney(cents: number | null | undefined, currency = 'USD'): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}
function fileSize(n: number | null | undefined): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fileNameFor(f: ProjectFile): string { return (f as any).filename || (f as any).name || 'File'; }
function fileSizeFor(f: ProjectFile): number | null { return f.sizeBytes ?? (f as any).size ?? null; }
function mimeFor(f: ProjectFile): string { return f.mimeType || (f as any).type || 'application/octet-stream'; }
function fileUploadedBy(f: ProjectFile): string { return f.uploadedByRole || (f as any).uploadedBy || 'team'; }
function initials(name: string): string {
  return String(name || '').split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'TT';
}
function msgAuthorName(m: Message): string {
  return m.fromName || (m.isFromClient ? 'You' : 'Team');
}
function msgBody(m: Message): string { return m.body || (m as any).text || ''; }
function msgAuthor(m: Message): string { return m.fromName || (m as any).authorName || (m.isFromClient ? 'You' : 'Team'); }

// Re-exported for use inside tabs that need a skeleton.
const TabLoading = () => <div className="space-y-3"><Skeleton className="h-20 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" /></div>;

// Load Flutterwave inline script once and return a promise that resolves
// when the global `FlutterwaveCheckout` is available.
let flwPromise: Promise<any> | null = null;
function loadFlutterwave(): Promise<any> {
  if (flwPromise) return flwPromise;
  flwPromise = new Promise((resolve, reject) => {
    if ((window as any).FlutterwaveCheckout) return resolve((window as any).FlutterwaveCheckout);
    const s = document.createElement('script');
    s.src = 'https://checkout.flutterwave.com/v3.js';
    s.async = true;
    s.onload = () => {
      // wait for global
      const w = window as any;
      if (w.FlutterwaveCheckout) return resolve(w.FlutterwaveCheckout);
      let tries = 0;
      const i = setInterval(() => {
        tries++;
        if (w.FlutterwaveCheckout) { clearInterval(i); resolve(w.FlutterwaveCheckout); }
        else if (tries > 30) { clearInterval(i); reject(new Error('Flutterwave failed to load.')); }
      }, 200);
    };
    s.onerror = () => reject(new Error('Could not load Flutterwave script.'));
    document.head.appendChild(s);
  });
  return flwPromise;
}

function openFlutterwaveCheckout(opts: {
  publicKey: string;
  invoice: Invoice;
  clientName: string;
  clientEmail: string;
  onSuccess: (tx: { transaction_id: string; tx_ref: string }) => void;
  onClose: () => void;
}): Promise<void> {
  return loadFlutterwave().then(FlutterwaveCheckout => {
    const txRef = `tt_${opts.invoice.id}_${Date.now()}`;
    const amount = Math.round(((opts.invoice.amountCents || 0) / 100) * 100) / 100;
    FlutterwaveCheckout({
      public_key: opts.publicKey,
      tx_ref: txRef,
      amount: amount,
      currency: opts.invoice.currency || 'USD',
      payment_options: 'card,banktransfer,ussd',
      customer: { email: opts.clientEmail, name: opts.clientName },
      customizations: {
        title: 'Toluene Tech',
        description: `Invoice ${(opts.invoice as any).number || opts.invoice.id.slice(0, 8)}`,
      },
      callback: (data: any) => {
        // callback fires on successful checkout; we still verify server-side.
        opts.onSuccess({ transaction_id: String(data.transaction_id || data.id || ''), tx_ref: String(data.tx_ref || txRef) });
      },
      onclose: () => opts.onClose(),
    });
  });
}

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; message?: string; action?: React.ReactNode }> = ({ icon, title, message, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
    <div className="mb-3 text-slate-400 dark:text-slate-500">{icon}</div>
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
    {message && <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const ErrorBox: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10">
    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
    <div className="flex-1">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">Something went wrong</p>
      <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{message}</p>
      <button onClick={onRetry} className="mt-2 inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  </div>
);

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />
);

// ------------- Main Portal -------------
const Portal: React.FC = () => {
  const { client, logout, token } = useClientAuth();
  const navigate = useNavigate();
  const data = useClientData();
  const [tab, setTab] = useState<Tab>('overview');
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<Milestone | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Milestone | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [invoiceDetailId, setInvoiceDetailId] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<{ item: Invoice; items: InvoiceItem[] } | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth guard
  if (!client || !token) return <Navigate to="/portal" replace />;

  const activeProject = useMemo(
    () => (data.selectedProjectId ? data.projects.find(p => p.id === data.selectedProjectId) : data.projects[0]),
    [data.projects, data.selectedProjectId],
  );
  const projectId = activeProject?.id;
  const milestones = useMemo(() => (projectId ? data.milestonesByProject[projectId] || [] : []), [data.milestonesByProject, projectId]);
  const tasks = useMemo(() => (projectId ? data.tasksByProject[projectId] || [] : []), [data.tasksByProject, projectId]);
  const files = useMemo(() => (projectId ? (data.filesByProject[projectId] || []).filter(f => !f.deletedAt) : []), [data.filesByProject, projectId]);
  const messages = useMemo(() => (projectId ? data.messagesByProject[projectId] || [] : []), [data.messagesByProject, projectId]);

  // Load project data when active project changes.
  useEffect(() => {
    if (projectId) data.refreshProject(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Scroll messages to bottom.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, tab]);

  // Poll notifications + dashboard every 60s while portal is open.
  useEffect(() => {
    const i = setInterval(() => { data.refreshNotifications(); data.refreshDashboard(); }, 60_000);
    return () => clearInterval(i);
  }, [data]);

  async function doSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeProject || !msgInput.trim() || sending) return;
    setSending(true);
    try {
      await data.sendMessage(activeProject.id, msgInput.trim());
      setMsgInput('');
    } catch (err: any) {
      alert(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  async function doUpload(file: File) {
    if (!activeProject) return;
    // Client cap 10 MB, allowed list matches server.
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/zip','text/plain','text/markdown','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !/\.(pdf|zip|txt|md|docx?|jpe?g|png|gif|webp)$/i.test(file.name)) {
      alert('That file type is not allowed.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) { alert('File is larger than the 10 MB limit.'); return; }
    setUploading(true); setUploadProgress(0);
    try {
      await data.uploadFile(activeProject.id, file, setUploadProgress);
      setSelectedFileForUpload(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert(err?.message || 'Upload failed.');
    } finally {
      setUploading(false); setUploadProgress(0);
    }
  }

  async function openInvoice(id: string) {
    setInvoiceDetailId(id); setInvoiceDetail(null); setInvoiceLoading(true);
    try { setInvoiceDetail(await data.getInvoiceWithItems(id)); }
    catch (err: any) { alert(err?.message || 'Could not load invoice.'); }
    finally { setInvoiceLoading(false); }
  }

  const unreadNotifs = data.notifications.filter(n => !n.isRead).length;

  const Loading = <div className="space-y-3">
    <Skeleton className="h-20 w-full rounded-xl" />
    <Skeleton className="h-16 w-full rounded-xl" />
    <Skeleton className="h-16 w-full rounded-xl" />
  </div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-white/5 dark:bg-ink-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-400 text-xs font-black text-white">TT</div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-slate-900 dark:text-white">Client Portal</div>
              <div className="-mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{client.name}{client.company ? ` · ${client.company}` : ''}</div>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setNotifOpen(v => !v)} className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadNotifs > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unreadNotifs > 9 ? '9+' : unreadNotifs}</span>}
            </button>
            <button onClick={() => { logout(); navigate('/portal'); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        {/* Notifications dropdown */}
        {notifOpen && (
          <div className="absolute right-4 top-14 z-30 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-ink-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-white/5">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
              {unreadNotifs > 0 && (
                <button onClick={data.markAllNotificationsRead} className="text-xs text-brand-600 hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {data.loading.notifications && <div className="p-4 text-center text-sm text-slate-400">Loading…</div>}
              {!data.loading.notifications && data.notifications.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No notifications yet.</div>
              )}
              {data.notifications.map(n => (
                <button key={n.id} onClick={() => { if (!n.isRead) data.markNotificationRead(n.id); if (n.link) window.location.href = n.link; }}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 ${!n.isRead ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!n.isRead ? 'bg-brand-500' : 'bg-transparent'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase text-slate-400">{fmtDate(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {data.error && (
          <div className="mb-4"><ErrorBox message={data.error} onRetry={data.refreshAll} /></div>
        )}

        {data.loading.projects && data.projects.length === 0 ? (
          <div className="space-y-4">{Loading}</div>
        ) : data.projects.length === 0 ? (
          <EmptyState icon={<FolderKanban size={36} />} title="No projects yet" message="When Toluene Tech assigns a project to you, it will appear here with milestones, files and messages." />
        ) : (
          <>
            {/* Project selector */}
            <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-1">
              {data.projects.map(p => (
                <button key={p.id} onClick={() => { data.selectProject(p.id); setTab('overview'); }}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${activeProject?.id === p.id ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30' : 'tt-glass text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>
                  {p.title}
                </button>
              ))}
            </div>

            {/* Tabs */}
            {activeProject && (
              <div className="mb-6 flex flex-wrap gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm dark:bg-white/5">
                {([
                  ['overview', <HomeIcon size={14} />, 'Overview'],
                  ['milestones', <CheckCircle2 size={14} />, 'Milestones'],
                  ['tasks', <Clock size={14} />, 'Tasks'],
                  ['files', <FileText size={14} />, 'Files'],
                  ['messages', <MessageSquare size={14} />, 'Messages'],
                  ['invoices', <CreditCard size={14} />, 'Invoices'],
                ] as [Tab, React.ReactNode, string][]).map(([k, icon, label]) => (
                  <button key={k} onClick={() => setTab(k)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tab === k ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            )}

            {activeProject && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  {tab === 'overview' && <OverviewTab project={activeProject} data={data} milestones={milestones} tasks={tasks} files={files} messages={messages} setTab={setTab} />}
                  {tab === 'milestones' && <MilestonesTab milestones={milestones} loading={data.loading[`ms-${activeProject.id}`]} onRefresh={() => data.refreshProject(activeProject.id)} onApprove={setApprovalTarget} onReject={setRejectTarget} />}
                  {tab === 'tasks' && <TasksTab tasks={tasks} loading={data.loading[`tk-${activeProject.id}`]} onRefresh={() => data.refreshProject(activeProject.id)} />}
                  {tab === 'files' && (
                    <FilesTab files={files} loading={data.loading[`fl-${activeProject.id}`]} onRefresh={() => data.refreshProject(activeProject.id)}
                      onPickFile={() => fileInputRef.current?.click()}
                      uploading={uploading} uploadProgress={uploadProgress}
                      onDownload={async (f) => {
                        try { window.open(await data.getFileDownloadUrl(f.id), '_blank', 'noopener,noreferrer'); }
                        catch (err: any) { alert(err?.message || 'Could not download file.'); }
                      }}
                    />
                  )}
                  {tab === 'messages' && (
                    <MessagesTab messages={messages} loading={data.loading[`mg-${activeProject.id}`]} onRefresh={() => data.refreshProject(activeProject.id)}
                      msgInput={msgInput} setMsgInput={setMsgInput} sending={sending} onSend={doSend} messagesEndRef={messagesEndRef}
                    />
                  )}
                  {tab === 'invoices' && <InvoicesTab invoices={data.invoices} onOpen={openInvoice} />}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  <ProjectSidebar project={activeProject} />
                  <YourDetails client={client} />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={e => {
        const f = e.target.files?.[0]; if (f) doUpload(f);
      }} />

      {/* Approval dialog */}
      {approvalTarget && (
        <ConfirmDialog title={`Approve milestone: ${approvalTarget.title}`}
          message="Approving confirms this milestone has been delivered to your satisfaction. The team will be notified."
          confirmLabel="Approve" confirmClass="bg-emerald-600 hover:bg-emerald-700"
          icon={<ThumbsUp className="h-5 w-5 text-emerald-500" />}
          onCancel={() => setApprovalTarget(null)}
          onConfirm={async () => {
            if (!activeProject) return;
            try { await data.approveMilestone(activeProject.id, approvalTarget.id); setApprovalTarget(null); }
            catch (err: any) { alert(err?.message || 'Approval failed.'); }
          }}
        />
      )}
      {rejectTarget && (
        <RejectDialog milestone={rejectTarget} reason={rejectReason} setReason={setRejectReason}
          onCancel={() => { setRejectTarget(null); setRejectReason(''); }}
          onConfirm={async () => {
            if (!activeProject) return;
            if (!rejectReason.trim()) { alert('Please provide a reason so the team understands what to address.'); return; }
            try { await data.rejectMilestone(activeProject.id, rejectTarget.id, rejectReason.trim()); setRejectTarget(null); setRejectReason(''); }
            catch (err: any) { alert(err?.message || 'Rejection failed.'); }
          }}
        />
      )}
      {invoiceDetailId && invoiceDetail && (
        <InvoiceDetailDialog invoice={invoiceDetail.item} items={invoiceDetail.items}
          loading={invoiceLoading}
          onClose={() => { setInvoiceDetailId(null); setInvoiceDetail(null); }}
          onPay={async () => {
            try {
              setInvoiceLoading(true);
              const cfg = await data.getPaymentsConfig();
              if (!cfg.configured || !cfg.publicKey) {
                alert('Online payments are not yet configured on this environment. Please contact Toluene Tech to arrange payment. No payment was charged.');
                return;
              }
              await openFlutterwaveCheckout({
                publicKey: cfg.publicKey,
                invoice: invoiceDetail.item,
                clientName: data.me?.fullName || data.me?.email || 'Client',
                clientEmail: data.me?.email || '',
                onSuccess: async (tx) => {
                  try {
                    await data.verifyPayment({ invoice_id: invoiceDetail!.item.id, transaction_id: tx.transaction_id, tx_ref: tx.tx_ref });
                    alert('Payment verified successfully.');
                    await data.refreshAll();
                  } catch (e: any) {
                    alert(`Payment received but verification failed: ${e?.message || 'unknown error'}. Our team will reconcile.`);
                  }
                },
                onClose: () => {},
              });
            } catch (e: any) {
              alert(`Unable to start payment: ${e?.message || 'unknown error'}`);
            } finally {
              setInvoiceLoading(false);
            }
          }}
        />
      )}
      {invoiceDetailId && invoiceLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 dark:bg-ink-900"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
        </div>
      )}
    </div>
  );
};

// ========== Tabs ==========
const OverviewTab: React.FC<{ project: any; data: ReturnType<typeof useClientData>; milestones: Milestone[]; tasks: Task[]; files: ProjectFile[]; messages: Message[]; setTab: (t: Tab) => void }> = ({ project, data, milestones, tasks, messages, setTab }) => {
  const dash = data.dashboard;
  const nextMilestone = milestones.find(m => m.status === 'PENDING' || m.status === 'IN_PROGRESS' || m.status === 'COMPLETED');
  const openTasks = tasks.filter(t => t.status !== 'DONE').length;
  const unreadMsgs = messages.filter(m => !m.isFromClient && !m.isRead).length;
  const stats = [
    { label: 'Active projects', value: dash?.projects.active ?? '—', icon: <FolderKanban className="h-4 w-4" />, tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    { label: 'Completed', value: dash?.projects.completed ?? '—', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { label: 'Unread messages', value: dash?.unreadNotifications ?? unreadMsgs, icon: <Bell className="h-4 w-4" />, tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    { label: 'Open invoices', value: dash?.outstandingInvoices ?? '—', icon: <CreditCard className="h-4 w-4" />, tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  ];
  return (
    <div className="space-y-6">
      <div className="tt-glass rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{project.title}</h2>
            {project.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{project.description}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[project.status] || STATUS_STYLES.ACTIVE}`}>{(project.status || '').replace(/_/g, ' ')}</span>
        </div>
        {typeof project.progress === 'number' && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500"><span>Progress</span><span>{project.progress}%</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all" style={{ width: `${project.progress}%` }} /></div>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-4">
          {project.priority && <div><span className="uppercase tracking-wide text-slate-400">Priority</span><p className={`mt-0.5 text-sm font-semibold ${PRIORITY_COLOR[project.priority] || ''}`}>{project.priority}</p></div>}
          {project.startDate && <div><span className="uppercase tracking-wide text-slate-400">Start</span><p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtDate(project.startDate)}</p></div>}
          {project.dueDate && <div><span className="uppercase tracking-wide text-slate-400">Due</span><p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtDate(project.dueDate)}</p></div>}
          {project.totalCents ? <div><span className="uppercase tracking-wide text-slate-400">Value</span><p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{fmtMoney(project.totalCents, project.currency || 'USD')}</p></div> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="tt-glass rounded-xl p-3">
            <div className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded-lg ${s.tone}`}>{s.icon}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">{s.value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      {nextMilestone && (
        <div className="tt-glass rounded-2xl p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4" /> Next milestone
          </h3>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{nextMilestone.title}</p>
              {nextMilestone.dueDate && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Due {fmtDate(nextMilestone.dueDate)}</p>}
            </div>
            <button onClick={() => setTab('milestones')} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              View <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {openTasks > 0 && (
        <div className="tt-glass rounded-2xl p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Clock className="h-4 w-4" /> Open tasks ({openTasks})</h3>
            <button onClick={() => setTab('tasks')} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">View <ChevronRight className="h-3 w-3" /></button>
          </div>
          <ul className="space-y-2">
            {tasks.filter(t => t.status !== 'DONE').slice(0, 4).map(t => (
              <li key={t.id} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.status === 'IN_PROGRESS' ? 'bg-brand-500' : t.status === 'BLOCKED' ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className="flex-1">{t.title}</span>
                {t.dueDate && <span className="text-xs text-slate-400">{fmtDate(t.dueDate)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const MilestonesTab: React.FC<{ milestones: Milestone[]; loading: boolean; onRefresh: () => void; onApprove: (m: Milestone) => void; onReject: (m: Milestone) => void }> = ({ milestones, loading, onRefresh, onApprove, onReject }) => {
  if (loading && milestones.length === 0) return <div className="tt-glass rounded-2xl p-6"><TabLoading /></div>;
  if (milestones.length === 0) return <EmptyState icon={<CheckCircle2 size={36} />} title="No milestones yet" message="Milestones will appear here as the project is planned." action={<button onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"><RefreshCw className="h-3 w-3" /> Refresh</button>} />;
  return (
    <div className="tt-glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><CheckCircle2 className="h-5 w-5 text-brand-500" /> Milestones</h3>
        <button onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"><RefreshCw className="h-3 w-3" /> Refresh</button>
      </div>
      <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5 dark:border-slate-800">
        {milestones.map(m => {
          const color = MILESTONE_COLOR[m.status] || MILESTONE_COLOR.PENDING;
          const canApprove = m.status === 'COMPLETED';
          return (
            <li key={m.id} className="relative">
              <span className={`absolute -left-[26px] top-1.5 h-4 w-4 rounded-full border-4 border-white ring-0 ${color} dark:border-ink-950`} />
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/5 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white">{m.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[m.status] || 'bg-slate-100 text-slate-700'}`}>{m.status.replace(/_/g, ' ')}</span>
                    </div>
                    {m.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{m.description}</p>}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {m.dueDate && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Due {fmtDate(m.dueDate)}</span>}
                      {m.amountCents != null && <span>Amount: {fmtMoney(m.amountCents)}</span>}
                      {m.approvedAt && <span className="text-emerald-600 dark:text-emerald-400">Approved {fmtDate(m.approvedAt)}</span>}
                      {m.rejectionReason && <span className="text-red-600 dark:text-red-400">Rejected: {m.rejectionReason}</span>}
                    </div>
                  </div>
                  {canApprove && (
                    <div className="flex gap-2">
                      <button onClick={() => onReject(m)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20">
                        <ThumbsDown className="h-3 w-3" /> Request changes
                      </button>
                      <button onClick={() => onApprove(m)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                        <ThumbsUp className="h-3 w-3" /> Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const TasksTab: React.FC<{ tasks: Task[]; loading: boolean; onRefresh: () => void }> = ({ tasks, loading, onRefresh }) => {
  if (loading && tasks.length === 0) return <div className="tt-glass rounded-2xl p-6"><TabLoading /></div>;
  if (tasks.length === 0) return <EmptyState icon={<Clock size={36} />} title="No tasks yet" message="Tasks for this project will appear here as they're scheduled." />;
  const columns: { key: Task['status']; label: string; items: Task[] }[] = [
    { key: 'TODO', label: 'To do', items: tasks.filter(t => t.status === 'TODO') },
    { key: 'IN_PROGRESS', label: 'In progress', items: tasks.filter(t => t.status === 'IN_PROGRESS') },
    { key: 'BLOCKED', label: 'Blocked', items: tasks.filter(t => t.status === 'BLOCKED') },
    { key: 'DONE', label: 'Done', items: tasks.filter(t => t.status === 'DONE') },
  ];
  return (
    <div className="tt-glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Clock className="h-5 w-5 text-brand-500" /> Tasks</h3>
        <button onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"><RefreshCw className="h-3 w-3" /> Refresh</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map(col => (
          <div key={col.key}>
            <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              <span>{col.label}</span><span>{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-[11px] text-slate-400 dark:border-white/10">None</p> : col.items.map(t => (
                <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-white/5 dark:bg-white/[0.03]">
                  <p className={`font-medium ${t.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>{t.title}</p>
                  {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                    {t.priority && <span className={PRIORITY_COLOR[t.priority] || ''}>● {t.priority}</span>}
                    {t.dueDate && <span>{fmtDate(t.dueDate)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FilesTab: React.FC<{ files: ProjectFile[]; loading: boolean; onRefresh: () => void; onPickFile: () => void; uploading: boolean; uploadProgress: number; onDownload: (f: ProjectFile) => void }> = ({ files, loading, onRefresh, onPickFile, uploading, uploadProgress, onDownload }) => (
  <div className="tt-glass rounded-2xl p-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><FileText className="h-5 w-5 text-brand-500" /> Files</h3>
      <div className="flex gap-2">
        <button onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"><RefreshCw className="h-3 w-3" /> Refresh</button>
        <button onClick={onPickFile} disabled={uploading} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          <UploadCloud className="h-3 w-3" /> {uploading ? `Uploading ${uploadProgress}%` : 'Upload file'}
        </button>
      </div>
    </div>
    {uploading && (
      <div className="mb-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full bg-brand-500 transition-all" style={{ width: `${uploadProgress}%` }} /></div>
      </div>
    )}
    {loading && files.length === 0 ? <Skeleton className="h-32 w-full" /> : files.length === 0 ? (
      <EmptyState icon={<UploadCloud size={36} />} title="No files yet" message="Files shared with you will appear here. You can also upload files for the team (PDFs, images, documents up to 10 MB)." action={<button onClick={onPickFile} className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"><Plus className="h-3 w-3" /> Upload your first file</button>} />
    ) : (
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {files.map(f => (
          <li key={f.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"><FileIcon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{fileNameFor(f)}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {fileSize(fileSizeFor(f))} · {fileUploadedBy(f) === 'client' ? 'You' : 'Team'} · {fmtDate(f.updatedAt || f.uploadedAt)}
                </p>
              </div>
            </div>
            <button onClick={() => onDownload(f)} className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">Download</button>
          </li>
        ))}
      </ul>
    )}
    <p className="mt-3 text-[11px] text-slate-400">Allowed: JPG, PNG, GIF, WebP, PDF, ZIP, TXT, Markdown, Word documents. Max 10 MB per file.</p>
  </div>
);

const MessagesTab: React.FC<{ messages: Message[]; loading: boolean; onRefresh: () => void; msgInput: string; setMsgInput: (s: string) => void; sending: boolean; onSend: (e?: React.FormEvent) => void; messagesEndRef: React.RefObject<HTMLDivElement | null> }> = ({ messages, loading, onRefresh, msgInput, setMsgInput, sending, onSend, messagesEndRef }) => (
  <div className="tt-glass flex flex-col overflow-hidden rounded-2xl" style={{ minHeight: 480 }}>
    <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 dark:border-white/5">
      <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><MessageSquare className="h-5 w-5 text-brand-500" /> Messages</h3>
      <button onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"><RefreshCw className="h-3 w-3" /> Refresh</button>
    </div>
    <div className="max-h-[480px] flex-1 space-y-3 overflow-y-auto px-6 py-4">
      {loading && messages.length === 0 && <Skeleton className="h-16 w-full" />}
      {!loading && messages.length === 0 && <EmptyState icon={<MessageSquare size={36} />} title="No messages yet" message="Send the first message to start the conversation." />}
      {messages.map(m => {
        const mine = !!m.isFromClient;
        return (
          <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[82%] gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${mine ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200'}`}>{initials(msgAuthor(m))}</div>
              <div>
                <div className={`mb-0.5 flex items-center gap-2 text-[10px] text-slate-400 ${mine ? 'justify-end' : ''}`}>
                  <span className="font-semibold">{mine ? 'You' : msgAuthor(m)}</span>
                  <span>{fmtDate(m.createdAt)}</span>
                  {mine && <span className={m.isRead ? 'text-emerald-500' : 'text-slate-300'}>✓{m.isRead ? '✓' : ''}</span>}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-white/5 dark:text-slate-200'}`}>
                  {msgBody(m).split('\n').map((line, i) => <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>)}
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.attachments.map((a, i) => <div key={i} className="inline-flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-xs dark:bg-white/10"><Paperclip className="h-3 w-3" />{a.filename}</div>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
    <form onSubmit={onSend} className="flex gap-2 border-t border-slate-100 bg-white p-3 dark:border-white/5 dark:bg-ink-900">
      <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Write a message…" disabled={sending}
        className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
      <button type="submit" disabled={sending || !msgInput.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-400 text-white disabled:opacity-50" aria-label="Send">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </form>
  </div>
);

const InvoicesTab: React.FC<{ invoices: Invoice[]; onOpen: (id: string) => void }> = ({ invoices, onOpen }) => {
  if (invoices.length === 0) return <EmptyState icon={<CreditCard size={36} />} title="No invoices yet" message="Invoices issued to you will appear here." />;
  return (
    <div className="tt-glass rounded-2xl p-6">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><CreditCard className="h-5 w-5 text-brand-500" /> Invoices</h3>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2 font-medium">Number</th>
              <th className="px-4 py-2 font-medium">Issued</th>
              <th className="px-4 py-2 font-medium">Due</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-white/5 dark:bg-transparent">
            {invoices.map(inv => {
              const s = INVOICE_STATUS[inv.status] || { label: inv.status, cls: 'bg-slate-100 text-slate-700' };
              return (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-white">{inv.number}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(inv.issuedAt || inv.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(inv.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{fmtMoney(inv.amountCents, inv.currency)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => onOpen(inv.id)} className="text-xs font-medium text-brand-600 hover:underline">View</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProjectSidebar: React.FC<{ project: any }> = ({ project }) => (
  <div className="tt-glass rounded-2xl p-6">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><FolderKanban className="h-4 w-4" /> Project summary</h3>
    <dl className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
      <div><dt className="text-[10px] uppercase text-slate-400">Status</dt><dd className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[project.status] || ''}`}>{(project.status || '').replace(/_/g, ' ')}</dd></div>
      {project.priority && <div><dt className="text-[10px] uppercase text-slate-400">Priority</dt><dd className={`mt-0.5 font-semibold ${PRIORITY_COLOR[project.priority] || ''}`}>{project.priority}</dd></div>}
      {project.startDate && <div><dt className="text-[10px] uppercase text-slate-400">Started</dt><dd className="mt-0.5">{fmtDate(project.startDate)}</dd></div>}
      {project.dueDate && <div><dt className="text-[10px] uppercase text-slate-400">Due</dt><dd className="mt-0.5">{fmtDate(project.dueDate)}</dd></div>}
      {project.assignee && <div><dt className="text-[10px] uppercase text-slate-400">Lead</dt><dd className="mt-0.5">{project.assignee}</dd></div>}
    </dl>
  </div>
);

const YourDetails: React.FC<{ client: { name: string; email: string; company?: string | null; phone?: string | null } }> = ({ client }) => (
  <div className="tt-glass rounded-2xl p-6">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><UserIcon className="h-4 w-4" /> Your details</h3>
    <dl className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
      <div><dt className="text-[10px] uppercase text-slate-400">Name</dt><dd>{client.name}</dd></div>
      <div><dt className="text-[10px] uppercase text-slate-400">Email</dt><dd className="break-all">{client.email}</dd></div>
      {client.company && <div><dt className="text-[10px] uppercase text-slate-400">Company</dt><dd>{client.company}</dd></div>}
      {client.phone && <div><dt className="text-[10px] uppercase text-slate-400">Phone</dt><dd>{client.phone}</dd></div>}
    </dl>
  </div>
);

// ========== Dialogs ==========
const ConfirmDialog: React.FC<{ title: string; message: string; confirmLabel: string; confirmClass: string; icon: React.ReactNode; onCancel: () => void; onConfirm: () => void }> = ({ title, message, confirmLabel, confirmClass, icon, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
    <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
      <div className="mb-3 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10">{icon}</div><h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3></div>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">Cancel</button>
        <button onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${confirmClass}`}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

const RejectDialog: React.FC<{ milestone: Milestone; reason: string; setReason: (s: string) => void; onCancel: () => void; onConfirm: () => void }> = ({ milestone, reason, setReason, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
    <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900">
      <div className="mb-3 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-5 w-5" /></div><h3 className="text-lg font-bold text-slate-900 dark:text-white">Request changes</h3></div>
      <p className="text-sm text-slate-600 dark:text-slate-300">Please describe what needs attention on <strong>{milestone.title}</strong>. The team will be notified and the milestone will return to in-progress.</p>
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="What needs to change?" className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">Cancel</button>
        <button onClick={onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Submit feedback</button>
      </div>
    </div>
  </div>
);

const InvoiceDetailDialog: React.FC<{ invoice: Invoice; items: InvoiceItem[]; loading: boolean; onClose: () => void; onPay: () => void }> = ({ invoice, items, loading, onClose, onPay }) => {
  const s = INVOICE_STATUS[invoice.status] || { label: invoice.status, cls: '' };
  const subtotal = items.reduce((a, it) => a + it.amountCents, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-ink-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/5">
          <div>
            <p className="text-xs uppercase text-slate-400">Invoice</p>
            <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">{invoice.number}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
        </div>
        {loading ? <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-500" /></div> : (
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><p className="text-[10px] uppercase text-slate-400">Issued</p><p className="font-medium text-slate-900 dark:text-white">{fmtDate(invoice.issuedAt || invoice.createdAt)}</p></div>
              <div><p className="text-[10px] uppercase text-slate-400">Due</p><p className="font-medium text-slate-900 dark:text-white">{fmtDate(invoice.dueDate)}</p></div>
              {invoice.paidAt && <div><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="font-medium text-emerald-600 dark:text-emerald-400">{fmtDate(invoice.paidAt)}</p></div>}
            </div>
            {invoice.notes && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">{invoice.notes}</p>}
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/5">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 text-right font-medium">Qty</th><th className="px-4 py-2 text-right font-medium">Unit</th><th className="px-4 py-2 text-right font-medium">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {items.map(it => (
                    <tr key={it.id}>
                      <td className="px-4 py-2 text-slate-900 dark:text-white">{it.description}</td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{Number(it.quantity)}</td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{fmtMoney(it.unitPriceCents, invoice.currency)}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-white">{fmtMoney(it.amountCents, invoice.currency)}</td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No line items recorded.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/5">
              <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Subtotal</span><span>{fmtMoney(subtotal || invoice.subtotalCents, invoice.currency)}</span></div>
              {invoice.taxCents > 0 && <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Tax</span><span>{fmtMoney(invoice.taxCents, invoice.currency)}</span></div>}
              {invoice.discountCents > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Discount</span><span>-{fmtMoney(invoice.discountCents, invoice.currency)}</span></div>}
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-white/10 dark:text-white"><span>Total due</span><span>{fmtMoney(invoice.amountCents, invoice.currency)}</span></div>
            </div>
            {['SENT','VIEWED','PARTIALLY_PAID','OVERDUE'].includes(invoice.status) && (
              <button onClick={onPay} className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 px-4 py-3 text-sm font-semibold text-white shadow-glow hover:brightness-110">Pay invoice</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Portal;
