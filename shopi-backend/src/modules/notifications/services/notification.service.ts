/* ============================================================
 * FICHIER : src/modules/notifications/services/notification.service.ts
 *
 * RÔLE : Point d'entrée unique pour TOUTES les notifications Shopi.
 *
 * RÈGLE FONDAMENTALE :
 *   Aucun autre module ne doit créer de Notification directement.
 *   Toute notification passe par NotificationService.create().
 *   Cette règle garantit :
 *     - Agrégation cohérente (pas de spam)
 *     - DND respecté partout
 *     - Compteur unreadCount toujours synchronisé
 *     - Delivery logs créés systématiquement
 *
 * FLUX create() :
 *   1. Charger les préférences du destinataire
 *   2. Vérifier si agrégation possible (groupKey + 24h)
 *      → OUI : incrémenter count + body + émettre socket
 *      → NON : insérer nouvelle notification
 *   3. Incrémenter unreadCount dans les préférences
 *   4. Émettre Socket.IO IN_APP (synchrone, instantané)
 *   5. Enqueuer BullMQ pour les canaux externes (async)
 *
 * CANAUX DÉCLENCHÉS :
 *   - IN_APP  : synchrone (dans create())
 *   - PUSH    : async via BullMQ
 *   - EMAIL   : async via BullMQ
 *   - SMS     : async via BullMQ
 * ============================================================ */

import {
  Injectable, Logger, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue }  from 'bullmq';
import { DataSource }  from 'typeorm';
import {
  Notification,
  NotificationActorType,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from 'src/database/entities/notification/notification.entitiy';
import { NotificationPreference } from 'src/database/entities/notification/notification-preference.entity';
import type { ICreateNotificationPayload, INotificationListResult } from '../interfaces/notification.interfaces';
import { NotificationRepository, FindNotificationsParams } from '../repositories/notification.repository';
import { NotificationPreferenceService }                   from './notification-preference.service';
import { NotificationDispatchService }                     from './notification-dispatch.service';
import { NotificationBroadcastService }                    from './notification-broadcast.service';
import { InAppChannelStrategy }                            from '../strategies/inapp-channel.strategy';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS }           from '../queue/notification.queue';
import type { ListNotificationsQueryDto }                  from '../dto/list-notifications.query.dto';
import type { UpdatePreferencesDto }                       from '../dto/update-preferences.dto';
import type { RegisterPushTokenDto }                       from '../dto/register-push-token.dto';

@Injectable()
export class NotificationService {

  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notifRepo:    NotificationRepository,
    private readonly prefService:  NotificationPreferenceService,
    private readonly dispatch:     NotificationDispatchService,
    private readonly broadcast:    NotificationBroadcastService,
    private readonly inApp:        InAppChannelStrategy,
    private readonly dataSource:   DataSource,

    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly queue: Queue,
  ) {}

  // ═════════════════════════════════════════════════════════
  // CRÉER UNE NOTIFICATION
  // ═════════════════════════════════════════════════════════

  /**
   * Crée (ou agrège) une notification et la dispatche.
   *
   * C'est le seul point d'entrée pour créer une notification.
   * Appelé par tous les modules métier (commande, livraison, etc.)
   *
   * @returns La notification créée ou agrégée
   */
  async create(payload: ICreateNotificationPayload): Promise<Notification> {
    const {
      recipientType, recipientId,
      actorType = null, actorId = null,
      type, priority = NotificationPriority.NORMAL,
      title, body, imageUrl = null, actionUrl = null,
      payload: ctx = null, resourceType = null, resourceId = null,
      groupKey = null, expiresAt = null, forceChannel,
    } = payload;

    try {
      // ── 1. Charger les préférences (hors transaction) ─────
      const pref = await this.prefService.getOrCreate(recipientType, recipientId);

      // ── 2. Créer ou agréger de façon atomique ─────────────
      //   SELECT FOR UPDATE empêche deux requêtes concurrentes
      //   de créer deux notifications pour le même groupKey.
      const { notif, isAggregated } = await this.dataSource.transaction(async (manager) => {
        if (groupKey) {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const existing = await manager.findOne(Notification, {
            where: { recipientType, recipientId, groupKey, isRead: false },
            order: { createdAt: 'DESC' },
            lock:  { mode: 'pessimistic_write' },
          });

          if (existing && existing.createdAt > since) {
            const newBody = this.buildAggregatedBody(body, existing.count + 1);
            await manager
              .createQueryBuilder()
              .update(Notification)
              .set({ count: () => '"count" + 1', body: newBody, updatedAt: new Date() })
              .where('id = :id', { id: existing.id })
              .execute();

            return {
              notif: { ...existing, count: existing.count + 1, body: newBody } as Notification,
              isAggregated: true,
            };
          }
        }

        // Nouvelle notification + incrément unreadCount dans la même transaction
        const entity = manager.create(Notification, {
          recipientType, recipientId,
          actorType, actorId,
          type, priority,
          title, body,
          imageUrl, actionUrl,
          payload: ctx,
          resourceType, resourceId,
          groupKey, expiresAt,
          channel: NotificationChannel.IN_APP,
          isRead:  false,
          isSent:  false,
          count:   1,
        });
        const savedNotif = await manager.save(entity);

        // Atomique avec l'insert → pas de drift possible
        await manager
          .createQueryBuilder()
          .update(NotificationPreference)
          .set({ unreadCount: () => '"unreadCount" + 1' })
          .where('"actorType" = :at AND "actorId" = :ai', {
            at: recipientType,
            ai: recipientId,
          })
          .execute();

        return { notif: savedNotif, isAggregated: false };
      });

      // ── 3. Effets de bord Socket.IO (hors transaction) ────
      if (isAggregated) {
        await this.broadcast.emitToActor(
          recipientType, recipientId, 'notif:updated', {
            id:    notif.id,
            count: notif.count,
            body:  notif.body,
          },
        );
        this.logger.debug(`Notification agrégée id=${notif.id} count=${notif.count}`);
      } else {
        // pref.unreadCount est la valeur PRE-incrément ;
        // InAppChannelStrategy émet (pref.unreadCount + 1) = nouveau total correct.
        await this.inApp.deliver(notif, pref);

        // ── 4. Enqueuer les canaux externes (async) ──────────
        const externalChannels = this.resolveExternalChannels(pref, notif, forceChannel);
        if (externalChannels.length > 0) {
          const jobPriority = priority === NotificationPriority.URGENT ? 1 : 10;
          await this.queue.add(
            NOTIFICATION_JOBS.DISPATCH,
            { notificationId: notif.id, channels: externalChannels },
            {
              priority:         jobPriority,
              attempts:         3,
              backoff:          { type: 'exponential', delay: 5_000 },
              removeOnComplete: { count: 100 },
              removeOnFail:     false,
            },
          );
        }

        this.logger.debug(
          `Notification créée id=${notif.id} type=${type} `
          + `recipient=${recipientType}:${recipientId} `
          + `channels=[${externalChannels.join(',')}]`,
        );
      }

      return notif;
    } catch (err) {
      this.logger.error(`Erreur création notification type=${type}`, err);
      throw err;
    }
  }

  // ═════════════════════════════════════════════════════════
  // LISTE & LECTURE
  // ═════════════════════════════════════════════════════════

  /**
   * Retourne la liste paginée des notifications d'un acteur.
   */
  async getList(
    actorType: NotificationActorType,
    actorId:   string,
    query:     ListNotificationsQueryDto,
  ): Promise<INotificationListResult> {
    return this.notifRepo.findPaginated({
      recipientType: actorType,
      recipientId:   actorId,
      limit:         query.limit ?? 20,
      cursor:        query.cursor,
      unreadOnly:    query.unreadOnly,
      type:          query.type,
      search:        query.search,
    });
  }

  /**
   * Compte uniquement les non-lues.
   * Utilisé par le badge dans la topbar.
   */
  async getUnreadCount(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<number> {
    return this.notifRepo.countUnread(actorType, actorId);
  }

  // ═════════════════════════════════════════════════════════
  // MARQUER COMME LU
  // ═════════════════════════════════════════════════════════

  /**
   * Marque une notification spécifique comme lue.
   * Décrémente le compteur unread dans les préférences.
   */
  async markAsRead(
    id:        string,
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<void> {
    const updated = await this.notifRepo.markAsRead(id, actorType, actorId);

    if (updated) {
      const newCount = await this.prefService.decrementUnread(actorType, actorId);
      // Sync temps réel du badge
      await this.broadcast.emitUnreadCount(actorType, actorId, newCount);
    }
  }

  /**
   * Marque toutes les notifications comme lues.
   * Remet le compteur à 0 et met à jour lastSeenAt.
   */
  async markAllAsRead(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<{ updated: number }> {
    const updated = await this.notifRepo.markAllAsRead(actorType, actorId);
    await this.prefService.resetUnread(actorType, actorId);
    // Sync temps réel du badge → 0
    await this.broadcast.emitUnreadCount(actorType, actorId, 0);
    return { updated };
  }

  // ═════════════════════════════════════════════════════════
  // SUPPRIMER
  // ═════════════════════════════════════════════════════════

  /**
   * Supprime une notification.
   * Les DeliveryLogs sont supprimés par CASCADE.
   */
  async deleteOne(
    id:        string,
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<void> {
    const deleted = await this.notifRepo.deleteOne(id, actorType, actorId);
    if (!deleted) {
      throw new NotFoundException(`Notification ${id} introuvable`);
    }
  }

  // ═════════════════════════════════════════════════════════
  // PRÉFÉRENCES
  // ═════════════════════════════════════════════════════════

  async getPreferences(actorType: NotificationActorType, actorId: string) {
    return this.prefService.getOrCreate(actorType, actorId);
  }

  async updatePreferences(
    actorType: NotificationActorType,
    actorId:   string,
    dto:       UpdatePreferencesDto,
  ) {
    return this.prefService.update(actorType, actorId, dto);
  }

  async registerPushToken(
    actorType: NotificationActorType,
    actorId:   string,
    dto:       RegisterPushTokenDto,
  ): Promise<void> {
    return this.prefService.registerToken(actorType, actorId, dto);
  }

  // ═════════════════════════════════════════════════════════
  // HELPERS PRIVÉS
  // ═════════════════════════════════════════════════════════

  /**
   * Détermine les canaux externes à utiliser pour cette notification.
   *
   * Si forceChannel est défini → un seul canal, bypass préférences.
   * Sinon → filtre selon les préférences effectives de l'acteur.
   */
  private resolveExternalChannels(
    pref:          NotificationPreference,
    notif:         Notification,
    forceChannel?: NotificationChannel,
  ): NotificationChannel[] {
    if (forceChannel && forceChannel !== NotificationChannel.IN_APP) {
      return [forceChannel];
    }

    const channels: NotificationChannel[] = [];
    const effective = this.prefService.getEffectiveChannelPref(pref, notif.type);

    if (effective.push  && pref.globalPushEnabled  && pref.pushTokens?.length) {
      channels.push(NotificationChannel.PUSH);
    }
    if (effective.email && pref.globalEmailEnabled && pref.notificationEmail) {
      channels.push(NotificationChannel.EMAIL);
    }
    if (effective.sms   && pref.globalSmsEnabled   && pref.notificationPhone) {
      channels.push(NotificationChannel.SMS);
    }

    return channels;
  }

  /**
   * Construit le body d'une notification agrégée.
   *
   * Ex: count=2 → "Fatoumata et 1 autre ont liké votre produit ❤️"
   * Ex: count=5 → "Fatoumata et 4 autres ont liké votre produit ❤️"
   *
   * Pour l'instant, on préfixe le body avec un compteur.
   * Phase 2 : template nommé par type (ex: "{name} et {n} autres…").
   */
  private buildAggregatedBody(originalBody: string, count: number): string {
    if (count <= 1) return originalBody;
    const others = count - 1;
    const suffix = others === 1 ? 'autre' : 'autres';
    // Extrait le premier mot (nom de l'acteur) si disponible
    const firstWord = originalBody.split(' ')[0];
    return `${firstWord} et ${others} ${suffix} — ${originalBody}`;
  }
}
