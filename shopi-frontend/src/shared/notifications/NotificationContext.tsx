/* ============================================================
 * FICHIER : src/shared/notifications/NotificationContext.tsx
 *
 * RÔLE : Contexte React centralisant l'état du centre de
 *   notifications (badge, liste, socket, toasts temps réel).
 *
 * USAGE :
 *   1. Envelopper le layout avec <NotificationProvider>
 *   2. Appeler useNotifications() dans n'importe quel composant
 *
 * STRATÉGIE DE CHARGEMENT :
 *   - Au mount  : fetch unread count (léger, pour le badge)
 *   - Au clic   : fetch la liste complète (lazy)
 *   - Socket    : mise à jour instantanée sans polling
 * ============================================================ */

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, type ReactNode,
} from 'react';
import { useNotificationSocket } from './useNotificationSocket';
import { notificationService }   from './notificationService';
import type { INotificationDto } from './types';

// ─── Types ────────────────────────────────────────────────────

interface NotificationContextValue {
  unreadCount:   number;
  notifications: INotificationDto[];
  isOpen:        boolean;
  isLoading:     boolean;
  hasMore:       boolean;
  toastQueue:    INotificationDto[];
  toggle:        () => void;
  close:         () => void;
  markAsRead:    (id: string) => void;
  markAllAsRead: () => void;
  deleteOne:     (id: string) => void;
  loadMore:      () => void;
  dismissToast:  (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [notifications, setNotifications] = useState<INotificationDto[]>([]);
  const [isOpen,        setIsOpen]        = useState(false);
  const [isLoading,     setIsLoading]     = useState(false);
  const [hasMore,       setHasMore]       = useState(false);
  const [toastQueue,    setToastQueue]    = useState<INotificationDto[]>([]);

  // Refs stables pour éviter les stale closures dans les callbacks
  const cursorRef    = useRef<string | null>(null);
  const loadingRef   = useRef(false);
  const hasFetchedRef = useRef(false);

  // ── Chargement initial du badge ───────────────────────────
  useEffect(() => {
    notificationService.getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {}); // silencieux si le backend n'est pas encore prêt
  }, []);

  // ── Fetch de la liste ─────────────────────────────────────
  const fetchList = useCallback(async (reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 20 };
      if (!reset && cursorRef.current) params.cursor = cursorRef.current;
      const result = await notificationService.getList(params);
      setNotifications(prev => reset ? result.data : [...prev, ...result.data]);
      setHasMore(result.hasMore);
      cursorRef.current = result.data[result.data.length - 1]?.createdAt ?? null;
      if (reset) setUnreadCount(result.unread);
      hasFetchedRef.current = true;
    } catch {
      // silencieux
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []); // stable — lit les refs, pas le state

  // ── Ouvrir le panel → déclenche le chargement si besoin ──
  useEffect(() => {
    if (isOpen && !hasFetchedRef.current && !loadingRef.current) {
      fetchList(true);
    }
  }, [isOpen, fetchList]);

  // ── Socket ────────────────────────────────────────────────
  const { markRead: socketMarkRead, markAllRead: socketMarkAllRead } =
    useNotificationSocket({
      onConnected: ({ unreadCount: c }) => setUnreadCount(c),

      onNew: ({ notification, unreadCount: c }) => {
        setUnreadCount(c);

        // Mise à jour de la liste si le panel est ouvert
        setNotifications(prev => {
          const idx = prev.findIndex(n => n.id === notification.id);
          if (idx >= 0) {
            // Agrégation : remplace la notification existante
            const next = [...prev];
            next[idx] = notification;
            return next;
          }
          return [notification, ...prev];
        });

        // Toast temps réel (auto-dismiss 5s)
        setToastQueue(prev => [...prev, notification]);
        setTimeout(() => {
          setToastQueue(prev => prev.filter(t => t.id !== notification.id));
        }, 5_000);
      },

      onUnreadCount: ({ unreadCount: c }) => setUnreadCount(c),

      onUpdated: ({ id, count, body }) => {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, count, body } : n)
        );
      },
    });

  // ── Actions ───────────────────────────────────────────────

  const toggle = useCallback(() => setIsOpen(p => !p), []);
  const close  = useCallback(() => setIsOpen(false),   []);

  const loadMore = useCallback(() => fetchList(false), [fetchList]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    socketMarkRead(id);
    notificationService.markAsRead(id).catch(() => {});
  }, [socketMarkRead]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, isRead: true, readAt: n.readAt ?? new Date().toISOString() }))
    );
    setUnreadCount(0);
    socketMarkAllRead();
    notificationService.markAllAsRead().catch(() => {});
  }, [socketMarkAllRead]);

  const deleteOne = useCallback((id: string) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (target && !target.isRead) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });
    notificationService.deleteOne(id).catch(() => {});
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToastQueue(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─────────────────────────────────────────────────────────

  return (
    <NotificationContext.Provider value={{
      unreadCount, notifications, isOpen, isLoading, hasMore, toastQueue,
      toggle, close, markAsRead, markAllAsRead, deleteOne, loadMore, dismissToast,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications doit être utilisé dans NotificationProvider');
  return ctx;
}
