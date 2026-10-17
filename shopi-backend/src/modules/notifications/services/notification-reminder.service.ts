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
 *     → PushChannelStrategy.deliver() [PUSH SEULEMENT — jamais dans la liste]
 *
 * PROTECTION ANTI-SPAM :
 *   Un digest n'est envoyé que si `lastSeenAt` est null ou > 24h (CRON
 *   quotidien) et seulement s'il reste de VRAIES notifications non lues.
 *   Le rappel n'est plus une ligne de la cloche : il ne se compte plus
 *   lui-même et ne s'agrège plus en « Vous et 1 autre — … ». Les anciens
 *   rappels déjà enregistrés sont masqués (excludeMessagingTypes).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  NotificationPreference,
} from 'src/database/entities/notification/notification-preference.entity';
import {
  Notification,
  NotificationActorType,
  NotificationType,
  NotificationPriority,
} from 'src/database/entities/notification/notification.entity';
import { NotificationService } from './notification.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { PushChannelStrategy } from '../strategies/push-channel.strategy';

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
    private readonly prefService:  NotificationPreferenceService,
    private readonly push:         PushChannelStrategy,
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
    try {
      /* Le compteur des préférences peut dériver : on recompte les vraies non lues. */
      const real = await this.notifService.getUnreadCount(actorType, actorId).catch(() => unreadCount);
      if (real <= 0) return;

      const pl    = real > 1;
      const title = `${real} notification${pl ? 's' : ''} non lue${pl ? 's' : ''}`;
      const body  = pl
        ? `Vous avez ${real} notifications qui vous attendent. Touchez pour les voir.`
        : 'Vous avez 1 notification qui vous attend. Touchez pour la voir.';

      /* PUSH SEULEMENT — aucune ligne dans la liste (avant : le rappel s'ajoutait
       * à la liste, se comptait lui-même et s'agrégeait en « Vous et 1 autre — … »). */
      const pref = await this.prefService.getOrCreate(actorType, actorId);
      const notif = Object.assign(new Notification(), {
        id:           '',
        recipientType: actorType,
        recipientId:   actorId,
        actorType:     null,
        actorId:       null,
        type:          NotificationType.SYSTEM_ANNOUNCEMENT,
        priority:      NotificationPriority.LOW,
        title,
        body,
        imageUrl:      null,
        /* Le site n'a pas de page « notifications » pour les espaces pro : on ouvre
         * l'accueil du tableau de bord ; l'application ouvre son centre de notifications. */
        actionUrl:     this.resolveDashboardHomeUrl(actorType),
        payload:       { unreadCount: real },
        resourceType:  null,
        resourceId:    null,
        groupKey:      `digest:${actorType}:${actorId}`,
        count:         1,
        isRead:        false,
        createdAt:     new Date(),
      });
      if (this.push.canSend(pref, notif)) await this.push.deliver(notif, pref);
    } catch (err) {
      this.logger.error(
        `sendDigest échoué pour ${actorType}:${actorId}`,
        err,
      );
    }
  }

  /** Racine du tableau de bord du rôle — voir router.tsx pour les routes
   *  /dashboard/{role}/* réellement enregistrées. */
  private resolveDashboardHomeUrl(actorType: NotificationActorType): string {
    switch (actorType) {
      case NotificationActorType.CLIENT:        return '/home';
      case NotificationActorType.COMPANY:       return '/dashboard/entreprise';
      case NotificationActorType.DELIVERY:      return '/dashboard/livreur';
      case NotificationActorType.CORRESPONDENT: return '/dashboard/correspondant';
      case NotificationActorType.PARTNER:       return '/dashboard/partenaire';
      case NotificationActorType.ADMIN:         return '/dashboard/admin';
      case NotificationActorType.SUPER_ADMIN:   return '/dashboard/super-admin';
      default:                                  return '/home';
    }
  }
}
