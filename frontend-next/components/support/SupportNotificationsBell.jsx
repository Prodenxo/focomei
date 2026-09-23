'use client';

import { Bell, CheckCheck, MessageCircle, TicketCheck } from 'lucide-react';
import { useState } from 'react';
import { useSupport } from '@/context/SupportProvider';
import { formatSupportDate } from '@/lib/supportHelpers';

export function SupportNotificationsBell({ inverse = false }) {
  const [open, setOpen] = useState(false);
  const {
    unreadCount, notifications, notificationsError, refresh,
    markRead, markAllRead, openCenter,
  } = useSupport();

  const toggle = () => {
    setOpen((current) => !current);
    if (!open) refresh();
  };

  const select = async (item) => {
    setOpen(false);
    if (!item.readAt) await markRead(item.id).catch(() => {});
    openCenter(item.scrumhubTicketId);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          inverse ? 'border-white/15 text-white hover:bg-white/10' : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-primary)]'
        }`}
        aria-label={unreadCount ? `${unreadCount} notificações de suporte não lidas` : 'Notificações de suporte'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Fechar notificações" />
          <section className="fixed left-3 right-3 top-16 z-50 max-h-[70vh] overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96" aria-label="Notificações de suporte">
            <header className="flex items-center justify-between border-b border-[var(--card-border)] p-4">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Notificações</h2>
              {unreadCount ? (
                <button type="button" onClick={() => markAllRead()} className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
                  <CheckCheck className="h-4 w-4" aria-hidden /> Marcar lidas
                </button>
              ) : null}
            </header>
            <div className="max-h-80 overflow-y-auto p-2">
              {notificationsError ? <p role="alert" className="p-4 text-sm text-red-600">{notificationsError}</p> : null}
              {!notificationsError && notifications.length === 0 ? (
                <p className="p-6 text-center text-sm text-[var(--text-muted)]">Nenhuma novidade no suporte.</p>
              ) : notifications.map((item) => (
                <button key={item.id} type="button" onClick={() => select(item)} className={`flex w-full gap-3 rounded-xl p-3 text-left hover:bg-[var(--canvas)] ${item.readAt ? '' : 'bg-[var(--canvas)]'}`}>
                  {item.eventType === 'completed'
                    ? <TicketCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    : <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{item.message}</span>
                    <span className="mt-1 block text-[10px] text-[var(--text-muted)]">{formatSupportDate(item.createdAt, true)}</span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { setOpen(false); openCenter(); }} className="w-full border-t border-[var(--card-border)] p-3 text-sm font-semibold text-[var(--accent)]">
              Abrir central de suporte
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
