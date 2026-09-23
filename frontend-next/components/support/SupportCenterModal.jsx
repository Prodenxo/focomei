'use client';

import {
  ArrowLeft, CheckCircle2, FileText, Headphones, ImagePlus, Loader2,
  MessageSquare, Plus, RefreshCw, Send, X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useSupport } from '@/context/SupportProvider';
import { formatSupportDate } from '@/lib/supportHelpers';
import {
  commentSupportTicket,
  getAdminSupportTicketDetail,
  getSupportTicketDetail,
  importSupportTickets,
  listAdminSupportTickets,
  listSupportTickets,
  markSupportTicketRead,
  replyAdminSupportTicket,
} from '@/lib/supportService';
import { SupportTicketForm } from '@/components/support/SupportTicketForm';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

const priorityLabel = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };

function TicketList({ tickets, admin, onOpen }) {
  if (!tickets.length) {
    return <EmptyPanel icon={MessageSquare} title="Nenhum chamado por aqui" description={admin ? 'Os chamados do projeto aparecerão aqui.' : 'Abra um chamado para conversar com a equipe.'} />;
  }
  return (
    <ul className="space-y-2 p-3 sm:p-4">
      {tickets.map((ticket) => (
        <li key={ticket.scrumhubTicketId}>
          <button type="button" onClick={() => onOpen(ticket.scrumhubTicketId)} className="flex w-full items-start gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-left hover:bg-[var(--canvas)]">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ticket.concluido ? 'bg-emerald-500' : 'bg-[var(--accent)]'}`} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all text-xs font-bold text-[var(--accent)]">{ticket.codigo || `#${ticket.scrumhubTicketId}`}</span>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">{formatSupportDate(ticket.updatedAt, true)}</span>
              </span>
              <span className="mt-1 block font-semibold text-[var(--text-primary)]">{ticket.nome}</span>
              {admin ? <span className="block text-xs text-[var(--text-muted)]">{ticket.solicitanteNome || ticket.solicitanteEmail || 'Solicitante não identificado'}</span> : null}
              <span className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-[var(--canvas)] px-2 py-1 text-[var(--text-muted)]">{ticket.statusNome || (ticket.concluido ? 'Concluído' : 'Em andamento')}</span>
                {ticket.prioridade ? <span className="text-[var(--text-muted)]">{priorityLabel[ticket.prioridade] || ticket.prioridade}</span> : null}
                {ticket.unreadCount ? <span className="rounded-full bg-red-600 px-2 py-0.5 font-bold text-white">{ticket.unreadCount}</span> : null}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ detail, admin, onReload }) {
  const { setUnreadCount, refresh } = useSupport();
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const ticket = detail.ticket;

  const send = async (event) => {
    event.preventDefault();
    if (!message.trim() && !image) return;
    setSending(true);
    setError('');
    try {
      const action = admin ? replyAdminSupportTicket : commentSupportTicket;
      await action(ticket.scrumhubTicketId, message.trim(), image);
      setMessage('');
      setImage(null);
      await onReload(true);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a resposta.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (admin || !ticket?.scrumhubTicketId) return;
    markSupportTicketRead(ticket.scrumhubTicketId).then((result) => {
      setUnreadCount(result.unreadCount);
      refresh();
    }).catch(() => {});
  }, [admin, refresh, setUnreadCount, ticket?.scrumhubTicketId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--canvas)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">{ticket.statusNome || (ticket.concluido ? 'Concluído' : 'Em andamento')}</span>
          {ticket.prioridade ? <span className="rounded-full bg-[var(--canvas)] px-3 py-1 text-xs text-[var(--text-muted)]">{priorityLabel[ticket.prioridade] || ticket.prioridade}</span> : null}
        </div>
        {!detail.timeline?.length ? <EmptyPanel icon={MessageSquare} title="Sem respostas ainda" description="A conversa aparecerá aqui quando houver atualizações." /> : detail.timeline.map((item) => {
          const mine = admin ? !item.external : item.external;
          return (
            <article key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl border p-3 ${mine ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--card-border)] bg-[var(--canvas)] text-[var(--text-primary)]'}`}>
                <p className={`text-xs font-bold ${mine ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>{mine ? (admin ? 'Equipe FocoMEI' : 'Você') : item.authorName}</p>
                {item.text ? <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.text}</p> : null}
                {item.imageUrl ? <a href={item.imageUrl} target="_blank" rel="noreferrer"><img src={item.imageUrl} alt="Imagem anexada à conversa" className="mt-2 max-h-64 rounded-xl object-contain" /></a> : null}
                {(item.attachments || []).map((attachment) => <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 text-xs underline"><FileText className="h-3.5 w-3.5" />{attachment.name}</a>)}
                <time className={`mt-2 block text-right text-[10px] ${mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{formatSupportDate(item.createdAt)}</time>
              </div>
            </article>
          );
        })}
      </div>
      {ticket.concluido && !admin ? (
        <div className="flex items-center justify-center gap-2 border-t border-[var(--card-border)] p-4 text-sm font-semibold text-emerald-600"><CheckCircle2 className="h-5 w-5" /> Chamado concluído pela equipe</div>
      ) : (
        <form onSubmit={send} className="border-t border-[var(--card-border)] p-3">
          {error ? <p role="alert" className="mb-2 text-xs text-red-600">{error}</p> : null}
          {image ? <div className="mb-2 flex items-center justify-between rounded-lg bg-[var(--canvas)] p-2 text-xs"><span className="truncate">{image.name}</span><button type="button" onClick={() => setImage(null)} aria-label="Remover imagem"><X className="h-4 w-4" /></button></div> : null}
          <div className="flex min-w-0 items-end gap-2">
            <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--card-border)]" aria-label="Anexar imagem">
              <ImagePlus className="h-5 w-5 text-[var(--accent)]" />
              <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif" className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file?.size > 3 * 1024 * 1024) setError('A imagem deve ter no máximo 3 MB.');
                else setImage(file || null);
                event.target.value = '';
              }} />
            </label>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} rows={2} className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-[var(--card-border)] bg-[var(--canvas)] p-3 text-sm" placeholder={admin ? 'Responder ao solicitante…' : 'Responder à equipe…'} aria-label="Resposta do chamado" />
            <button type="submit" disabled={sending || (!message.trim() && !image)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white disabled:opacity-40" aria-label="Enviar resposta">
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SupportCenterModal() {
  const { role } = useAuth();
  const { open, closeCenter, focusTicketId, setUnreadCount } = useSupport();
  const [view, setView] = useState('list');
  const [scope, setScope] = useState('mine');
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const admin = scope === 'all';

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (scope === 'all') setTickets(await listAdminSupportTickets());
      else {
        const result = await listSupportTickets();
        setTickets(result.tickets);
        setUnreadCount(result.unreadCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os chamados.');
    } finally {
      setLoading(false);
    }
  }, [scope, setUnreadCount]);

  const loadDetail = useCallback(async (silent = false) => {
    if (!selectedId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      setDetail(admin ? await getAdminSupportTicketDetail(selectedId) : await getSupportTicketDetail(selectedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o chamado.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [admin, selectedId]);

  useEffect(() => {
    if (!open) return;
    setView('list');
    setSelectedId(focusTicketId || null);
    setDetail(null);
    if (focusTicketId) setView('detail');
  }, [focusTicketId, open]);
  useEffect(() => { if (open && view === 'list') loadList(); }, [loadList, open, view]);
  useEffect(() => { if (open && view === 'detail' && selectedId) loadDetail(); }, [loadDetail, open, selectedId, view]);
  useEffect(() => {
    if (!open || view !== 'detail' || !selectedId) return undefined;
    const timer = window.setInterval(() => loadDetail(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadDetail, open, selectedId, view]);

  if (!open) return null;
  const openTicket = (id) => { setSelectedId(id); setDetail(null); setView('detail'); };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <section className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl sm:h-[88vh] sm:rounded-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--card-border)] p-4">
          {view !== 'list' ? <button type="button" onClick={() => { setView('list'); setSelectedId(null); setDetail(null); }} className="rounded-lg p-2 hover:bg-[var(--canvas)]" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></button> : <Headphones className="h-5 w-5 text-[var(--accent)]" />}
          <div className="min-w-0 flex-1"><h2 id="support-title" className="truncate font-semibold text-[var(--text-primary)]">{view === 'form' ? 'Abrir chamado' : view === 'detail' ? (detail?.ticket?.codigo || 'Conversa do chamado') : admin ? 'Todos os chamados' : 'Meus chamados'}</h2><p className="truncate text-xs text-[var(--text-muted)]">{detail?.ticket?.nome || 'Acompanhe e converse com a equipe FocoMEI'}</p></div>
          {view === 'list' ? <button type="button" onClick={loadList} className="rounded-lg p-2 hover:bg-[var(--canvas)]" aria-label="Atualizar chamados"><RefreshCw className="h-4 w-4" /></button> : null}
          <button type="button" onClick={closeCenter} className="rounded-lg p-2 hover:bg-[var(--canvas)]" aria-label="Fechar central de suporte"><X className="h-5 w-5" /></button>
        </header>
        {role === 'superadmin' && view === 'list' ? <div className="grid grid-cols-2 gap-1 border-b border-[var(--card-border)] p-2">{['mine', 'all'].map((item) => <button key={item} type="button" onClick={() => setScope(item)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${scope === item ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'}`}>{item === 'mine' ? 'Meus chamados' : 'Todos os chamados'}</button>)}</div> : null}
        {view === 'form' ? <div className="min-h-0 overflow-y-auto"><SupportTicketForm onCancel={() => setView('list')} onCreated={() => { setView('list'); loadList(); }} /></div> : loading ? <div className="flex flex-1 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[var(--accent)]" aria-label="Carregando" /></div> : error ? <div className="p-4"><ErrorPanel message={error} onRetry={view === 'detail' ? loadDetail : loadList} /></div> : view === 'detail' && detail ? <Timeline detail={detail} admin={admin} onReload={loadDetail} /> : <div className="min-h-0 flex-1 overflow-y-auto"><div className="flex flex-wrap justify-end gap-2 px-3 pt-3 sm:px-4 sm:pt-4">{scope === 'mine' ? <><button type="button" onClick={async () => { await importSupportTickets(); loadList(); }} className="rounded-xl border border-[var(--card-border)] px-3 py-2 text-xs font-semibold">Importar antigos</button><button type="button" onClick={() => setView('form')} className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white"><Plus className="h-4 w-4" /> Abrir chamado</button></> : null}</div><TicketList tickets={tickets} admin={admin} onOpen={openTicket} /></div>}
      </section>
    </div>
  );
}
