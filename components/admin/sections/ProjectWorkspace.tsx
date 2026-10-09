import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderKanban, CheckCircle2, ListTodo, MessageSquare, FileText, Plus, Upload, Trash2, Pencil, Send, RefreshCw, X, ChevronDown } from 'lucide-react';
import { api } from '../../../lib/admin';
import { Badge, Button, Drawer, EmptyState, useConfirm, useToast } from '../UI';

type Tab = 'overview' | 'milestones' | 'tasks' | 'files' | 'messages';

const MILESTONE_STATUSES = ['PENDING','IN_PROGRESS','COMPLETED','APPROVED','REJECTED'];
const TASK_STATUSES = ['TODO','IN_PROGRESS','BLOCKED','DONE'];
const TASK_PRIORITIES = ['LOW','MEDIUM','HIGH','URGENT'];

function fmtMoney(cents?: number | null, cur = 'USD') {
  if (cents == null) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(cents/100); }
  catch { return `${cents/100} ${cur}`; }
}
function fmtDate(d: any) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return String(d); }
}
function fileSize(n?: number | null) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

export default function ProjectWorkspace({ projectId, projects, onProjectChange, initialTab = 'milestones' }: {
  projectId: string;
  projects: any[];
  onProjectChange: (id: string) => void;
  initialTab?: Tab;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>(initialTab as Tab);
  const [project, setProject] = useState<any | null>(null);
  const [client, setClient] = useState<any | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [p, ms, ts, fs, msgs] = await Promise.all([
        api.clientProject(projectId),
        api.milestones(projectId),
        api.tasks({ projectId }),
        api.projectFiles(projectId),
        api.projectMessages(projectId),
      ]);
      setProject(p.item); setClient(p.client);
      setMilestones(ms.items); setTasks(ts.items); setFiles(fs.items); setMessages(msgs.items);
      // mark messages read in background
      api.markProjectMessagesRead(projectId).catch(() => {});
    } catch (e: any) {
      setErr(e.message || 'Failed to load project.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (err) {
    return <div className="adm-card" style={{padding:'1.5rem', textAlign:'center'}}>
      <div style={{color:'#dc2626', marginBottom:'0.75rem'}}>{err}</div>
      <Button variant="primary" icon={<RefreshCw size={14}/>} onClick={refresh}>Retry</Button>
    </div>;
  }
  if (loading || !project) {
    return <div style={{padding:'1.5rem'}}>
      <div className="adm-skel adm-skel-line"/><div className="adm-skel adm-skel-line w-2-3"/><div className="adm-skel adm-skel-line"/>
    </div>;
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'milestones', label: 'Milestones', icon: CheckCircle2, count: milestones.length },
    { id: 'tasks', label: 'Tasks', icon: ListTodo, count: tasks.length },
    { id: 'files', label: 'Files', icon: FileText, count: files.filter((f: any) => !f.deletedAt).length },
    { id: 'messages', label: 'Messages', icon: MessageSquare, count: messages.filter((m: any) => !m.isFromClient && !m.isRead).length },
  ];

  return (
    <div>
      <div className="adm-page-header">
        <div>
          <div style={{ position:'relative' }}>
            <button className="adm-btn adm-btn-ghost" onClick={() => setPickerOpen(o => !o)} style={{fontWeight:700, fontSize:'1.05rem', padding:'0.25rem 0.5rem'}}>
              {project.title} <ChevronDown size={16}/>
            </button>
            {pickerOpen && (
              <div style={{ position:'absolute', top:'100%', left:0, background:'var(--bg)', border:'1px solid var(--line)', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:20, minWidth:260, maxHeight:320, overflowY:'auto' }}>
                {projects.map(p => (
                  <button key={p.id} className="adm-btn adm-btn-ghost" style={{width:'100%', justifyContent:'flex-start', textAlign:'left', borderRadius:0, padding:'0.55rem 0.8rem', fontWeight: p.id === projectId ? 600 : 400 }} onClick={() => { onProjectChange(p.id); setPickerOpen(false); }}>
                    <span style={{flex:1}}>{p.title}</span>
                    <Badge className={`status-${(p.status||'').toLowerCase()}`}>{(p.status||'').replace(/_/g,' ')}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="adm-page-sub">{client?.name || client?.email || '—'} · {fmtMoney(project.totalCents, project.currency)} · Due {fmtDate(project.dueDate)}</div>
        </div>
        <div className="adm-page-actions">
          <Button variant="ghost" icon={<RefreshCw size={14}/>} onClick={refresh}>Refresh</Button>
        </div>
      </div>

      <div style={{ display:'flex', gap:'0.3rem', borderBottom:'1px solid var(--line)', marginBottom:'1rem', flexWrap:'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`adm-tab${tab === t.id ? ' active' : ''}`}>
            <t.icon size={14}/>{t.label}{t.count != null && t.count > 0 && <span className="adm-tab-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab project={project} client={client} milestones={milestones} tasks={tasks} files={files} messages={messages}/>
      )}
      {tab === 'milestones' && (
        <MilestonesPanel projectId={projectId} milestones={milestones} tasks={tasks} onChange={refresh}/>
      )}
      {tab === 'tasks' && (
        <TasksPanel projectId={projectId} milestones={milestones} tasks={tasks} onChange={refresh}/>
      )}
      {tab === 'files' && (
        <FilesPanel projectId={projectId} files={files} onChange={refresh}/>
      )}
      {tab === 'messages' && (
        <MessagesPanel projectId={projectId} messages={messages} clientName={client?.name || 'Client'} onChange={refresh}/>
      )}
    </div>
  );
}

function OverviewTab({ project, client, milestones, tasks, files, messages }: any) {
  const completed = milestones.filter((m: any) => m.status === 'COMPLETED' || m.status === 'APPROVED').length;
  const openTasks = tasks.filter((t: any) => t.status !== 'DONE').length;
  const unread = messages.filter((m: any) => !m.isFromClient && !m.isRead).length;
  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:'0.85rem'}}>
      <Stat label="Status" value={project.status?.replace(/_/g,' ')||'—'}/>
      <Stat label="Progress" value={`${project.progress ?? 0}%`}/>
      <Stat label="Milestones" value={`${completed}/${milestones.length} done`}/>
      <Stat label="Open tasks" value={String(openTasks)}/>
      <Stat label="Files" value={String(files.filter((f: any) => !f.deletedAt).length)}/>
      <Stat label="Unread msgs" value={String(unread)}/>
      <div className="adm-card" style={{gridColumn:'1 / -1'}}>
        <h4 style={{marginBottom:'0.5rem'}}>Client</h4>
        <dl className="adm-kv">
          <dt>Name</dt><dd>{client?.name || '—'}</dd>
          <dt>Email</dt><dd>{client?.email || '—'}</dd>
          {client?.phone && <><dt>Phone</dt><dd>{client.phone}</dd></>}
          {client?.company && <><dt>Company</dt><dd>{client.company}</dd></>}
        </dl>
      </div>
    </div>
  );
}
function Stat({label, value}:{label:string; value:string}) {
  return <div className="adm-card"><div className="adm-muted" style={{fontSize:'0.75rem'}}>{label}</div><div style={{fontSize:'1.4rem', fontWeight:700, marginTop:'0.2rem'}}>{value}</div></div>;
}

function MilestonesPanel({ projectId, milestones, tasks, onChange }: any) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editMs, setEditMs] = useState<any>(null);
  const del = async (m: any) => {
    const ok = await confirm.confirm({ title:'Delete milestone?', message:`"${m.title}" will be removed.`, confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.remove('milestones', m.id); toast.push('success','Deleted'); onChange(); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };
  return (
    <div className="adm-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem'}}>
        <h4>Milestones</h4>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => setEditMs({})}>Add milestone</Button>
      </div>
      {milestones.length === 0
        ? <EmptyState icon={CheckCircle2} title="No milestones" body="Add the first milestone for this project."/>
        : <div style={{display:'flex', flexDirection:'column', gap:'0.5rem'}}>
          {milestones.map((m: any) => {
            const related = tasks.filter((t: any) => t.milestoneId === m.id);
            return (
              <div key={m.id} style={{padding:'0.75rem', border:'1px solid var(--line)', borderRadius:8, display:'flex', alignItems:'center', gap:'0.75rem'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600, display:'flex', gap:'0.5rem', alignItems:'center'}}>
                    {m.title}
                    <Badge className={`status-${(m.status||'').toLowerCase()}`}>{(m.status||'').replace(/_/g,' ')}</Badge>
                    {m.amountCents ? <span className="adm-muted" style={{fontSize:'0.75rem'}}>{fmtMoney(m.amountCents)}</span> : null}
                  </div>
                  {m.description && <div className="adm-muted" style={{fontSize:'0.8rem', marginTop:2}}>{m.description}</div>}
                  <div className="adm-muted" style={{fontSize:'0.72rem', marginTop:4}}>Due {fmtDate(m.dueDate)} · {related.length} task{related.length===1?'':'s'}</div>
                </div>
                <button className="adm-btn adm-btn-ghost adm-btn-icon" onClick={() => setEditMs(m)}><Pencil size={13}/></button>
                <button className="adm-btn adm-btn-ghost adm-btn-icon" onClick={() => del(m)}><Trash2 size={13}/></button>
              </div>
            );
          })}
        </div>}
      <MilestoneDrawer projectId={projectId} editing={editMs} milestones={milestones}
        onClose={() => setEditMs(null)} onSaved={() => { setEditMs(null); onChange(); }}/>
    </div>
  );
}

function MilestoneDrawer({ projectId, editing, milestones, onClose, onSaved }: any) {
  const toast = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!editing) { setForm(null); return; }
    setForm({ projectId, title:'', description:'', status:'PENDING', dueDate:'', amountCents:0, order: (milestones?.length||0)+1, ...editing });
  }, [editing, projectId, milestones]);
  if (!form) return null;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const isNew = !form.id;
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        projectId, title: form.title, description: form.description || null,
        status: form.status, dueDate: form.dueDate || null,
        amountCents: Number(form.amountCents) || null, order: Number(form.order) || 0,
      };
      if (isNew) await api.create('milestones', payload);
      else await api.update('milestones', form.id, payload);
      toast.push('success', isNew ? 'Milestone created' : 'Saved');
      onSaved();
    } catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open={!!editing} onClose={onClose} title={isNew ? 'New milestone' : form.title}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving || !form.title}>{saving?'Saving…':'Save'}</Button></>}>
      <div className="adm-grid-2">
        <div className="adm-field" style={{gridColumn:'1 / -1'}}><label className="adm-label">Title *</label>
          <input className="adm-input" value={form.title||''} onChange={e => set('title', e.target.value)}/>
        </div>
        <div className="adm-field"><label className="adm-label">Status</label>
          <select className="adm-select" value={form.status||'PENDING'} onChange={e => set('status', e.target.value)}>
            {MILESTONE_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div className="adm-field"><label className="adm-label">Due date</label>
          <input type="date" className="adm-input" value={(form.dueDate||'').slice(0,10)} onChange={e => set('dueDate', e.target.value)}/>
        </div>
        <div className="adm-field"><label className="adm-label">Amount (cents)</label>
          <input type="number" min="0" className="adm-input" value={form.amountCents||0} onChange={e => set('amountCents', Number(e.target.value)||0)}/>
        </div>
        <div className="adm-field"><label className="adm-label">Order</label>
          <input type="number" min="0" className="adm-input" value={form.order||0} onChange={e => set('order', Number(e.target.value)||0)}/>
        </div>
        <div className="adm-field" style={{gridColumn:'1 / -1'}}><label className="adm-label">Description</label>
          <textarea className="adm-textarea" rows={3} value={form.description||''} onChange={e => set('description', e.target.value)}/>
        </div>
      </div>
    </Drawer>
  );
}

function TasksPanel({ projectId, milestones, tasks, onChange }: any) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editTask, setEditTask] = useState<any>(null);
  const columns: { id: string; label: string }[] = [
    { id:'TODO', label:'To do' }, { id:'IN_PROGRESS', label:'In progress' }, { id:'BLOCKED', label:'Blocked' }, { id:'DONE', label:'Done' },
  ];
  const setStatus = async (t: any, s: string) => {
    try { await api.update('tasks', t.id, { status: s }); onChange(); }
    catch (e: any) { toast.push('error','Update failed',e.message); }
  };
  const del = async (t: any) => {
    const ok = await confirm.confirm({ title:'Delete task?', message:`"${t.title}" will be removed.`, confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.remove('tasks', t.id); toast.push('success','Deleted'); onChange(); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };
  return (
    <div className="adm-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem'}}>
        <h4>Tasks</h4>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => setEditTask({})}>Add task</Button>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'0.75rem'}}>
        {columns.map(col => {
          const items = tasks.filter((t: any) => t.status === col.id);
          return (
            <div key={col.id} style={{background:'var(--bg-soft)', borderRadius:10, padding:'0.6rem', minHeight:120}}>
              <div style={{fontSize:'0.78rem', fontWeight:700, color:'var(--muted)', marginBottom:'0.5rem', display:'flex', justifyContent:'space-between'}}>
                <span>{col.label}</span><span>{items.length}</span>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:'0.4rem'}}>
                {items.map((t: any) => (
                  <div key={t.id} style={{background:'var(--bg)', border:'1px solid var(--line)', borderRadius:8, padding:'0.55rem 0.65rem'}}>
                    <div style={{display:'flex', alignItems:'flex-start', gap:'0.4rem'}}>
                      <div style={{flex:1, fontSize:'0.85rem', fontWeight:600}}>{t.title}</div>
                      <select value={t.status} onChange={e => setStatus(t, e.target.value)}
                        style={{fontSize:'0.7rem', border:'1px solid var(--line)', borderRadius:4, padding:'0.1rem 0.2rem', background:'var(--bg)'}}>
                        {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                    {t.description && <div className="adm-muted" style={{fontSize:'0.75rem', marginTop:3}}>{t.description}</div>}
                    <div style={{display:'flex', justifyContent:'space-between', marginTop:6, alignItems:'center'}}>
                      <div style={{display:'flex', gap:4, alignItems:'center'}}>
                        {t.priority && <Badge className={`status-${String(t.priority).toLowerCase()}`} style={{fontSize:'0.65rem'}}>{t.priority}</Badge>}
                        {t.dueDate && <span className="adm-muted" style={{fontSize:'0.7rem'}}>Due {fmtDate(t.dueDate)}</span>}
                      </div>
                      <div style={{display:'flex', gap:2}}>
                        <button className="adm-btn adm-btn-ghost adm-btn-icon" style={{width:22,height:22}} onClick={() => setEditTask(t)}><Pencil size={11}/></button>
                        <button className="adm-btn adm-btn-ghost adm-btn-icon" style={{width:22,height:22}} onClick={() => del(t)}><Trash2 size={11}/></button>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="adm-muted" style={{fontSize:'0.75rem', textAlign:'center', padding:'0.6rem'}}>Nothing here</div>}
              </div>
            </div>
          );
        })}
      </div>
      <TaskDrawer projectId={projectId} milestones={milestones} editing={editTask} onClose={() => setEditTask(null)} onSaved={() => { setEditTask(null); onChange(); }}/>
    </div>
  );
}

function TaskDrawer({ projectId, milestones, editing, onClose, onSaved }: any) {
  // local state separate per editing
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (!editing || !editing.id && Object.keys(editing).length === 0) {
      // open new
      if (editing && Object.keys(editing).length === 0) setForm({ projectId, milestoneId: '', title:'', description:'', status:'TODO', priority:'MEDIUM', dueDate:'' });
      else setForm(null);
      return;
    }
    setForm({ projectId, ...editing });
  }, [editing, projectId]);
  if (!form) return null;
  const isNew = !form.id;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        projectId, milestoneId: form.milestoneId || null, title: form.title,
        description: form.description || null, status: form.status, priority: form.priority,
        dueDate: form.dueDate || null,
      };
      if (isNew) await api.create('tasks', payload);
      else await api.update('tasks', form.id, payload);
      toast.push('success', isNew ? 'Task created' : 'Saved');
      onSaved();
    } catch (e: any) { toast.push('error','Save failed',e.message); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open={!!editing} onClose={onClose} title={isNew ? 'New task' : form.title}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={saving || !form.title}>{saving?'Saving…':'Save'}</Button></>}>
      <div className="adm-grid-2">
        <div className="adm-field" style={{gridColumn:'1 / -1'}}><label className="adm-label">Title *</label>
          <input className="adm-input" value={form.title||''} onChange={e => set('title', e.target.value)}/>
        </div>
        <div className="adm-field"><label className="adm-label">Milestone</label>
          <select className="adm-select" value={form.milestoneId||''} onChange={e => set('milestoneId', e.target.value)}>
            <option value="">— none —</option>
            {milestones.map((m: any) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </div>
        <div className="adm-field"><label className="adm-label">Status</label>
          <select className="adm-select" value={form.status||'TODO'} onChange={e => set('status', e.target.value)}>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
        </div>
        <div className="adm-field"><label className="adm-label">Priority</label>
          <select className="adm-select" value={form.priority||'MEDIUM'} onChange={e => set('priority', e.target.value)}>
            {TASK_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="adm-field"><label className="adm-label">Due date</label>
          <input type="date" className="adm-input" value={(form.dueDate||'').slice(0,10)} onChange={e => set('dueDate', e.target.value)}/>
        </div>
        <div className="adm-field" style={{gridColumn:'1 / -1'}}><label className="adm-label">Description</label>
          <textarea className="adm-textarea" rows={3} value={form.description||''} onChange={e => set('description', e.target.value)}/>
        </div>
      </div>
    </Drawer>
  );
}

function FilesPanel({ projectId, files, onChange }: any) {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const active = files.filter((f: any) => !f.deletedAt);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true); setProgress(0);
    try {
      for (const f of Array.from(list)) {
        if (f.size > 25 * 1024 * 1024) { toast.push('error','File too large', `${f.name} exceeds 25 MB.`); continue; }
        await api.uploadProjectFile(projectId, f, (p) => setProgress(p));
      }
      toast.push('success','Upload complete');
      onChange();
    } catch (e: any) { toast.push('error','Upload failed',e.message); }
    finally { setUploading(false); setProgress(0); if (fileRef.current) fileRef.current.value=''; }
  };
  const del = async (f: any) => {
    const ok = await confirm.confirm({ title:'Delete file?', message:`${f.filename || f.name} will be removed from the client view.`, confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.deleteProjectFile(projectId, f.id); toast.push('success','Deleted'); onChange(); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };
  return (
    <div className="adm-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem'}}>
        <h4>Project files</h4>
        <div>
          <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e => upload(e.target.files)}/>
          <Button variant="primary" size="sm" icon={<Upload size={13}/>} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? `Uploading ${progress}%` : 'Upload'}
          </Button>
        </div>
      </div>
      {uploading && (
        <div style={{height:6, background:'var(--line)', borderRadius:99, overflow:'hidden', marginBottom:'0.75rem'}}>
          <div style={{width:`${progress}%`, height:'100%', background:'var(--brand-accent)', transition:'width .2s'}}/>
        </div>
      )}
      {active.length === 0
        ? <EmptyState icon={FileText} title="No files" body="Share files with the client by uploading them here."/>
        : <div style={{display:'flex', flexDirection:'column', gap:'0.4rem'}}>
          {active.map((f: any) => (
            <div key={f.id} style={{padding:'0.6rem 0.75rem', border:'1px solid var(--line)', borderRadius:8, display:'flex', alignItems:'center', gap:'0.75rem'}}>
              <FileText size={18} style={{color:'var(--muted)'}}/>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontWeight:600, fontSize:'0.88rem'}} className="adm-truncate">{f.filename || f.name}</div>
                <div className="adm-muted" style={{fontSize:'0.72rem'}}>{fileSize(f.sizeBytes ?? f.size)} · {f.mimeType || f.type} · {fmtDate(f.updatedAt || f.uploadedAt)}</div>
              </div>
              <button className="adm-btn adm-btn-ghost adm-btn-icon" onClick={() => del(f)}><Trash2 size={13}/></button>
            </div>
          ))}
        </div>}
    </div>
  );
}

function MessagesPanel({ projectId, messages, clientName, onChange }: any) {
  const toast = useToast();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [messages]);
  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    try { await api.sendProjectMessage(projectId, body); setInput(''); onChange(); }
    catch (e: any) { toast.push('error','Send failed',e.message); }
    finally { setSending(false); }
  };
  return (
    <div className="adm-card" style={{padding:0, display:'flex', flexDirection:'column', height:'60vh', minHeight:420}}>
      <div ref={scroller} style={{flex:1, overflowY:'auto', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.6rem'}}>
        {messages.length === 0
          ? <div className="adm-muted" style={{textAlign:'center', padding:'2rem'}}>No messages yet. Send the first message to {clientName}.</div>
          : messages.map((m: any) => {
            const mine = !m.isFromClient; // admin-side mine = admin messages
            const name = m.isFromClient ? (m.fromName || clientName) : (m.fromName || 'Team');
            return (
              <div key={m.id} style={{display:'flex', flexDirection:'column', alignItems: mine ? 'flex-end' : 'flex-start'}}>
                <div style={{fontSize:'0.7rem', color:'var(--muted)', marginBottom:2}}>{name} · {fmtDate(m.createdAt)}</div>
                <div style={{maxWidth:'75%', padding:'0.55rem 0.8rem', borderRadius:12, fontSize:'0.85rem',
                  background: mine ? 'var(--brand-accent)' : 'var(--bg-soft)',
                  color: mine ? '#fff' : 'var(--text)',
                  borderBottomRightRadius: mine ? 4 : 12,
                  borderBottomLeftRadius: mine ? 12 : 4,
                  whiteSpace:'pre-wrap', wordBreak:'break-word'}}>
                  {m.body}
                </div>
                {mine && <div style={{fontSize:'0.65rem', color:'var(--muted)', marginTop:2}}>{m.isRead ? 'Read' : 'Sent'}</div>}
              </div>
            );
          })}
      </div>
      <form onSubmit={send} style={{borderTop:'1px solid var(--line)', padding:'0.6rem', display:'flex', gap:'0.5rem'}}>
        <input className="adm-input" style={{flex:1}} placeholder={`Message ${clientName}…`} value={input} onChange={e => setInput(e.target.value)} disabled={sending}/>
        <Button variant="primary" icon={<Send size={14}/>} onClick={send} disabled={!input.trim() || sending}>{sending?'Sending…':'Send'}</Button>
      </form>
    </div>
  );
}
