/* ============================================================
 * FICHIER : src/modules/notifications/repositories/notification.repository.ts
 *
 * RÔLE : Couche d'accès aux données pour les notifications.
 *
 * POURQUOI UNE COUCHE REPOSITORY ?
 *   → Isole toute la logique SQL/TypeORM hors des services.
 *   → NotificationService reste lisible (logique métier seulement).
 *   → Testable indépendamment (mock du repository en tests unitaires).
 *   → Centralise les requêtes optimisées (index hints, pagination…).
 *
 * MÉTHODES :
 *   findPaginated()     → liste paginée cursor-based
 *   findUnreadCount()   → total non lues (utilise l'index IDX_notif_recipient)
 *   findByGroupKey()    → agrégation (notification similaire existante)
 *   markAsRead()        → mise à jour isRead
 *   markAllAsRead()     → bulk update
 *   softDelete()        → suppression logique (isRead=true, expiresAt=now)
 *   findExpired()       → pour le CRON de nettoyage
 *   deleteExpired()     → nettoyage effectif
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository, LessThanOrEqual, MoreThan,
} from 'typeorm';
import {
  Notification,
  NotificationActorType,
  NotificationType,
} from 'src/database/entities/notification/notification.entitiy';
import type { INotificationListResult, INotificationDto } from '../interfaces/notification.interfaces';

// ─── Paramètres de recherche ──────────────────────────────────

export interface FindNotificationsParams {
  recipientType: NotificationActorType;
  recipientId:   string;
  limit:         number;
  cursor?:       string;        // ISO 8601 (createdAt du dernier élément)
  unreadOnly?:   boolean;
  type?:         NotificationType;
  search?:       string;
}

// ─────────────────────────────────────────────────────────────
// REPOSITORY
// ─────────────────────────────────────────────────────────────

@Injectable()
export class NotificationRepository {

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  // ─────────────────────────────────────────────────────────
  // LECTURE
  // ─────────────────────────────────────────────────────────

  /**
   * Retourne la liste paginée des notifications d'un acteur.
   *
   * Pagination cursor-based (par createdAt DESC) :
   *   → stable même si des notifications arrivent pendant la navigation
   *   → utilise l'index IDX_notif_recipient_dt
   *
   * @returns INotificationListResult avec total, unread, nextCursor
   */
  async findPaginated(
    params: FindNotificationsParams,
  ): Promise<INotificationListResult> {
    const { recipientType, recipientId, limit, cursor, unreadOnly, type, search } = params;

    const qb = this.repo.createQueryBuilder('n')
      .where('n.recipientType = :recipientType', { recipientType })
      .andWhere('n.recipientId = :recipientId',   { recipientId })
      // Exclure les notifications expirées
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > :now)', { now: new Date() })
      .orderBy('n.createdAt', 'DESC')
      .take(limit + 1);   // +1 pour détecter hasMore

    if (cursor) {
      qb.andWhere('n.createdAt < :cursor', { cursor: new Date(cursor) });
    }

    if (unreadOnly) {
      qb.andWhere('n.isRead = false');
    }

    if (type) {
      qb.andWhere('n.type = :type', { type });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(n.title) LIKE :search OR LOWER(n.body) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    // Count séparé avec les mêmes filtres que la query principale (y compris expiresAt)
    const countQb = this.repo.createQueryBuilder('n')
      .where('n.recipientType = :recipientType', { recipientType })
      .andWhere('n.recipientId = :recipientId', { recipientId })
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > :now)', { now: new Date() });

    if (unreadOnly) countQb.andWhere('n.isRead = false');
    if (type)       countQb.andWhere('n.type = :type', { type });
    if (search) {
      countQb.andWhere(
        '(LOWER(n.title) LIKE :search OR LOWER(n.body) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [rows, total] = await Promise.all([qb.getMany(), countQb.getCount()]);

    const hasMore   = rows.length > limit;
    const data      = rows.slice(0, limit);
    const lastItem  = data[data.length - 1];
    const nextCursor = hasMore && lastItem
      ? lastItem.createdAt.toISOString()
      : null;

    // Compteur non lues (utilise IDX_notif_recipient)
    const unread = await this.countUnread(recipientType, recipientId);

    return {
      data:    data.map(n => this.toDto(n)),
      total,
      unread,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Compte les notifications non lues d'un acteur.
   * Utilise l'index IDX_notif_recipient → ultra rapide.
   */
  async countUnread(
    recipientType: NotificationActorType,
    recipientId:   string,
  ): Promise<number> {
    return this.repo
      .createQueryBuilder('n')
      .where('n.recipientType = :recipientType', { recipientType })
      .andWhere('n.recipientId = :recipientId', { recipientId })
      .andWhere('n.isRead = false')
      .andWhere('(n.expiresAt IS NULL OR n.expiresAt > :now)', { now: new Date() })
      .getCount();
  }

  /**
   * Cherche une notification non-lue existante avec le même groupKey.
   *
   * Utilisé par NotificationService.create() pour décider s'il
   * faut créer une nouvelle notification ou agréger dans l'existante.
   *
   * Fenêtre temporelle : 24h (passé ce délai, on recrée).
   */
  async findByGroupKey(
    recipientType: NotificationActorType,
    recipientId:   string,
    groupKey:      string,
  ): Promise<Notification | null> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // -24h

    return this.repo.findOne({
      where: {
        recipientType,
        recipientId,
        groupKey,
        isRead: false,
        createdAt: MoreThan(since),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Récupère une notification par son ID avec vérification
   * que l'acteur en est bien le destinataire (sécurité).
   */
  async findByIdAndRecipient(
    id:            string,
    recipientType: NotificationActorType,
    recipientId:   string,
  ): Promise<Notification | null> {
    return this.repo.findOne({
      where: { id, recipientType, recipientId },
    });
  }

  /**
   * Retourne les notifications expirées à nettoyer.
   * Utilisé par NotificationScheduler.
   */
  async findExpired(batchSize = 500): Promise<Notification[]> {
    return this.repo.find({
      where: {
        expiresAt: LessThanOrEqual(new Date()),
      },
      take: batchSize,
      select: ['id'],
    });
  }

  // ─────────────────────────────────────────────────────────
  // ÉCRITURE
  // ─────────────────────────────────────────────────────────

  /**
   * Persiste une nouvelle notification ou agrège dans l'existante.
   *
   * Appel INTERNE uniquement — via NotificationService.create().
   */
  async save(notification: Partial<Notification>): Promise<Notification> {
    const entity = this.repo.create(notification);
    return this.repo.save(entity);
  }

  /**
   * Agrège une notification existante : incrémente count + body.
   */
  async aggregate(
    id:      string,
    newBody: string,
  ): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({
        count:     () => '"count" + 1',
        body:      newBody,
        updatedAt: new Date(),
      })
      .where('id = :id', { id })
      .execute();
  }

  /**
   * Marque une notification comme lue.
   *
   * @returns true si la mise à jour a affecté une ligne
   */
  async markAsRead(
    id:            string,
    recipientType: NotificationActorType,
    recipientId:   string,
  ): Promise<boolean> {
    const result = await this.repo.update(
      { id, recipientType, recipientId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Marque toutes les notifications d'un acteur comme lues.
   *
   * @returns Nombre de notifications mises à jour
   */
  async markAllAsRead(
    recipientType: NotificationActorType,
    recipientId:   string,
  ): Promise<number> {
    const result = await this.repo.update(
      { recipientType, recipientId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /**
   * Supprime une notification (hard delete).
   *
   * La notification est supprimée physiquement.
   * Les NotificationDeliveryLog sont supprimés par CASCADE.
   *
   * @returns true si supprimée
   */
  async deleteOne(
    id:            string,
    recipientType: NotificationActorType,
    recipientId:   string,
  ): Promise<boolean> {
    const result = await this.repo.delete({ id, recipientType, recipientId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Supprime toutes les notifications expirées.
   *
   * @returns Nombre de notifications supprimées
   */
  async deleteExpired(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('expiresAt IS NOT NULL AND expiresAt <= :now', { now: new Date() })
      .execute();
    return result.affected ?? 0;
  }

  /**
   * Supprime les notifications lues plus anciennes que `daysOld` jours.
   *
   * CRON hebdomadaire (NotificationScheduler.purgeReadNotifications).
   * Cible : isRead=true AND readAt < (NOW - daysOld jours).
   *
   * Les DeliveryLogs sont supprimés par CASCADE.
   *
   * @param daysOld — Âge minimum en jours (défaut : 30)
   * @returns Nombre de notifications supprimées
   */
  async deleteOldRead(daysOld = 30): Promise<number> {
    const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1_000);
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('"isRead" = :isRead AND "readAt" < :threshold', { isRead: true, threshold })
      .execute();
    return result.affected ?? 0;
  }

  // ─────────────────────────────────────────────────────────
  // MAPPING ENTITÉ → DTO
  // ─────────────────────────────────────────────────────────

  /**
   * Convertit une entité Notification en INotificationDto public.
   * N'expose jamais les champs internes (actorType, channel, isSent…).
   */
  toDto(n: Notification): INotificationDto {
    return {
      id:           n.id,
      type:         n.type,
      priority:     n.priority,
      title:        n.title,
      body:         n.body,
      imageUrl:     n.imageUrl,
      actionUrl:    n.actionUrl,
      payload:      n.payload,
      resourceType: n.resourceType,
      resourceId:   n.resourceId,
      isRead:       n.isRead,
      readAt:       n.readAt?.toISOString() ?? null,
      count:        n.count,
      createdAt:    n.createdAt.toISOString(),
      actor:        null, // enrichi par NotificationService si besoin
    };
  }
}
