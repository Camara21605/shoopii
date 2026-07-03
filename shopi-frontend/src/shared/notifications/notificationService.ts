/* ============================================================
 * FICHIER : src/shared/notifications/notificationService.ts
 * Client REST pour les 5 endpoints du centre de notifications.
 * ============================================================ */

import { apiFetch } from '../services/apiFetch';
import type { INotificationDto, INotificationListResult } from './types';

export interface ListParams {
  limit?:      number;
  cursor?:     string;
  unreadOnly?: boolean;
  type?:       string;
}

export const notificationService = {

  getList(params: ListParams = {}): Promise<INotificationListResult> {
    return apiFetch<INotificationListResult>('/notifications', {
      params: params as Record<string, string | number | boolean | null | undefined>,
    });
  },

  getUnreadCount(): Promise<number> {
    return apiFetch<{ unreadCount: number }>('/notifications/unread-count')
      .then(r => r.unreadCount);
  },

  markAsRead(id: string): Promise<void> {
    return apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllAsRead(): Promise<void> {
    return apiFetch<void>('/notifications/read-all', { method: 'PATCH' });
  },

  deleteOne(id: string): Promise<void> {
    return apiFetch<void>(`/notifications/${id}`, { method: 'DELETE' });
  },

} as const;
