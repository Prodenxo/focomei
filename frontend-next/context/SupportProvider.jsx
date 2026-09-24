'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import {
  listSupportNotifications,
  markAllSupportNotificationsRead,
  markSupportNotificationRead,
} from '@/lib/supportService';

const SupportContext = createContext(null);

export function SupportProvider({ children }) {
  const { userId } = useAuth();
  const [open, setOpen] = useState(false);
  const [focusTicketId, setFocusTicketId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notificationsError, setNotificationsError] = useState(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await listSupportNotifications();
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Falha ao carregar notificações.');
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setNotifications([]);
      return undefined;
    }
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [refresh, userId]);

  const openCenter = useCallback((ticketId = null) => {
    setFocusTicketId(ticketId);
    setOpen(true);
  }, []);

  const closeCenter = useCallback(() => {
    setOpen(false);
    setFocusTicketId(null);
  }, []);

  const markRead = useCallback(async (eventId) => {
    const result = await markSupportNotificationRead(eventId);
    setUnreadCount(result.unreadCount);
    setNotifications((current) => current.map((item) => (
      item.id === eventId ? { ...item, readAt: new Date().toISOString() } : item
    )));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllSupportNotificationsRead();
    setUnreadCount(0);
    setNotifications((current) => current.map((item) => ({
      ...item,
      readAt: item.readAt || new Date().toISOString(),
    })));
  }, []);

  const value = useMemo(() => ({
    open,
    focusTicketId,
    unreadCount,
    notifications,
    notificationsError,
    openCenter,
    closeCenter,
    refresh,
    markRead,
    markAllRead,
    setUnreadCount,
  }), [
    open, focusTicketId, unreadCount, notifications, notificationsError,
    openCenter, closeCenter, refresh, markRead, markAllRead,
  ]);

  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  const context = useContext(SupportContext);
  if (!context) throw new Error('useSupport deve ser usado dentro de SupportProvider');
  return context;
}
