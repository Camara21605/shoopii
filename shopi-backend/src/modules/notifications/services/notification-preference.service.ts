/* ============================================================
 * FICHIER : src/modules/notifications/services/notification-preference.service.ts
 *
 * RÔLE : Gestion des préférences de notification.
 *
 * RESPONSABILITÉS :
 *   1. getOrCreate()    → lire les préférences (crée si absentes)
 *   2. update()         → merge partiel PATCH /preferences
 *   3. registerToken()  → ajouter/mettre à jour un token push
 *   4. removeToken()    → supprimer un token (déconnexion appareil)
 *   5. incrementUnread()→ incrémente le compteur non lu
 *   6. resetUnread()    → remet à 0 (markAllAsRead)
 *
 * PRINCIPE DU MERGE PARTIEL :
 *   Seuls les champs envoyés dans UpdatePreferencesDto sont modifiés.
 *   Les préférences JSON existantes sont mergées profondément :
 *   { "order.confirmed": { push: false } } ne modifie que push,
 *   les autres canaux (in_app, email, sms) restent inchangés.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import {
  NotificationPreference,
  NotificationChannelPreference,
  PushToken,
} from 'src/database/entities/notification/notification-preference.entity';
import { NotificationActorType, NotificationType }
  from 'src/database/entities/notification/notification.entitiy';
import type { UpdatePreferencesDto }    from '../dto/update-preferences.dto';
import type { RegisterPushTokenDto }    from '../dto/register-push-token.dto';

// ─── Valeurs par défaut par type de notification ─────────────

/**
 * Préférences par défaut pour chaque type de notification.
 *
 * Appliquées quand une clé est absente du JSON preferences.
 * Conçues pour être sensibles et non intrusives par défaut :
 *   - in_app TOUJOURS activé
 *   - push   activé pour les événements importants
 *   - email  uniquement pour les événements critiques
 *   - sms    uniquement pour les URGENT (opt-in explicite)
 */
const DEFAULT_CHANNEL_PREFERENCES: Record<
  NotificationType,
  NotificationChannelPreference
> = {
  // Commandes
  [NotificationType.ORDER_PLACED]:          { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.ORDER_CONFIRMED]:       { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.ORDER_CANCELLED]:       { in_app: true, push: true,  email: true,  sms: true  },
  [NotificationType.ORDER_REFUNDED]:        { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.ORDER_STATUS_CHANGED]:  { in_app: true, push: true,  email: false, sms: false },
  // Livraisons
  [NotificationType.DELIVERY_ASSIGNED]:     { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.DELIVERY_PICKED_UP]:    { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.DELIVERY_EN_ROUTE]:     { in_app: true, push: true,  email: false, sms: true  },
  [NotificationType.DELIVERY_ARRIVED]:      { in_app: true, push: true,  email: false, sms: true  },
  [NotificationType.DELIVERY_COMPLETED]:    { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.DELIVERY_FAILED]:       { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.DELIVERY_RETURNED]:     { in_app: true, push: true,  email: false, sms: false },
  // Messagerie
  [NotificationType.MESSAGE_RECEIVED]:      { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.MESSAGE_UNREAD]:        { in_app: true, push: false, email: true,  sms: false },
  [NotificationType.CONVERSATION_OPENED]:   { in_app: true, push: true,  email: false, sms: false },
  // Follow
  [NotificationType.FOLLOW_NEW]:            { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.FOLLOW_ACCEPTED]:       { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.FOLLOW_MUTUAL]:         { in_app: true, push: false, email: false, sms: false },
  // Produits
  [NotificationType.PRODUCT_LIKED]:         { in_app: true, push: false, email: false, sms: false },
  [NotificationType.PRODUCT_LIKED_AGG]:     { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.PRODUCT_OUT_OF_STOCK]:  { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.PRODUCT_BACK_IN_STOCK]: { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.PRODUCT_PRICE_DROP]:    { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.PRODUCT_APPROVED]:      { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.PRODUCT_REJECTED]:      { in_app: true, push: true,  email: true,  sms: false },
  // Promotions
  [NotificationType.PROMO_ACTIVE]:          { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.PROMO_ENDING_SOON]:     { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.PROMO_ENDED]:           { in_app: true, push: false, email: false, sms: false },
  [NotificationType.PROMO_USED]:            { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.PROMO_LIMIT_REACHED]:   { in_app: true, push: true,  email: false, sms: false },
  // Paiements
  [NotificationType.PAYMENT_RECEIVED]:      { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.PAYMENT_SENT]:          { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.PAYMENT_FAILED]:        { in_app: true, push: true,  email: true,  sms: true  },
  [NotificationType.PAYMENT_REFUND_DONE]:   { in_app: true, push: true,  email: true,  sms: false },
  // Avis
  [NotificationType.REVIEW_RECEIVED]:       { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.REVIEW_REPLIED]:        { in_app: true, push: true,  email: false, sms: false },
  // Stocks
  [NotificationType.STOCK_LOW]:             { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.STOCK_CRITICAL]:        { in_app: true, push: true,  email: true,  sms: true  },
  // Stories
  [NotificationType.STORY_PUBLISHED]:       { in_app: true, push: false, email: false, sms: false },
  [NotificationType.STORY_EXPIRING_SOON]:   { in_app: true, push: true,  email: false, sms: false },
  // Colis
  [NotificationType.COLIS_DEPOSITED]:       { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.COLIS_AWAITING]:        { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.COLIS_URGENT]:          { in_app: true, push: true,  email: true,  sms: true  },
  [NotificationType.COLIS_TRANSFERRED]:     { in_app: true, push: true,  email: false, sms: false },
  [NotificationType.COLIS_RETURN]:          { in_app: true, push: true,  email: false, sms: false },
  // Compte
  [NotificationType.ACCOUNT_APPROVED]:      { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.ACCOUNT_SUSPENDED]:     { in_app: true, push: true,  email: true,  sms: true  },
  [NotificationType.ACCOUNT_BANNED]:        { in_app: true, push: true,  email: true,  sms: true  },
  [NotificationType.ACCOUNT_VERIFIED]:      { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.INVITATION_CODE_USED]:  { in_app: true, push: false, email: false, sms: false },
  // Système
  [NotificationType.SYSTEM_MAINTENANCE]:    { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.SYSTEM_ANNOUNCEMENT]:   { in_app: true, push: false, email: false, sms: false },
  // Support tickets (Phase 6) — notification haute priorité par défaut
  [NotificationType.SUPPORT_TICKET_CREATED]: { in_app: true, push: true,  email: true,  sms: false },
  [NotificationType.SUPPORT_TICKET_REPLY]:   { in_app: true, push: true,  email: true,  sms: false },
};

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

@Injectable()
export class NotificationPreferenceService {

  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repo: Repository<NotificationPreference>,
  ) {}

  // ─────────────────────────────────────────────────────────
  // LECTURE
  // ─────────────────────────────────────────────────────────

  /**
   * Retourne les préférences d'un acteur.
   * Si aucune ligne n'existe → crée avec les valeurs par défaut.
   *
   * Utilisation : NotificationService.create() + Controller GET
   */
  async getOrCreate(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<NotificationPreference> {
    // INSERT … ON CONFLICT DO NOTHING → atomique, élimine le race condition
    // si deux requêtes concurrentes arrivent pour le même acteur.
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(NotificationPreference)
      .values({ actorType, actorId })
      .orIgnore()
      .execute();

    if (result.identifiers.length > 0) {
      this.logger.debug(`Préférences créées pour ${actorType}:${actorId}`);
    }

    return this.repo.findOneOrFail({ where: { actorType, actorId } });
  }

  /**
   * Retourne les préférences effectives pour un type de notification.
   * Merge les valeurs du JSON preferences avec les défauts.
   */
  getEffectiveChannelPref(
    pref: NotificationPreference,
    type: NotificationType,
  ): NotificationChannelPreference {
    const defaults = DEFAULT_CHANNEL_PREFERENCES[type] ?? {
      in_app: true, push: true, email: false, sms: false,
    };

    const override = pref.preferences?.[type];
    if (!override) return defaults;

    return {
      in_app: override.in_app ?? defaults.in_app,
      push:   override.push   ?? defaults.push,
      email:  override.email  ?? defaults.email,
      sms:    override.sms    ?? defaults.sms,
    };
  }

  // ─────────────────────────────────────────────────────────
  // MISE À JOUR
  // ─────────────────────────────────────────────────────────

  /**
   * Met à jour les préférences avec un merge partiel.
   * Seuls les champs envoyés dans dto sont modifiés.
   */
  async update(
    actorType: NotificationActorType,
    actorId:   string,
    dto:       UpdatePreferencesDto,
  ): Promise<NotificationPreference> {
    const pref = await this.getOrCreate(actorType, actorId);

    // Switches globaux
    if (dto.globalPushEnabled  !== undefined) pref.globalPushEnabled  = dto.globalPushEnabled;
    if (dto.globalEmailEnabled !== undefined) pref.globalEmailEnabled = dto.globalEmailEnabled;
    if (dto.globalSmsEnabled   !== undefined) pref.globalSmsEnabled   = dto.globalSmsEnabled;

    // Mode DND
    if (dto.dndEnabled   !== undefined) pref.dndEnabled   = dto.dndEnabled;
    if (dto.dndStartTime !== undefined) pref.dndStartTime = dto.dndStartTime;
    if (dto.dndEndTime   !== undefined) pref.dndEndTime   = dto.dndEndTime;
    if (dto.timezone     !== undefined) pref.timezone      = dto.timezone;

    // Merge profond des préférences par type
    if (dto.preferences) {
      const existing = pref.preferences ?? {};
      for (const [type, newPref] of Object.entries(dto.preferences)) {
        existing[type] = { ...existing[type], ...newPref };
      }
      pref.preferences = existing;
    }

    // Coordonnées alternatives
    if (dto.notificationEmail !== undefined) pref.notificationEmail = dto.notificationEmail;
    if (dto.notificationPhone !== undefined) pref.notificationPhone = dto.notificationPhone;

    return this.repo.save(pref);
  }

  // ─────────────────────────────────────────────────────────
  // TOKENS PUSH
  // ─────────────────────────────────────────────────────────

  /**
   * Enregistre ou met à jour un token push mobile.
   *
   * Si deviceId existe → remplace le token pour cet appareil.
   * Sinon → ajoute un nouveau token.
   *
   * Limite : max 10 tokens par acteur (un acteur ne peut pas
   * avoir plus de 10 appareils enregistrés simultanément).
   */
  async registerToken(
    actorType: NotificationActorType,
    actorId:   string,
    dto:       RegisterPushTokenDto,
  ): Promise<void> {
    const pref   = await this.getOrCreate(actorType, actorId);
    const tokens = pref.pushTokens ?? [];
    const now    = new Date().toISOString();

    const newToken: PushToken = {
      token:    dto.token,
      platform: dto.platform as any,
      deviceId: dto.deviceId,
      updatedAt: now,
    };

    let updated = false;

    if (dto.deviceId) {
      const idx = tokens.findIndex(t => t.deviceId === dto.deviceId);
      if (idx !== -1) {
        tokens[idx] = newToken;
        updated = true;
      }
    }

    if (!updated) {
      // Éviter les doublons par token exact
      const tokenIdx = tokens.findIndex(t => t.token === dto.token);
      if (tokenIdx !== -1) {
        tokens[tokenIdx] = newToken;
      } else {
        tokens.push(newToken);
        // Garder max 10 tokens (supprimer les plus anciens)
        if (tokens.length > 10) {
          tokens.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          );
          tokens.splice(10);
        }
      }
    }

    pref.pushTokens = tokens;
    await this.repo.save(pref);
  }

  // ─────────────────────────────────────────────────────────
  // COMPTEUR NON LU
  // ─────────────────────────────────────────────────────────

  /**
   * Incrémente le compteur non lu.
   * Appelé par NotificationService.create() après insertion.
   * Utilise une query SQL pour éviter le race condition.
   */
  async incrementUnread(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(NotificationPreference)
      .set({ unreadCount: () => '"unreadCount" + 1' })
      .where('"actorType" = :actorType AND "actorId" = :actorId', { actorType, actorId })
      .returning('"unreadCount"')
      .execute();

    return (result.raw[0]?.unreadCount as number) ?? 0;
  }

  /**
   * Remet le compteur à 0 et met à jour lastSeenAt.
   * Appelé par NotificationService.markAllAsRead().
   */
  async resetUnread(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<void> {
    await this.repo.update(
      { actorType, actorId },
      { unreadCount: 0, lastSeenAt: new Date() },
    );
  }

  /**
   * Décrémente le compteur de 1 (ne passe pas sous 0).
   * Appelé par NotificationService.markAsRead().
   */
  async decrementUnread(
    actorType: NotificationActorType,
    actorId:   string,
  ): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(NotificationPreference)
      .set({ unreadCount: () => 'GREATEST("unreadCount" - 1, 0)' })
      .where('"actorType" = :actorType AND "actorId" = :actorId', { actorType, actorId })
      .returning('"unreadCount"')
      .execute();

    return (result.raw[0]?.unreadCount as number) ?? 0;
  }
}
