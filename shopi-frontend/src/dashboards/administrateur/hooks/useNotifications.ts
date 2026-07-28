/* ================================================================
 * HOOK : useNotifications.ts
 *
 * Gestion complète des notifications admin :
 *   - Chargement initial de la liste + compteur non-lus
 *   - Connexion WebSocket temps réel (via useNotificationSocket partagé)
 *   - Actions REST : markRead, markAll, dismiss
 *   - Polling de secours (60s) si la socket est absente
 *
 * Réutilise :
 *   - useNotificationSocket (singleton socket /notifications)
 *   - INotificationDto + INotificationListResult (types partagés)
 * ================================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useNotificationSocket } from '../../../shared/notifications/useNotificationSocket';
import type { INotificationDto, INotificationListResult } from '../../../shared/notifications/types';

export type { INotificationDto };

// ─── Constantes ────────────────────────────────────────────────

const PAGE_SIZE = 20;
const POLL_MS   = 60_000;

// ─── Hook ──────────────────────────────────────────────────────

export function useNotifications() {
  const [items,       setItems]       = useState<INotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Chargement de la liste ───────────────────────────────────

  const fetchCount = useCallback(async () => {
    try {
      const d = await apiFetch<{ unreadCount: number }>('/notifications/unread-count');
      if (d) setUnreadCount(d.unreadCount);
    } catch { /* silencieux */ }
  }, []);

  const fetchList = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: String(PAGE_SIZE) };
      if (cursor) params.cursor = cursor;

      const d = await apiFetch<INotificationListResult>('/notifications', { params });
      if (!d) return;

      setUnreadCount(d.unread);
      setNextCursor(d.nextCursor);

      if (cursor) {
        setItems(prev => [...prev, ...d.data]);
      } else {
        setItems(d.data);
      }
    } catch { /* silencieux */ } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (nextCursor) fetchList(nextCursor);
  }, [nextCursor, fetchList]);

  const refetch = useCallback(() => fetchList(), [fetchList]);

  // ── WebSocket temps réel (singleton partagé) ─────────────────

  useNotificationSocket({
    onConnected: ({ unreadCount: c }) => setUnreadCount(c),

    onNew: ({ notification, unreadCount: c }) => {
      setItems(prev => [notification, ...prev]);
      setUnreadCount(c);
    },

    onUpdated: ({ id, count, body }) => {
      setItems(prev =>
        prev.map(n => n.id === id ? { ...n, count, body } : n),
      );
    },

    onUnreadCount: ({ unreadCount: c }) => setUnreadCount(c),
  });

  // ── Chargement initial + polling de secours ──────────────────

  useEffect(() => {
    fetchList();
    pollRef.current = setInterval(fetchCount, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Actions REST ─────────────────────────────────────────────

  const markRead = useCallback(async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { /* silencieux */ }
  }, []);

  const markAll = useCallback(async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH' });
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silencieux */ }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    try {
      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
      setItems(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.isRead) setUnreadCount(c => Math.max(0, c - 1));
        return prev.filter(n => n.id !== id);
      });
    } catch { /* silencieux */ }
  }, []);

  return {
    items,
    unreadCount,
    loading,
    hasMore: !!nextCursor,
    markRead,
    markAll,
    dismiss,
    loadMore,
    refetch,
  };
}
