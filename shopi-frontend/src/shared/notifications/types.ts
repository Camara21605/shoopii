/* ============================================================
 * FICHIER : src/shared/notifications/types.ts
 * Types TypeScript du centre de notifications Shoneya.
 * Miroir exact des interfaces INotificationDto / INotificationListResult
 * retournées par le backend (NotificationsController).
 * ============================================================ */

export interface INotificationDto {
  id:           string;
  type:         string;           // NotificationType enum value (ex: 'order.placed')
  priority:     'low' | 'normal' | 'high' | 'urgent';
  title:        string;
  body:         string;
  imageUrl:     string | null;
  actionUrl:    string | null;
  payload:      Record<string, unknown> | null;
  resourceType: string | null;
  resourceId:   string | null;
  /** Où mène la notification, décidé par le serveur (notification-target.util.ts) :
   *  page du site, écran de l'application, texte du bouton, filtre.
   *  null/absent = pas de règle spécifique (logique locale ci-dessous). */
  target?:      INotificationTarget | null;
  isRead:       boolean;
  readAt:       string | null;
  count:        number;           // > 1 = notification agrégée
  createdAt:    string;           // ISO
  actor?:       { type: string; id: string; name: string; avatar: string | null } | null;
}

export interface INotificationTarget {
  web:      string;
  app:      string | null;
  label:    string;
  category: 'missions' | 'gains' | 'avis' | 'messages' | 'compte';
}

export interface INotificationListResult {
  data:       INotificationDto[];
  total:      number;
  unread:     number;
  hasMore:    boolean;
  nextCursor: string | null;
}

export interface IUnreadCountResult {
  unreadCount: number;
}
