/* ============================================================
 * FICHIER : src/modules/notifications/strategies/inapp-channel.strategy.ts
 *
 * RÔLE : Strategy IN_APP — émet via Socket.IO gateway /notifications.
 *
 * FONCTIONNEMENT :
 *   1. NotificationService.create() appelle directement cette
 *      strategy de manière synchrone (avant BullMQ).
 *   2. Si l'utilisateur est connecté → notification instantanée.
 *   3. Si non connecté → la notification est en base et sera
 *      chargée au prochain chargement de la liste.
 *
 * PARTICULARITÉ :
 *   IN_APP est le seul canal qui n'utilise PAS BullMQ.
 *   L'émission Socket.IO est synchrone et instantanée (<5ms).
 *   BullMQ est réservé aux canaux lents (Email, SMS, Push).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import {
  Notification, NotificationChannel, NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';
import type { NotificationPreference } from 'src/database/entities/notification/notification-preference.entity';
import type { IChannelStrategy }       from '../interfaces/channel-strategy.interface';
import type { IDeliveryResult }        from '../interfaces/notification.interfaces';
import { NotificationBroadcastService } from '../services/notification-broadcast.service';

@Injectable()
export class InAppChannelStrategy implements IChannelStrategy {

  readonly channel = NotificationChannel.IN_APP;

  private readonly logger = new Logger(InAppChannelStrategy.name);

  constructor(
    private readonly broadcast: NotificationBroadcastService,
  ) {}

  /**
   * IN_APP est toujours activé — c'est le canal de base.
   *
   * La seule exception : si les préférences désactivent in_app
   * pour ce type spécifique de notification.
   */
  canSend(
    pref:  NotificationPreference,
    notif: Notification,
  ): boolean {
    // Vérifier la préférence in_app pour ce type précis
    const typePref = pref.preferences?.[notif.type];
    if (typePref && typePref.in_app === false) {
      return false;
    }
    return true;
  }

  /**
   * Émet la notification sur le socket de l'utilisateur.
   *
   * Utilise NotificationBroadcastService pour accéder au server
   * Socket.IO sans dépendance circulaire avec le gateway.
   *
   * Si l'utilisateur n'est pas connecté → succès quand même
   * (la notification est en base, sera chargée à la connexion).
   */
  async deliver(
    notif: Notification,
    pref:  NotificationPreference,
  ): Promise<IDeliveryResult> {
    try {
      // Cherche l'userId associé à cet acteur via le broadcast service
      const emitted = await this.broadcast.emitToActor(
        pref.actorType,
        pref.actorId,
        'notif:new',
        {
          notification: {
            id:           notif.id,
            type:         notif.type,
            priority:     notif.priority,
            title:        notif.title,
            body:         notif.body,
            imageUrl:     notif.imageUrl,
            actionUrl:    notif.actionUrl,
            payload:      notif.payload,
            resourceType: notif.resourceType,
            resourceId:   notif.resourceId,
            isRead:       notif.isRead,
            readAt:       null,
            count:        notif.count,
            createdAt:    notif.createdAt.toISOString(),
            actor:        null,
          },
          unreadCount: (pref.unreadCount ?? 0) + 1,
        },
      );

      this.logger.debug(
        `IN_APP emit notif=${notif.id} actor=${pref.actorType}:${pref.actorId} `
        + `connected=${emitted}`,
      );

      return {
        channel:  NotificationChannel.IN_APP,
        success:  true,
        providerMessageId: emitted ? 'socket-io' : 'offline-queued',
      };
    } catch (err) {
      this.logger.error(`IN_APP deliver error notif=${notif.id}`, err);
      return {
        channel:      NotificationChannel.IN_APP,
        success:      false,
        errorCode:    'SOCKET_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Erreur Socket.IO',
        isPermanentFailure: false,
      };
    }
  }
}
