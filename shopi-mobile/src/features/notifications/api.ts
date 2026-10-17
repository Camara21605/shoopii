/**
 * Notifications du compte — mêmes adresses que le site
 * (shopi-frontend/src/shared/notifications/notificationService.ts) :
 *   GET    /notifications?limit=&cursor=&unreadOnly=   (pages par curseur)
 *   GET    /notifications/unread-count
 *   PATCH  /notifications/:id/read      PATCH /notifications/read-all
 *   DELETE /notifications/:id           DELETE /notifications
 */
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

/** Où mène la notification, décidé par le serveur (notification-target.util.ts). */
export const notificationTargetSchema = z
  .object({
    web: z.string(),
    /** null : pas d'écran dédié — l'application affiche le détail */
    app: z.string().nullable(),
    label: z.string().catch('Ouvrir'),
    category: z.enum(['missions', 'gains', 'avis', 'messages', 'compte']).catch('compte'),
  })
  .passthrough();
export type NotificationTarget = z.infer<typeof notificationTargetSchema>;

export const notificationSchema = z
  .object({
    id: z.string(),
    type: z.string().default('system'),
    title: z.string(),
    body: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    actionUrl: z.string().nullable().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
    resourceType: z.string().nullable().optional(),
    resourceId: z.string().nullable().optional(),
    target: notificationTargetSchema.nullable().optional().catch(null),
    isRead: z.boolean(),
    count: z.coerce.number().optional().default(1),
    createdAt: z.string(),
    actor: z.object({ name: z.string().optional(), avatar: z.string().nullable().optional() }).passthrough().nullable().optional(),
  })
  .passthrough();
export type AppNotification = z.infer<typeof notificationSchema>;

const pageSchema = z
  .object({
    data: z.array(notificationSchema),
    total: z.coerce.number().optional(),
    unread: z.coerce.number().optional(),
    hasMore: z.boolean().optional().default(false),
    nextCursor: z.string().nullable().optional(),
  })
  .passthrough();
export type NotificationPage = z.infer<typeof pageSchema>;

export function fetchNotificationPage(opts: { cursor?: string | null; unreadOnly?: boolean }) {
  return apiFetch('/notifications', {
    schema: pageSchema,
    query: { limit: 30, cursor: opts.cursor ?? undefined, unreadOnly: opts.unreadOnly ? true : undefined },
  });
}

export async function fetchUnreadNotifications() {
  const res = await apiFetch('/notifications/unread-count', { schema: z.object({ unreadCount: z.coerce.number() }).passthrough() });
  return res.unreadCount;
}

export const markNotificationRead = (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
export const markAllNotificationsRead = () => apiFetch('/notifications/read-all', { method: 'PATCH' });
export const deleteNotification = (id: string) => apiFetch(`/notifications/${id}`, { method: 'DELETE' });
export const deleteAllNotifications = () => apiFetch('/notifications', { method: 'DELETE' });
