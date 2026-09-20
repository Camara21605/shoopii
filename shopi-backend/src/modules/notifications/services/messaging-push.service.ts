/* ============================================================
 * FICHIER : src/modules/notifications/services/messaging-push.service.ts
 *
 * RÔLE : Notification SYSTÈME (push téléphone / navigateur) d'un message ou
 * d'un appel manqué — SANS jamais toucher au centre de notifications.
 *
 * SÉPARATION COMPLÈTE messagerie ↔ notifications (voir
 * messaging-domain.util.ts) : ce service n'écrit aucune ligne dans la table
 * `notifications`, n'incrémente aucun compteur de cloche et n'émet aucun
 * événement `notif:*` sur le socket. Le compteur d'un message vit sur
 * l'onglet « Messagerie » (conversations.unreadCount*).
 *
 * Respecte les préférences de l'utilisateur, comme le canal PUSH classique :
 * push global coupé, mode « ne pas déranger », préférence par type.
 * La pastille de l'icône = messages non lus + notifications non lues.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource }   from '@nestjs/typeorm';
import { DataSource }         from 'typeorm';

import {
  NotificationActorType, NotificationPriority, NotificationType,
} from 'src/database/entities/notification/notification.entitiy';
import { countMessagingUnread } from 'src/common/utils/messaging-unread.util';

import type { ICreateNotificationPayload } from '../interfaces/notification.interfaces';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationRepository }        from '../repositories/notification.repository';
import { WebPushService }                from './web-push.service';
import { isDndActive }                   from '../utils/dnd.util';
import { MESSAGING_PUSH_TYPES }          from '../utils/messaging-domain.util';

@Injectable()
export class MessagingPushService {

  private readonly logger = new Logger(MessagingPushService.name);

  constructor(
    private readonly webPush:  WebPushService,
    private readonly prefs:    NotificationPreferenceService,
    private readonly notifRepo: NotificationRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Envoie le push d'un événement de messagerie. Ne lève jamais : un push
   * raté ne doit jamais faire échouer l'envoi du message ou de l'appel.
   */
  async deliver(payload: ICreateNotificationPayload): Promise<void> {
    try {
      const { recipientType, recipientId, type } = payload;

      // Retours destinés à l'appelant (occupé, hors ligne, refusé) : ni cloche, ni push.
      if (!MESSAGING_PUSH_TYPES.has(type)) return;
      if (!this.webPush.isEnabled()) return;

      const pref = await this.prefs.getOrCreate(recipientType, recipientId);
      if (!pref.globalPushEnabled) return;

      const devices = (pref.pushTokens ?? []).filter(t => t.platform === 'web');
      if (devices.length === 0) return;

      if ((payload.priority ?? NotificationPriority.NORMAL) !== NotificationPriority.URGENT && isDndActive(pref)) return;
      if (!this.prefs.getEffectiveChannelPref(pref, type as NotificationType).push) return;

      /* Pastille de l'icône : ce qui reste à lire dans la messagerie + dans
       * les notifications — recalculé côté serveur pour rester exact même
       * application fermée. */
      const [messages, others] = await Promise.all([
        countMessagingUnread(this.dataSource.manager, recipientType, recipientId),
        this.notifRepo.countUnread(recipientType as NotificationActorType, recipientId),
      ]);

      const url = payload.actionUrl
        ?? (payload.resourceType === 'conversation' && payload.resourceId
              ? `/messagerie?conv=${payload.resourceId}`
              : '/messagerie');

      /* Un `tag` par conversation : les messages successifs d'une même
       * conversation se REMPLACENT au lieu de s'empiler. */
      const tag = `${type.split('.')[0]}:${payload.resourceId ?? type}`;

      const gone: string[] = [];
      await Promise.all(devices.map(async (device) => {
        const subscription = this.webPush.parseSubscription(device.token);
        if (!subscription) { gone.push(device.token); return; }

        const result = await this.webPush.send(subscription, {
          title:   payload.title,
          body:    payload.body,
          url,
          icon:    payload.imageUrl ?? undefined,     // avatar de l'expéditeur
          tag,
          unread:  messages + others,
          type,
        }, type !== 'message.received');                // appel manqué = urgent
        if (result.gone) gone.push(device.token);
      }));

      // Abonnements expirés/invalides : nettoyage automatique.
      for (const token of gone) {
        await this.prefs.removeToken(recipientType as NotificationActorType, recipientId, { token });
      }
    } catch (err) {
      this.logger.warn(`Push messagerie ignoré : ${(err as Error).message}`);
    }
  }
}
