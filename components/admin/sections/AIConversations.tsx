import React, { useEffect, useState } from 'react';
import { MessagesSquare, Eye, Trash2 } from 'lucide-react';
import { api } from '../../../lib/admin';
import DataTable from '../DataTable';
import { Drawer, useConfirm, useToast } from '../UI';

export default function AIConversations() {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<'all'|'adm'|'cli'|'pub'>('all');
  const [viewing, setViewing] = useState<any | null>(null);

  const load = () => {
    const prefix = filter === 'all' ? undefined : filter === 'adm' ? 'adm_' : filter === 'cli' ? 'cli_' : '';
    // '' for public (no prefix matches all anonIds not starting with adm_/cli_, but our list helper doesn't have not-like; leave prefix empty for 'all')
    api.aiConversations(prefix).then(d => {
      let items = d.items || [];
      if (filter === 'pub') items = items.filter((i: any) => !i.anonId.startsWith('adm_') && !i.anonId.startsWith('cli_'));
      setItems(items);
    }).catch(e => toast.push('error','Failed to load conversations',e.message));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const open = async (c: any) => {
    try { const d = await api.aiConversation(c.id); setViewing(d); }
    catch (e: any) { toast.push('error','Failed to load',''+e.message); }
  };
  const del = async (c: any) => {
    const ok = await confirm.confirm({ title:'Delete conversation?', message:'This cannot be undone.', confirmLabel:'Delete', danger:true });
    if (!ok) return;
    try { await api.aiDelete(c.id); setItems(prev => (prev||[]).filter(x => x.id !== c.id)); toast.push('success','Deleted'); }
    catch (e: any) { toast.push('error','Delete failed',e.message); }
  };

  return (<>
    <div className="adm-page-header">
      <div>
        <div className="adm-page-title">AI Conversations</div>
        <div className="adm-page-sub">Review past Tolesh conversations across public, admin and client surfaces.</div>
      </div>
    </div>

    <div className="adm-subtabs">
      <button className={`adm-subtab${filter==='all'?' active':''}`} onClick={() => setFilter('all')}>All</button>
      <button className={`adm-subtab${filter==='adm'?' active':''}`} onClick={() => setFilter('adm')}>Admin</button>
      <button className={`adm-subtab${filter==='cli'?' active':''}`} onClick={() => setFilter('cli')}>Client</button>
      <button className={`adm-subtab${filter==='pub'?' active':''}`} onClick={() => setFilter('pub')}>Public</button>
    </div>

    <DataTable title="Conversations" items={items} emptyTitle="No conversations" emptyBody="Tolesh conversations will appear here."
      emptyIcon={MessagesSquare}
      onEdit={open}
      onDelete={del}
      columns={[
        { key:'name', label:'Conversation', render:(r:any)=> (
          <div>
            <div className="adm-table-title">{r.name || (r.email || 'Anonymous')}</div>
            <div className="adm-table-sub"><span className="adm-mono">{r.anonId}</span>{r.intent ? ` · ${r.intent}` : ''}</div>
          </div>
        )},
        { key:'source', label:'Surface', render:(r:any) => {
          const src = r.anonId.startsWith('adm_') ? 'admin' : r.anonId.startsWith('cli_') ? 'client' : 'public';
          return <span className={`adm-badge ${src==='admin'?'status-NEW':src==='client'?'status-QUALIFIED':''}`}>{src}</span>;
        }},
        { key:'email', label:'Email', render:(r:any)=><span className="adm-muted">{r.email || '—'}</span> },
        { key:'lead', label:'Lead', render:(r:any) => r.capturedLeadId ? <span className="adm-badge status-WON">captured</span> : <span className="adm-muted">—</span> },
        { key:'last', label:'Last message', render:(r:any)=> <span className="adm-muted" style={{ fontSize:'0.8rem' }}>{new Date(r.lastMessageAt).toLocaleString()}</span> },
      ]}/>

    <Drawer open={!!viewing} onClose={() => setViewing(null)} title={viewing?.session?.name || viewing?.session?.email || 'Conversation'}
      footer={<button className="adm-btn" onClick={() => setViewing(null)}>Close</button>}>
      {viewing && (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
          <div className="adm-muted" style={{ fontSize:'0.78rem' }}>
            {viewing.session.anonId} · {new Date(viewing.session.createdAt).toLocaleString()}
          </div>
          {(viewing.messages || []).map((m: any, i: number) => (
            <div key={i} className={`adm-msg ${m.role}`} style={{ alignSelf: m.role==='user'?'flex-end':'flex-start', maxWidth:'100%', width:'100%' }}>
              <div className="adm-msg-bubble" style={{ maxWidth:'100%' }}>
                <div style={{ whiteSpace:'pre-wrap', fontSize:'0.85rem', lineHeight:1.55 }}>{m.content}</div>
              </div>
              <div className="adm-msg-meta">{m.role}</div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  </>);
}
