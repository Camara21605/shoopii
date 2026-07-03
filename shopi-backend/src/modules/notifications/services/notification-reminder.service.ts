/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-reminder.service.ts
 *
 * RÔLE : Gestion des rappels de notifications non lues (digest).
 *
 * FLUX :
 *   NotificationScheduler (CRON 09h00)
 *     → findRecipientsWithUnread()  [trouver qui a des notifs non lues]
 *     → queue.add(REMINDER, { actorType, actorId, unreadCount })
 *
 *   NotificationProcessor (BullMQ worker)
 *     → handleReminder(job)
 *     → sendDigest(actorType, actorId, unreadCount)
 *     → NotificationService.create() [SYSTEM_ANNOUNCEMENT — IN_APP + PUSH]
 *
 * PROTECTION ANTI-SPAM :
 *   Un digest n'est envoyé que si `lastSeenAt` est null ou > 24h.
 *   La notification de digest porte un groupKey unique par acteur
 *   → une seule notification de rappel par acteur par jour (agrégation 24h).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  NotificationPreference,
} from 'src/database/entities/notification/notification-preference.entity';
import {
  NotificationActorType,
  NotificationType,
  NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';
import { NotificationService } from './notification.service';

// ─── Types ────────────────────────────────────────────────────

export interface ReminderRecipient {
  actorType:   NotificationActorType;
  actorId:     string;
  unreadCount: number;
}

// ─────────────────────────────────────────────────────────────

@Injectable()
export class NotificationReminderService {

  private readonly logger = new Logger(NotificationReminderService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,

    private readonly notifService: NotificationService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // SÉLECTION DES DESTINATAIRES
  // ─────────────────────────────────────────────────────────

  /**
   * Retourne tous les acteurs ayant au moins `minUnread` notifications
   * non lues ET dont `lastSeenAt` est null ou antérieur à 24h.
   *
   * Exclut les acteurs système et les admins (pas de digest pour eux).
   *
   * @param minUnread — Seuil minimum de non lues (défaut : 1)
   * @param limit     — Taille du batch (défaut : 500)
   */
  async findRecipientsWithUnread(
    minUnread = 1,
    limit     = 500,
  ): Promise<ReminderRecipient[]> {
    const threshold24h = new Date(Date.now() - 24 * 60 * 60 * 1_000);

    const rows = await this.prefRepo
      .createQueryBuilder('p')
      .select(['p.actorType', 'p.actorId', 'p.unreadCount'])
      .where('p.unreadCount >= :minUnread', { minUnread })
      .andWhere(
        '(p.lastSeenAt IS NULL OR p.lastSeenAt < :threshold)',
        { threshold: threshold24h },
      )
      // Exclure les acteurs système/admin (pas de digest UI)
      .andWhere('p.actorType NOT IN (:...excluded)', {
        excluded: [
          NotificationActorType.SYSTEM,
          NotificationActorType.ADMIN,
          NotificationActorType.SUPER_ADMIN,
        ],
      })
      .orderBy('p.unreadCount', 'DESC') // priorité aux plus chargés
      .take(limit)
      .getMany();

    return rows.map(p => ({
      actorType:   p.actorType,
      actorId:     p.actorId,
      unreadCount: p.unreadCount,
    }));
  }

  // ─────────────────────────────────────────────────────────
  // ENVOI DU DIGEST
  // ─────────────────────────────────────────────────────────

  /**
   * Crée une notification récapitulative (SYSTEM_ANNOUNCEMENT)
   * pour un acteur donné.
   *
   * La notification est de priorité LOW pour ne pas spammer.
   * Elle expire dans 7 jours si non lue.
   * Son groupKey empêche l'envoi de plusieurs digests par jour
   * grâce à la fenêtre d'agrégation 24h de NotificationService.
   *
   * @param actorType   — Type de l'acteur destinataire
   * @param actorId     — UUID du profil destinataire
   * @param unreadCount — Nombre de notifications non lues
   */
  async sendDigest(
    actorType:   NotificationActorType,
    actorId:     string,
    unreadCount: number,
  ): Promise<void> {
    const pl     = unreadCount > 1;
    const title  = `${unreadCount} notification${pl ? 's' : ''} non lue${pl ? 's' : ''}`;
    const body   = pl
      ? `Vous avez ${unreadCount} notifications qui vous attendent. Consultez votre centre de notifications.`
      : `Vous avez 1 notification non lue. Consultez votre centre de notifications.`;

    try {
      await this.notifService.create({
        recipientType: actorType,
        recipientId:   actorId,
        actorType:     null,
        actorId:       null,
        type:          NotificationType.SYSTEM_ANNOUNCEMENT,
        priority:      NotificationPriority.LOW,
        title,
        body,
        actionUrl:     '/notifications',
        payload:       { unreadCount },
        groupKey:      `digest:${actorType}:${actorId}`,
        expiresAt:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000), // 7 jours
      });
    } catch (err) {
      this.logger.error(
        `sendDigest échoué pour ${actorType}:${actorId}`,
        err,
      );
    }
  }
}
