import { create } from 'zustand';
import {
  getSupportUnreadCount,
  listSupportNotifications,
  markAllSupportNotificationsRead,
  markSupportNotificationRead,
  type SupportNotification,
} from '../services/supportService';

interface SupportCenterStore {
  open: boolean;
  /** Chamado que deve abrir direto ao montar a central. */
  focusTicketId: number | null;
  unreadCount: number;
  notifications: SupportNotification[];
  openCenter: (ticketId?: number | null) => void;
  closeCenter: () => void;
  clearFocus: () => void;
  setUnreadCount: (count: number) => void;
  refresh: () => Promise<void>;
  markRead: (eventId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

export const useSupportCenterStore = create<SupportCenterStore>((set) => ({
  open: false,
  focusTicketId: null,
  unreadCount: 0,
  notifications: [],
  openCenter: (ticketId = null) => set({ open: true, focusTicketId: ticketId ?? null }),
  closeCenter: () => set({ open: false, focusTicketId: null }),
  clearFocus: () => set({ focusTicketId: null }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  refresh: async () => {
    try {
      const { notifications, unreadCount } = await listSupportNotifications();
      set({ notifications, unreadCount });
    } catch {
      // Suporte nunca bloqueia o app: mantém o último estado conhecido.
    }
  },
  markRead: async (eventId) => {
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === eventId && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    }));
    try {
      const { unreadCount } = await markSupportNotificationRead(eventId);
      set({ unreadCount });
    } catch {
      set({ unreadCount: await getSupportUnreadCount().catch(() => 0) });
    }
  },
  markAllRead: async () => {
    const readAt = new Date().toISOString();
    set((state) => ({
      unreadCount: 0,
      notifications: state.notifications.map((item) => item.readAt ? item : { ...item, readAt }),
    }));
    try {
      await markAllSupportNotificationsRead();
    } catch {
      set({ unreadCount: await getSupportUnreadCount().catch(() => 0) });
    }
  },
  reset: () => set({ open: false, focusTicketId: null, unreadCount: 0, notifications: [] }),
}));
