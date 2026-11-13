import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Plus, Square, RefreshCw, Copy, Check, CheckCheck, Trash2, Pencil, Bot, Sparkles, Menu, X, MessageSquare } from 'lucide-react';
import { api } from '../../../lib/admin';
import Markdown from '../../../lib/markdown';
import { Button, EmptyState, useConfirm, useToast } from '../UI';

interface Message { role: 'user' | 'assistant'; content: string; model?: string; usedFallback?: boolean; toolCalls?: { name: string; ok: boolean }[]; error?: string; }
interface Conversation { id: string; anonId: string; name?: string; lastMessageAt: string; }

const SUGGESTED = [
  'Summarise our new leads.',
  'Show me our highest-intent leads.',
  'What services are receiving the most interest?',
  'Draft a reply to this lead.',
  'What projects are currently published?',
  'Give me an overview of the business.',
];

export default function AIChatSection() {
  const nav = useNavigate();
  const { id: urlSessionId } = useParams();
  const toast = useToast();
  const confirm = useConfirm();

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const abortRef = useRef<{ aborted: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const anonId = useMemo(() => {
    try { return sessionStorage.getItem('tt_admin_ai_sid'); } catch { return null; }
  }, []);
  const setAnon = (v: string) => { try { sessionStorage.setItem('tt_admin_ai_sid', v); } catch {} };

  // Load conversation list
  const loadConversations = () => {
    api.aiConversations('adm_').then(d => setConversations(d.items)).catch(() => setConversations([]));
  };
  useEffect(() => { loadConversations(); }, []);

  // Load messages for current session
  useEffect(() => {
    if (!currentId) { setMessages([]); return; }
    api.aiConversation(currentId).then(d => {
      const msgs: Message[] = (d.messages || []).map((m: any) => ({ role: m.role, content: m.content }));
      // The API doesn't store model per message; we just keep content.
      setMessages(msgs);
    }).catch(() => setMessages([]));
  }, [currentId]);

  // Auto-scroll
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

  // If URL has a session id, load it
  useEffect(() => {
    if (urlSessionId && conversations) {
      const found = conversations.find(c => c.id === urlSessionId || c.anonId === urlSessionId);
      if (found) setCurrentId(found.id);
    }
  }, [urlSessionId, conversations]);

  const newChat = () => {
    setCurrentId(null);
    setMessages([]);
    setAnon('');
    nav('/admin/ai/chat');
    setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const select = (c: Conversation) => {
    setCurrentId(c.id); setSidebarOpen(false);
    nav(`/admin/ai/chat/${c.id}`);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const userMsg: Message = { role: 'user', content };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setBusy(true);
    abortRef.current = { aborted: false };

    try {
      // Use the stored anonId (starts new session if empty); API returns new anonId if needed.
      const res = await api.adminChat(content, anonId || null);
      if (abortRef.current.aborted) return;
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.reply,
        model: res.model,
        usedFallback: res.usedFallback,
        toolCalls: res.toolCalls,
        error: res.error,
      };
      setMessages(m => [...m, assistantMsg]);
      if (res.anonId) setAnon(res.anonId);
      loadConversations();
      // If we now have a session ID, route to it
      if (!currentId && res.anonId && conversations) {
        // best-effort: find the conversation after reload
        setTimeout(() => {
          api.aiConversations('adm_').then(d => {
            setConversations(d.items);
            const found = d.items.find((c: Conversation) => c.anonId === res.anonId);
            if (found) { setCurrentId(found.id); nav(`/admin/ai/chat/${found.id}`, { replace:true }); }
          });
        }, 400);
      }
    } catch (e: any) {
      if (abortRef.current?.aborted) return;
      setMessages(m => [...m, { role: 'assistant', content: e.message || 'Something went wrong.', error: 'client_error' }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => { if (abortRef.current) abortRef.current.aborted = true; setBusy(false); };

  const regenerate = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    setMessages(m => m.slice(0, m.lastIndexOf(lastUser)));
    send(lastUser.content);
  };

  const copyMsg = async (content: string, key: string) => {
    try { await navigator.clipboard.writeText(stripMd(content)); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch {}
  };
  const copyCode = async (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(code); toast.push('success','Code copied'); } catch {}
  };

  const rename = async (c: Conversation) => {
    const name = renameValue.trim();
    if (!name) { setRenamingId(null); return; }
    try { await api.aiRename(c.id, name); setConversations(prev => (prev||[]).map(x => x.id === c.id ? { ...x, name } : x)); }
    catch (e: any) { toast.push('error','Rename failed',e.message); }
    setRenamingId(null);
  };
  const del = async (c: Conversation) => {
    const ok = await confirm.confirm({ title:'Delete conversation?', message:'This cannot be undone.', confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.aiDelete(c.id); setConversations(prev => (prev||[]).filter(x => x.id !== c.id)); if (currentId === c.id) newChat(); toast.push('success','Conversation deleted'); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'; } }, [input]);

  return (
    <div className="adm-chat" style={{ minHeight: 'calc(100vh - 160px)' }}>
      {/* History sidebar */}
      <aside className="adm-chat-history">
        <div className="adm-chat-history-head">
          <Button variant="primary" size="sm" icon={<Plus size={14}/>} onClick={newChat} style={{ flex:1 }}>New chat</Button>
        </div>
        <div className="adm-chat-list">
          {conversations === null ? (
            <div style={{ padding:'0.75rem' }}>
              <div className="adm-skel adm-skel-line"/><div className="adm-skel adm-skel-line w-2-3"/><div className="adm-skel adm-skel-line"/>
            </div>
          ) : conversations.length === 0 ? (
            <div className="adm-muted" style={{ padding:'1rem', fontSize:'0.82rem', textAlign:'center' }}>No conversations yet.</div>
          ) : conversations.map(c => (
            <div key={c.id} className={`adm-chat-item${currentId === c.id ? ' active' : ''}`} onClick={() => select(c)}>
              <MessageSquare size={14} style={{ flexShrink:0, color:'var(--muted-soft)' }}/>
              {renamingId === c.id ? (
                <input autoFocus style={{ flex:1, fontSize:'0.82rem', padding:'0.2rem 0.4rem', border:'1px solid var(--line-strong)', borderRadius:4, background:'var(--bg)' }}
                  value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={() => rename(c)} onKeyDown={e => { if (e.key==='Enter') rename(c); if (e.key==='Escape') setRenamingId(null); }} onClick={e => e.stopPropagation()}/>
              ) : (
                <>
                  <span className="adm-truncate" style={{ flex:1 }}>{c.name || 'New chat'}</span>
                  <button className="adm-btn adm-btn-ghost adm-btn-icon" style={{ width:22, height:22, opacity:0.6 }} onClick={e => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.name || ''); }} title="Rename"><Pencil size={11}/></button>
                  <button className="adm-btn adm-btn-ghost adm-btn-icon" style={{ width:22, height:22, opacity:0.6 }} onClick={e => { e.stopPropagation(); del(c); }} title="Delete"><Trash2 size={11}/></button>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <section className="adm-chat-main">
        <header className="adm-chat-head">
          <button className="adm-btn adm-btn-ghost adm-btn-icon adm-chat-mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={16}/></button>
          <Bot size={20} style={{ color:'var(--brand-accent)' }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="adm-chat-head-title">Tolesh Admin AI</div>
            <div className="adm-chat-head-sub">Read-only assistant with CRM/CMS context. Drafts are not sent.</div>
          </div>
          <Button variant="ghost" size="sm" icon={<Plus size={13}/>} onClick={newChat}>New</Button>
        </header>

        {messages.length === 0 ? (
          <div className="adm-chat-empty">
            <div style={{ width:52, height:52, borderRadius:14, background:'var(--brand-accent-soft)', color:'var(--brand-accent)', display:'grid', placeItems:'center' }}>
              <Sparkles size={24}/>
            </div>
            <h3>Ask Tolesh anything about your business</h3>
            <p>I can summarise leads, look up project details, draft replies, and answer questions using your live data.</p>
            <div className="adm-suggest-chips">
              {SUGGESTED.map(s => (
                <button key={s} className="adm-suggest-chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="adm-chat-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`adm-msg ${m.role}`}>
                <div className="adm-msg-bubble">
                  {m.role === 'assistant'
                    ? <Markdown content={m.content} onCopyCode={copyCode}/>
                    : <div style={{ whiteSpace:'pre-wrap' }}>{m.content}</div>}
                </div>
                <div className="adm-msg-meta">
                  {m.role === 'assistant' ? (
                    <>
                      <span>Tolesh</span>
                      <button title="Copy" onClick={() => copyMsg(m.content, `m-${i}`)}>{copied === `m-${i}` ? <Check size={12}/> : <Copy size={12}/>}{copied === `m-${i}` ? 'Copied' : 'Copy'}</button>
                      {i === messages.length - 1 && !busy && <button title="Regenerate" onClick={regenerate}><RefreshCw size={12}/>Regenerate</button>}
                    </>
                  ) : <span>You</span>}
                </div>
                {m.role === 'assistant' && (m.model || m.toolCalls?.length || m.usedFallback) && (
                  <div className="adm-meta-row" style={{ padding:'0 0.25rem' }}>
                    {(m.model || m.usedFallback) && <><span className="adm-tool-badge">Model: <strong>{shortModel(m.model)}</strong></span>
                      {m.usedFallback && <span className="adm-fallback-note">fallback used</span>}</>}
                    {m.toolCalls?.map((tc, j) => <span key={j} className={`adm-tool-badge ${tc.ok ? 'ok' : ''}`}>{tc.ok ? '✓' : '⚠'} {tc.name}</span>)}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="adm-msg assistant">
                <div className="adm-msg-bubble"><div className="adm-thinking"><span/><span/><span/></div></div>
              </div>
            )}
          </div>
        )}

        <div className="adm-chat-composer">
          <div className="adm-chat-composer-row">
            <textarea ref={textareaRef} placeholder="Ask about leads, projects, content…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} rows={1} disabled={busy}/>
            {busy
              ? <Button variant="danger" icon={<Square size={14}/>} onClick={stop}>Stop</Button>
              : <Button variant="primary" icon={<Send size={14}/>} onClick={() => send()} disabled={!input.trim()}>Send</Button>}
          </div>
          <div className="adm-chat-composer-foot">Tolesh can make mistakes. Verify important information before acting on it.</div>
        </div>
      </section>

      {/* Mobile history drawer */}
      {sidebarOpen && (
        <>
          <div className="adm-scrim" onClick={() => setSidebarOpen(false)} style={{ zIndex:55 }}/>
          <aside className="adm-drawer" style={{ left:0, right:'auto', width:280, borderRight:'1px solid var(--line)', borderLeft:'none' }}>
            <div className="adm-drawer-header">
              <div className="adm-modal-title">Conversations</div>
              <button className="adm-btn adm-btn-ghost adm-btn-icon" onClick={() => setSidebarOpen(false)}><X size={16}/></button>
            </div>
            <div className="adm-drawer-body" style={{ padding:'0.75rem' }}>
              <Button variant="primary" size="sm" icon={<Plus size={14}/>} onClick={newChat} style={{ width:'100%', marginBottom:'0.5rem' }}>New chat</Button>
              {conversations?.map(c => (
                <div key={c.id} className={`adm-chat-item${currentId === c.id ? ' active' : ''}`} onClick={() => select(c)}>
                  <MessageSquare size={14}/><span className="adm-truncate">{c.name || 'New chat'}</span>
                </div>
              ))}
            </div>
          </aside>
        </>
      )}
      <style>{`
        @media (min-width: 761px) { .adm-chat-mobile-menu { display: none !important; } }
        @media (max-width: 760px) { .adm-chat-history { display: none; } }
      `}</style>
    </div>
  );
}

function shortModel(m?: string) {
  if (!m) return 'AI';
  const last = m.split('/').pop() || m;
  return last.replace(/-0731$/,'').replace(/^MiniMax-?/,'MiniMax ').replace(/^GLM-?/,'GLM ').replace(/^DeepSeek-?/,'DeepSeek ');
}
function stripMd(s: string) {
  return s.replace(/[#*_`>\-]/g,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1');
}
