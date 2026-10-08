/**
 * Typed client for /client/* endpoints.
 * Uses the Bearer token from ClientAuthContext. All requests go through the
 * same Worker as the public site. No Firebase, no client-side data stores for
 * business data — Neon+Worker is the source of truth.
 */
import { apiBase } from './api';

export interface ApiEnvelope<T> { success: boolean; data?: T; error?: { code: string; message: string } }

async function parse<T>(res: Response): Promise<T> {
  let body: any = null;
  try { body = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const msg = body?.error?.message || body?.error || `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status: number; code?: string };
    err.status = res.status;
    err.code = body?.error?.code;
    throw err;
  }
  if (body && typeof body === 'object' && 'success' in body) {
    if (!body.success) {
      const err = new Error(body?.error?.message || 'Request failed') as Error & { status: number; code?: string };
      err.status = res.status;
      err.code = body?.error?.code;
      throw err;
    }
    return body.data as T;
  }
  return body as T;
}

function headers(token: string | null, extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// ---------- Types (mirror server schema, kept client-friendly) ----------
export interface ClientMe { id: string; name: string; email: string; company?: string | null; phone?: string | null; status: string }
export type ProjectStatus = 'PLANNING' | 'IN_PROGRESS' | 'ACTIVE' | 'ON_HOLD' | 'PAUSED' | 'REVIEW' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export interface ClientProject {
  id: string; clientId: string; title: string; description?: string | null;
  status: ProjectStatus; priority: Priority; progress: number;
  assignee?: string | null;
  startDate?: string | null; dueDate?: string | null;
  totalCents?: number | null; currency?: string;
  createdAt: string; updatedAt: string;
}
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED';
export interface Milestone {
  id: string; projectId: string; title: string; description?: string | null;
  dueDate?: string | null; status: MilestoneStatus; order: number;
  amountCents?: number | null;
  approvedAt?: string | null; approvedBy?: string | null; rejectionReason?: string | null;
  createdAt: string; updatedAt: string;
}
export interface MilestoneApproval {
  id: string; milestoneId: string; projectId: string; clientId: string;
  action: 'APPROVED' | 'REJECTED'; comment?: string | null;
  actorType: string; actorId?: string | null; actorName?: string | null;
  createdAt: string;
}
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
export interface Task {
  id: string; projectId: string; milestoneId?: string | null; title: string; description?: string | null;
  status: TaskStatus; priority: Priority; assignee?: string | null;
  dueDate?: string | null; completedAt?: string | null; completedBy?: string | null;
  createdAt: string; updatedAt: string;
}
export interface ProjectFile {
  id: string; projectId: string; clientId?: string | null;
  uploadedBy?: string | null; uploadedByRole?: 'admin' | 'client' | null;
  filename: string; r2Key: string; sizeBytes?: number | null; mimeType?: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  createdAt: string; updatedAt: string;
}
export interface Message {
  id: string; contextType: 'PROJECT' | 'LEAD' | 'GENERAL'; contextId?: string | null;
  threadId?: string | null;
  fromUid?: string | null; fromClientId?: string | null; fromName: string;
  toUid?: string | null; toClientId?: string | null; toName?: string | null;
  isFromClient: boolean; body: string;
  attachments: { filename: string; r2Key: string; sizeBytes?: number; mimeType?: string }[];
  isRead: boolean; readAt?: string | null;
  createdAt: string;
}
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';
export interface InvoiceItem {
  id: string; invoiceId: string; kind: string; description: string;
  quantity: number; unitPriceCents: number; amountCents: number; order: number;
  createdAt: string;
}
export interface Invoice {
  id: string; clientId: string; projectId?: string | null; number: string;
  subtotalCents: number; taxCents: number; discountCents: number;
  amountCents: number; currency: string;
  status: InvoiceStatus; notes?: string | null;
  dueDate?: string | null; issuedAt?: string | null; viewedAt?: string | null;
  paidAt?: string | null; cancelledAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
export interface Notification {
  id: string; uid?: string | null; clientId?: string | null;
  type: string; title: string; body?: string | null; link?: string | null;
  isRead: boolean; createdAt: string;
}
export interface DashboardData {
  projects: { total: number; active: number; completed: number };
  unreadNotifications: number;
  outstandingInvoices: number;
  openMilestones: number;
  pendingActions: number;
  recentMessages: Message[];
  projectsList: ClientProject[];
}
export interface UploadResult { item: ProjectFile }

export interface ClientApi {
  me(): Promise<ClientMe>;
  dashboard(): Promise<DashboardData>;
  listProjects(): Promise<ClientProject[]>;
  getProject(id: string): Promise<ClientProject>;
  listMilestones(projectId: string): Promise<Milestone[]>;
  listTasks(projectId: string): Promise<Task[]>;
  listFiles(projectId: string): Promise<ProjectFile[]>;
  getFileDownloadUrl(fileId: string): Promise<{ url: string; expiresIn: number | null }>;
  listMessages(projectId: string): Promise<Message[]>;
  sendMessage(projectId: string, body: string, threadId?: string, attachments?: { filename: string; r2Key: string }[]): Promise<Message>;
  approveMilestone(projectId: string, milestoneId: string, approve: boolean, comment?: string): Promise<Milestone>;
  listMilestoneApprovals(projectId: string, milestoneId: string): Promise<MilestoneApproval[]>;
  listInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<{ item: Invoice; items: InvoiceItem[] }>;
  listNotifications(): Promise<{ items: Notification[]; total: number; unread: number }>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  uploadFile(projectId: string, file: File, onProgress?: (pct: number) => void): Promise<UploadResult>;
  getPaymentsConfig(): Promise<{ configured: boolean; provider: string; publicKey: string | null }>;
  verifyPayment(tx: { transaction_id: string; invoice_id: string; tx_ref: string }): Promise<any>;
}

export function createClientApi(token: string | null): ClientApi {
  const base = apiBase();
  return {
    me: () => fetch(`${base}/client/me`, { headers: headers(token) }).then(parse<{ item: ClientMe }>).then(r => r.item),
    dashboard: () => fetch(`${base}/client/dashboard`, { headers: headers(token) }).then(parse<DashboardData>),
    listProjects: () => fetch(`${base}/client/projects`, { headers: headers(token) }).then(parse<{ items: ClientProject[] }>).then(r => r.items),
    getProject: (id) => fetch(`${base}/client/projects/${encodeURIComponent(id)}`, { headers: headers(token) }).then(parse<{ item: ClientProject }>).then(r => r.item),
    listMilestones: (pid) => fetch(`${base}/client/projects/${encodeURIComponent(pid)}/milestones`, { headers: headers(token) }).then(parse<{ items: Milestone[] }>).then(r => r.items),
    listTasks: (pid) => fetch(`${base}/client/projects/${encodeURIComponent(pid)}/tasks`, { headers: headers(token) }).then(parse<{ items: Task[] }>).then(r => r.items),
    listFiles: (pid) => fetch(`${base}/client/projects/${encodeURIComponent(pid)}/files`, { headers: headers(token) }).then(parse<{ items: ProjectFile[] }>).then(r => r.items),
    getFileDownloadUrl: (fid) => fetch(`${base}/client/files/${encodeURIComponent(fid)}/download-url`, { headers: headers(token) }).then(parse<{ url: string; expiresIn: number | null }>),
    listMessages: (pid) => fetch(`${base}/client/projects/${encodeURIComponent(pid)}/messages`, { headers: headers(token) }).then(parse<{ items: Message[] }>).then(r => r.items),
    async sendMessage(pid, body, threadId, attachments) {
      const res = await fetch(`${base}/client/projects/${encodeURIComponent(pid)}/messages`, {
        method: 'POST', headers: headers(token),
        body: JSON.stringify({ body, threadId, attachments: attachments || [] }),
      });
      return parse<{ item: Message }>(res).then(r => r.item);
    },
    async approveMilestone(pid, mid, approve, comment) {
      const res = await fetch(`${base}/client/projects/${encodeURIComponent(pid)}/milestones/${encodeURIComponent(mid)}/approve`, {
        method: 'POST', headers: headers(token),
        body: JSON.stringify({ approve, comment }),
      });
      return parse<{ item: Milestone }>(res).then(r => r.item);
    },
    listMilestoneApprovals: (_pid, _mid) => Promise.resolve([] as MilestoneApproval[]), // no client endpoint yet; admin-only
    listInvoices: () => fetch(`${base}/client/invoices`, { headers: headers(token) }).then(parse<{ items: Invoice[] }>).then(r => r.items),
    getInvoice: (id) => fetch(`${base}/client/invoices/${encodeURIComponent(id)}`, { headers: headers(token) }).then(parse<{ item: Invoice; items: InvoiceItem[] }>),
    listNotifications: () => fetch(`${base}/client/notifications`, { headers: headers(token) }).then(parse<{ items: Notification[]; total: number; unread: number }>),
    async markNotificationRead(id) { await fetch(`${base}/client/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: headers(token) }).then(parse<any>); },
    async markAllNotificationsRead() { await fetch(`${base}/client/notifications/read-all`, { method: 'POST', headers: headers(token) }).then(parse<any>); },
    getPaymentsConfig: () => fetch(`${base}/payments/config`, { headers: headers(token) }).then(parse<{ configured: boolean; provider: string; publicKey: string | null }>),
    uploadFile(pid, file, onProgress) {
      return new Promise<UploadResult>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${base}/client/projects/${encodeURIComponent(pid)}/files?filename=${encodeURIComponent(file.name)}`;
        xhr.open('POST', url);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText).data as UploadResult); }
            catch { reject(new Error('Invalid server response.')); }
          } else {
            let msg = `Upload failed (${xhr.status})`;
            try { const j = JSON.parse(xhr.responseText); msg = j?.error?.message || j?.error || msg; } catch { /* ignore */ }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(file);
      });
    },
    async verifyPayment(tx: { invoice_id: string; transaction_id: string; tx_ref: string }) {
      const res = await fetch(`${base}/payments/verify`, {
        method: 'POST', headers: headers(token), body: JSON.stringify(tx),
      });
      return parse<any>(res);
    },
  };
}
