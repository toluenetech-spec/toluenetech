import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LogOut, FolderKanban, MessageSquare, FileText, CheckCircle2, Clock, User as UserIcon, Send } from 'lucide-react';
import { useClientAuth } from '../../context/ClientAuthContext';
import { useData } from '../../context/DataContext';
import { ClientProject, Milestone, ProjectFile, ProjectMessage } from '../../types';

const Portal: React.FC = () => {
  const { client, logout } = useClientAuth();
  const { clientProjects, milestones, files, messages, addMessage } = useData();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');

  if (!client) return <Navigate to="/portal" replace />;

  const myProjects = useMemo(() => clientProjects.filter(p => p.clientId === client.id), [clientProjects, client.id]);
  const activeProject: ClientProject | undefined = activeProjectId
    ? myProjects.find(p => p.id === activeProjectId)
    : myProjects[0];

  const projectMilestones = activeProject ? milestones.filter(m => m.projectId === activeProject.id).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
  const projectFiles = activeProject ? files.filter(f => f.projectId === activeProject.id) : [];
  const projectMessages = activeProject ? messages.filter(m => m.projectId === activeProject.id).sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)) : [];

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !msgInput.trim()) return;
    addMessage({
      projectId: activeProject.id,
      author: 'client',
      authorName: client.name,
      text: msgInput.trim(),
    });
    setMsgInput('');
  };

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'on-hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    completed: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  const milestoneColor = (s: Milestone['status']) =>
    s === 'completed' ? 'bg-green-500' : s === 'in-progress' ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-700';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-ink-950">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white dark:border-white/5 dark:bg-ink-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">Client Portal</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Welcome, {client.name}{client.company ? ` · ${client.company}` : ''}</p>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {myProjects.length === 0 ? (
          <div className="tt-glass mx-auto max-w-2xl rounded-2xl p-10 text-center">
            <FolderKanban className="mx-auto mb-3 h-8 w-8 text-brand-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">No projects yet</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">When Toluene Tech assigns a project to you it will appear here.</p>
          </div>
        ) : (
          <>
            {/* Project selector */}
            {myProjects.length > 1 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {myProjects.map(p => (
                  <button key={p.id} onClick={() => setActiveProjectId(p.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${activeProject?.id === p.id ? 'bg-brand-600 text-white' : 'tt-glass text-slate-600 dark:text-slate-300'}`}>
                    {p.title}
                  </button>
                ))}
              </div>
            )}

            {activeProject && (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  {/* Overview */}
                  <div className="tt-glass rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeProject.title}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[activeProject.status]}`}>{activeProject.status}</span>
                    </div>
                    {activeProject.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{activeProject.description}</p>}
                    {typeof activeProject.progress === 'number' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-500"><span>Progress</span><span>{activeProject.progress}%</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${activeProject.progress}%` }} /></div>
                      </div>
                    )}
                  </div>

                  {/* Milestones */}
                  <div className="tt-glass rounded-2xl p-6">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><CheckCircle2 className="h-5 w-5 text-brand-500" /> Milestones</h3>
                    <ol className="space-y-3">
                      {projectMilestones.length === 0 && <li className="text-sm text-slate-500 dark:text-slate-400">Milestones will appear as the project progresses.</li>}
                      {projectMilestones.map(m => (
                        <li key={m.id} className="flex items-start gap-3 rounded-xl p-3 hover:bg-slate-50 dark:hover:bg-white/5">
                          <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${milestoneColor(m.status)}`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{m.title}</span>
                              <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400">{m.status === 'completed' ? 'Done' : m.status === 'in-progress' ? 'In progress' : 'Pending'}</span>
                            </div>
                            {m.description && <p className="text-xs text-slate-500 dark:text-slate-400">{m.description}</p>}
                            {m.dueDate && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><Clock className="h-3 w-3" /> Due {m.dueDate}</p>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Messages */}
                  <div className="tt-glass rounded-2xl p-6">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><MessageSquare className="h-5 w-5 text-brand-500" /> Messages</h3>
                    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                      {projectMessages.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">No messages yet. Send the first message.</p>}
                      {projectMessages.map(m => (
                        <div key={m.id} className={`flex ${m.author === 'client' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.author === 'client' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-white/5 dark:text-slate-200'}`}>
                            <div className={`mb-0.5 text-[10px] font-bold uppercase ${m.author === 'client' ? 'text-white/70' : 'text-slate-500'}`}>{m.authorName}</div>
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={send} className="mt-4 flex gap-2">
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Write a message…"
                        className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-white/10 dark:bg-slate-800 dark:text-white" />
                      <button type="submit" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-600 to-brand-400 text-white" aria-label="Send">
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  <div className="tt-glass rounded-2xl p-6">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><FileText className="h-5 w-5 text-brand-500" /> Files</h3>
                    {projectFiles.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No files yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {projectFiles.map(f => (
                          <li key={f.id}>
                            <a href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg p-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5">
                              <FileText className="h-4 w-4" /> {f.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="tt-glass rounded-2xl p-6">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><UserIcon className="h-5 w-5 text-brand-500" /> Your details</h3>
                    <dl className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      <div><dt className="text-xs uppercase text-slate-400">Name</dt><dd>{client.name}</dd></div>
                      <div><dt className="text-xs uppercase text-slate-400">Email</dt><dd>{client.email}</dd></div>
                      {client.company && <div><dt className="text-xs uppercase text-slate-400">Company</dt><dd>{client.company}</dd></div>}
                    </dl>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Portal;
