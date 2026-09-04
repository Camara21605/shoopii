/* ============================================================
 * FICHIER : src/modules/notifications/events/notification-event.service.ts
 *
 * RÔLE : Façade métier du système de notifications.
 *
 * RESPONSABILITÉ :
 *   Traduit les événements métier (follow, message, commande…)
 *   en appels à NotificationService.create() avec les bons
 *   champs (recipientType, recipientId, actorId, type…).
 *
 * RÈGLE CRITIQUE :
 *   recipientId et actorId sont TOUJOURS des profileId
 *   (Client.id, Company.id, etc.) — jamais des userId.
 *
 * UTILISATION :
 *   Injecter dans les processors, services métier, etc.
 *   NotificationsModule doit être importé dans le module cible.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  NotificationActorType,
  NotificationType,
  NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';
import { NotificationService } from '../services/notification.service';

// ─── Interfaces des paramètres ────────────────────────────────

export interface IFollowParams {
  /** profileId de la cible (qui est suivi) */
  targetType:   string;
  targetId:     string;
  /** profileId du follower (qui s'abonne) */
  followerType: string;
  followerId:   string;
  followerName: string;
  /** UUID de la ligne Follow créée */
  followId:     string;
}

export interface IMessageNotificationParams {
  /** profileId + type du destinataire */
  recipientType:  string;
  recipientId:    string;
  /** profileId + type de l'expéditeur */
  actorType:      string;
  actorId:        string;
  senderName:     string;
  preview:        string;
  conversationId: string;
}

export interface IGroupCallMissedParams {
  /** profileId + type du membre n'ayant ni rejoint ni décliné (partie 9) */
  recipientType:  string;
  recipientId:    string;
  groupId:        string;
  /** Nom affichable du groupe/de la conversation — jamais de SDP/ICE/donnée d'appel technique. */
  groupName:      string;
  initiatorName:  string;
  callType:       'audio' | 'video';
}

export interface IOrderPlacedParams {
  /** profileId de l'entreprise destinataire */
  companyId:   string;
  /** profileId du client acteur */
  clientId:    string;
  clientName:  string;
  orderRef:    string;
  commandeId:  string;
  totalAmount: number;
  /* Acteurs optionnels — présents uniquement si sélectionnés à la commande */
  livreurId?:        string;
  livreurName?:      string;
  correspondantId?:  string;
  correspondantName?: string;
}

export interface IOrderStatusParams {
  recipientType: NotificationActorType;
  recipientId:   string;
  actorType:     NotificationActorType | null;
  actorId:       string | null;
  orderRef:      string;
  commandeId:    string;
  newStatus:     string;
  title:         string;
  body:          string;
}

export interface IAccountStatusParams {
  recipientType: NotificationActorType;
  /** profileId du destinataire (Client.id, Delivery.id, etc.) */
  recipientId:   string;
  type:          NotificationType;
  title:         string;
  body:          string;
}

export interface IPromoEventParams {
  /** Company.id (profileId) propriétaire de la promotion */
  companyId: string;
  promoId:   string;
  promoCode: string;
  type:      NotificationType;
  title:     string;
  body:      string;
}

// ─────────────────────────────────────────────────────────────

@Injectable()
export class NotificationEventService {

  private readonly logger = new Logger(NotificationEventService.name);

  constructor(
    private readonly notifService: NotificationService,
    private readonly dataSource:   DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────
  // HELPER — destination "profil / compte" par rôle
  // ─────────────────────────────────────────────────────────

  /**
   * BUG CORRIGÉ — plusieurs actionUrl ci-dessous pointaient vers '/profil'
   * ou '/dashboard' (sans segment de rôle) : aucune des deux routes
   * n'existe côté frontend (voir router.tsx — seuls /mon-profil et
   * /dashboard/{role}/* sont enregistrées), donc le clic tombait
   * systématiquement sur la route catch-all plutôt que sur le compte de
   * l'acteur concerné. Centralisé ici plutôt que dupliqué à chaque appelant.
   */
  private resolveOwnAccountUrl(actorType: NotificationActorType): string {
    switch (actorType) {
      case NotificationActorType.CLIENT:        return '/mon-profil';
      case NotificationActorType.COMPANY:       return '/dashboard/entreprise/profil';
      case NotificationActorType.DELIVERY:      return '/dashboard/livreur/profil';
      case NotificationActorType.CORRESPONDENT: return '/dashboard/correspondant/parametres';
      case NotificationActorType.PARTNER:       return '/dashboard/partenaire/parametres';
      default:                                  return '/home';
    }
  }

  /**
   * BUG CORRIGÉ — notifyNewFollower construisait `/profil/${type}/${id}`,
   * une route qui n'a jamais existé côté frontend (aucune route
   * générique /profil/:type/:id — voir router.tsx : seules /livreurs/:id,
   * /correspondants/:id et /boutique/:id exposent un profil public).
   */
  private resolveFollowerProfileUrl(followerType: string, followerId: string): string {
    switch (followerType) {
      case NotificationActorType.COMPANY:       return `/boutique/${followerId}`;
      case NotificationActorType.DELIVERY:      return `/livreurs/${followerId}`;
      case NotificationActorType.CORRESPONDENT: return `/correspondants/${followerId}`;
      default:                                  return '/home';
    }
  }

  // ─────────────────────────────────────────────────────────
  // HELPER — photo de l'acteur déclencheur
  // ─────────────────────────────────────────────────────────

  /**
   * Résout l'URL de la photo de profil de l'acteur (profileId).
   * Retourne null si l'acteur n'a pas de photo ou en cas d'erreur.
   */
  private async resolveActorPhoto(
    actorType: NotificationActorType | string | null,
    actorId:   string | null,
  ): Promise<string | null> {
    if (!actorType || !actorId) return null;
    try {
      switch (actorType) {
        case NotificationActorType.CLIENT: {
          const rows = await this.dataSource.query(
            `SELECT u."profilePicture" FROM users u
             JOIN clients c ON c."userId" = u.id
             WHERE c.id = $1 LIMIT 1`,
            [actorId],
          );
          return rows?.[0]?.profilePicture ?? null;
        }
        case NotificationActorType.COMPANY: {
          const rows = await this.dataSource.query(
            `SELECT logo FROM entreprises WHERE id = $1 LIMIT 1`,
            [actorId],
          );
          return rows?.[0]?.logo ?? null;
        }
        case NotificationActorType.DELIVERY: {
          const rows = await this.dataSource.query(
            `SELECT "photoUrl" FROM livreurs WHERE id = $1 LIMIT 1`,
            [actorId],
          );
          return rows?.[0]?.photoUrl ?? null;
        }
        case NotificationActorType.CORRESPONDENT: {
          const rows = await this.dataSource.query(
            `SELECT u."profilePicture" FROM users u
             JOIN correspondants c ON c."userId" = u.id
             WHERE c.id = $1 LIMIT 1`,
            [actorId],
          );
          return rows?.[0]?.profilePicture ?? null;
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────
  // FOLLOW
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie la cible qu'un nouvel acteur s'est abonné à son profil.
   *
   * Agrégé via groupKey : si plusieurs follows arrivent dans la
   * même fenêtre de 24h, une seule notif est créée avec count++.
   */
  async notifyNewFollower(params: IFollowParams): Promise<void> {
    try {
      const imageUrl = await this.resolveActorPhoto(
        params.followerType as NotificationActorType, params.followerId,
      );
      await this.notifService.create({
        recipientType: params.targetType   as NotificationActorType,
        recipientId:   params.targetId,
        actorType:     params.followerType as NotificationActorType,
        actorId:       params.followerId,
        type:          NotificationType.FOLLOW_NEW,
        priority:      NotificationPriority.NORMAL,
        title:         'Nouvel abonné',
        body:          `${params.followerName} s'est abonné à votre profil`,
        imageUrl,
        actionUrl:     this.resolveFollowerProfileUrl(params.followerType, params.followerId),
        groupKey:      `follow.new:${params.targetType}:${params.targetId}`,
        resourceType:  'follow',
        resourceId:    params.followId,
      });
    } catch (err) {
      this.logger.error('notifyNewFollower failed', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // MESSAGERIE
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie le destinataire d'un message qu'il a reçu un nouveau message.
   *
   * Agrégé par conversation : si plusieurs messages arrivent rapidement
   * dans la même conversation, count++ sans spam.
   *
   * Ne pas appeler pour les messages de type CALL.
   */
  async notifyMessageReceived(params: IMessageNotificationParams): Promise<void> {
    try {
      const imageUrl = await this.resolveActorPhoto(
        params.actorType as NotificationActorType, params.actorId,
      );
      await this.notifService.create({
        recipientType: params.recipientType as NotificationActorType,
        recipientId:   params.recipientId,
        actorType:     params.actorType     as NotificationActorType,
        actorId:       params.actorId,
        type:          NotificationType.MESSAGE_RECEIVED,
        priority:      NotificationPriority.NORMAL,
        title:         'Nouveau message',
        body:          `${params.senderName} : ${params.preview.slice(0, 80)}`,
        imageUrl,
        /* BUG CORRIGÉ — '/chat/:id' n'a jamais existé côté frontend (seule
         * route de messagerie enregistrée : /messagerie, sans segment
         * dynamique). ?conv= est lu par MessageriePage pour sélectionner
         * automatiquement LA conversation au chargement (voir
         * MessagerieCore.tsx, prop initialConversationId). */
        actionUrl:     `/messagerie?conv=${params.conversationId}`,
        groupKey:      `message.received:conversation:${params.conversationId}`,
        resourceType:  'conversation',
        resourceId:    params.conversationId,
        payload: {
          conversationId: params.conversationId,
          senderName:     params.senderName,
          preview:        params.preview.slice(0, 100),
        },
      });
    } catch (err) {
      this.logger.error('notifyMessageReceived failed', err);
    }
  }

  /**
   * Notifie un membre de groupe qu'il a manqué un appel — celui-ci N'A
   * NI rejoint NI décliné avant la fin de l'appel (voir GroupCallGateway.
   * saveCallMessage, seule source de vérité sur qui a "raté" l'appel).
   *
   * Ne contient QUE des informations d'affichage (nom du groupe, nom de
   * l'initiateur, type audio/vidéo) — jamais de SDP/ICE/identifiant TURN/
   * JWT/donnée technique de signalisation (partie 9, confidentialité).
   */
  async notifyGroupCallMissed(params: IGroupCallMissedParams): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType as NotificationActorType,
        recipientId:   params.recipientId,
        actorType:     null,
        actorId:       null,
        type:          NotificationType.GROUP_CALL_MISSED,
        priority:      NotificationPriority.NORMAL,
        title:         'Appel de groupe manqué',
        body:          `${params.initiatorName} a lancé un appel ${params.callType === 'video' ? 'vidéo' : 'audio'} dans ${params.groupName}`,
        // Pas de route dédiée /livraisons/groupe/:id côté frontend (router.tsx
        // n'expose qu'une seule route statique /messagerie, sans segment
        // dynamique — sélection de conversation/groupe gérée côté client).
        // Même destination que les notifications call.* existantes.
        actionUrl:     '/messagerie',
        groupKey:      `group_call.missed:group:${params.groupId}`,
        resourceType:  'delivery_group',
        resourceId:    params.groupId,
      });
    } catch (err) {
      this.logger.error('notifyGroupCallMissed failed', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // COMMANDES
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie l'entreprise qu'une nouvelle commande a été passée.
   *
   * recipientId = Company.id (profileId)
   * actorId     = Client.id  (profileId)
   */
  async notifyOrderPlaced(params: IOrderPlacedParams): Promise<void> {
    const suiviUrl = `/commande/${params.commandeId}/suivi`;

    try {
      /* Résoudre les photos des acteurs impliqués */
      const [clientPhoto, companyLogo] = await Promise.all([
        this.resolveActorPhoto(NotificationActorType.CLIENT,  params.clientId),
        this.resolveActorPhoto(NotificationActorType.COMPANY, params.companyId),
      ]);

      /* ── Notification entreprise : nouvelle commande reçue ── */
      await this.notifService.create({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   params.companyId,
        actorType:     NotificationActorType.CLIENT,
        actorId:       params.clientId,
        type:          NotificationType.ORDER_PLACED,
        priority:      NotificationPriority.HIGH,
        title:         'Nouvelle commande reçue 💰',
        body:          `${params.clientName} a passé une commande · ${params.orderRef}`,
        imageUrl:      clientPhoto,
        actionUrl:     suiviUrl,
        resourceType:  'order',
        resourceId:    params.commandeId,
        payload: {
          commandeId:  params.commandeId,
          orderRef:    params.orderRef,
          clientName:  params.clientName,
          totalAmount: params.totalAmount,
        },
      });

      /* ── Notification client : confirmation de la commande passée ── */
      await this.notifService.create({
        recipientType: NotificationActorType.CLIENT,
        recipientId:   params.clientId,
        actorType:     NotificationActorType.COMPANY,
        actorId:       params.companyId,
        type:          NotificationType.ORDER_PLACED,
        priority:      NotificationPriority.HIGH,
        title:         'Commande confirmée ✅',
        body:          `Votre commande ${params.orderRef} a bien été enregistrée.`,
        imageUrl:      companyLogo,
        actionUrl:     suiviUrl,
        resourceType:  'order',
        resourceId:    params.commandeId,
        payload: {
          commandeId:  params.commandeId,
          orderRef:    params.orderRef,
          totalAmount: params.totalAmount,
        },
      });

      /* ── Notification livreur (si sélectionné à la commande) ── */
      if (params.livreurId) {
        await this.notifService.create({
          recipientType: NotificationActorType.DELIVERY,
          recipientId:   params.livreurId,
          actorType:     NotificationActorType.CLIENT,
          actorId:       params.clientId,
          type:          NotificationType.ORDER_PLACED,
          priority:      NotificationPriority.HIGH,
          title:         'Nouvelle mission de livraison 🛵',
          body:          `Commande ${params.orderRef} à livrer pour ${params.clientName}`,
          imageUrl:      clientPhoto,
          actionUrl:     suiviUrl,
          resourceType:  'order',
          resourceId:    params.commandeId,
          payload: {
            commandeId:  params.commandeId,
            orderRef:    params.orderRef,
            clientName:  params.clientName,
          },
        });
      }

      /* ── Notification correspondant (si sélectionné à la commande) ── */
      if (params.correspondantId) {
        await this.notifService.create({
          recipientType: NotificationActorType.CORRESPONDENT,
          recipientId:   params.correspondantId,
          actorType:     NotificationActorType.CLIENT,
          actorId:       params.clientId,
          type:          NotificationType.ORDER_PLACED,
          priority:      NotificationPriority.HIGH,
          title:         'Nouvelle commande à traiter 📦',
          body:          `Commande ${params.orderRef} implique votre point de retrait`,
          imageUrl:      clientPhoto,
          actionUrl:     suiviUrl,
          resourceType:  'order',
          resourceId:    params.commandeId,
          payload: {
            commandeId:  params.commandeId,
            orderRef:    params.orderRef,
            clientName:  params.clientName,
          },
        });
      }
    } catch (err) {
      this.logger.error('notifyOrderPlaced failed', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // COMPTES
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie un acteur d'un changement de statut de son compte.
   *
   * Cas d'usage :
   *   - ACCOUNT_APPROVED  → validation d'un livreur / correspondant
   *   - ACCOUNT_SUSPENDED → suspension par entreprise ou admin
   *   - ACCOUNT_BANNED    → bannissement par super-admin
   *   - ACCOUNT_VERIFIED  → vérification manuelle par admin
   */
  async notifyAccountStatusChanged(params: IAccountStatusParams): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     null,
        actorId:       null,
        type:          params.type,
        priority:      NotificationPriority.HIGH,
        title:         params.title,
        body:          params.body,
        actionUrl:     this.resolveOwnAccountUrl(params.recipientType),
        resourceType:  'account',
        resourceId:    params.recipientId,
      });
    } catch (err) {
      this.logger.error(`notifyAccountStatusChanged (${params.type}) failed`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // ÉQUIPE / COLLABORATEURS
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie qu'un collaborateur a vu ses permissions modifiées par le
   * propriétaire (voir CompanyTeamPermissionService.update()).
   *
   * Adressée à NotificationActorType.COMPANY + recipientId=companyId,
   * PAS au collaborateur individuellement : "mes notifications" se
   * résout aujourd'hui via l'actorId du JWT, qui vaut companyId aussi
   * bien pour le propriétaire QUE pour CHAQUE collaborateur (même
   * entreprise — voir AuthService.findProfileId) — il n'existe pas
   * encore de canal pour adresser un collaborateur individuellement
   * sans passer par son propre userId, absent du modèle recipientId
   * actuel (toujours un profileId, jamais un userId — voir l'en-tête
   * de ce fichier). Reste utile comme fil d'activité partagé, visible
   * par le propriétaire ET toute l'équipe.
   *
   * Type SYSTEM_ANNOUNCEMENT réutilisé volontairement plutôt qu'une
   * nouvelle valeur d'enum dédiée (ex: TEAM_PERMISSION_CHANGED) : le
   * type est un enum Postgres natif, une nouvelle valeur nécessite un
   * ALTER TYPE en production (synchronize() ne suffit qu'en dev) — pas
   * de risque de notification silencieusement perdue si ce déploiement
   * n'a pas encore tourné.
   */
  async notifyTeamPermissionChanged(params: { companyId: string; memberName: string }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   params.companyId,
        actorType:     null,
        actorId:       null,
        type:          NotificationType.SYSTEM_ANNOUNCEMENT,
        priority:      NotificationPriority.NORMAL,
        title:         'Permissions mises à jour',
        body:          `Les permissions de ${params.memberName} ont été modifiées.`,
        actionUrl:     '/dashboard/entreprise/equipe',
        resourceType:  'team_member',
        resourceId:    params.companyId,
      });
    } catch (err) {
      this.logger.error('notifyTeamPermissionChanged failed', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // STOCKS
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie l'entreprise qu'un produit a un stock faible ou nul.
   *
   * Cas d'usage :
   *   - STOCK_LOW      → stock <= seuil d'alerte
   *   - STOCK_CRITICAL → stock = 0 (rupture totale)
   *
   * groupKey = ${type}:${productId} → une notif par produit
   * même si le CRON tourne plusieurs fois dans la journée.
   */
  async notifyStockAlert(params: {
    companyId:   string;
    productId:   string;
    productName: string;
    stock:       number;
    type:        NotificationType;
  }): Promise<void> {
    try {
      const isCritical = params.type === NotificationType.STOCK_CRITICAL;
      await this.notifService.create({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   params.companyId,
        actorType:     null,
        actorId:       null,
        type:          params.type,
        priority:      isCritical ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
        title:         isCritical ? `Rupture de stock ⛔` : `Stock faible ⚠️`,
        body:          isCritical
          ? `"${params.productName}" est en rupture de stock.`
          : `"${params.productName}" — stock restant : ${params.stock} unité(s).`,
        actionUrl:     `/dashboard/entreprise/inventaire`,
        groupKey:      `${params.type}:${params.productId}`,
        resourceType:  'product',
        resourceId:    params.productId,
      });
    } catch (err) {
      this.logger.error(`notifyStockAlert (${params.type}) failed`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PROMOTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie l'entreprise d'un événement sur l'une de ses promotions.
   *
   * Cas d'usage :
   *   - PROMO_ACTIVE       → promotion activée manuellement
   *   - PROMO_ENDED        → promotion terminée manuellement ou auto
   *   - PROMO_ENDING_SOON  → promotion expire dans 24h (CRON)
   *   - PROMO_USED         → un client a utilisé le code promo
   *
   * groupKey = ${type}:${promoId} → agrège les événements identiques
   * sur la même promo (ex: 10 utilisations = 1 notif count++).
   */
  async notifyPromoEvent(params: IPromoEventParams): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   params.companyId,
        actorType:     null,
        actorId:       null,
        type:          params.type,
        priority:      NotificationPriority.NORMAL,
        title:         params.title,
        body:          params.body,
        /* BUG CORRIGÉ — segment /entreprise manquant, route inexistante. */
        actionUrl:     `/dashboard/entreprise/promotions`,
        groupKey:      `${params.type}:${params.promoId}`,
        resourceType:  'promotion',
        resourceId:    params.promoId,
      });
    } catch (err) {
      this.logger.error(`notifyPromoEvent (${params.type}) failed`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // CRM ENTREPRISE
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie un client d'un message CRM envoyé par une entreprise
   * (Newsletter VIP, Offre fidélité, Relance clients inactifs — voir
   * CrmCampaignService, Paramètres > Clients & Abonnés > Actions CRM).
   *
   * Pas de groupKey : chaque envoi de campagne est un message distinct,
   * jamais agrégé avec le précédent (contrairement à notifyPromoEvent).
   *
   * Passe par NotificationService.create() → même pipeline que toute
   * autre notification : insertion + emit Socket.IO IN_APP synchrones,
   * dispatch EMAIL mis en file BullMQ et respectant les préférences
   * propres du client (globalEmailEnabled, DND…) — jamais d'envoi SMTP
   * synchrone dans la requête HTTP (voir notification.queue.ts).
   */
  async notifyCrmMessage(params: {
    clientId:    string;
    companyId:   string;
    companyName: string;
    subject:     string;
    message:     string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: NotificationActorType.CLIENT,
        recipientId:   params.clientId,
        actorType:     NotificationActorType.COMPANY,
        actorId:       params.companyId,
        type:          NotificationType.CRM_MESSAGE,
        priority:      NotificationPriority.NORMAL,
        title:         params.subject,
        body:          params.message,
        actionUrl:     `/boutique/${params.companyId}`,
        resourceType:  'crm_campaign',
        resourceId:    params.companyId,
      });
    } catch (err) {
      this.logger.error(`notifyCrmMessage failed — clientId=${params.clientId}`, err);
      throw err; // laisse CrmCampaignService compter cet envoi comme échoué
    }
  }

  // ─────────────────────────────────────────────────────────
  // AVIS
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie l'entreprise qu'elle a reçu un nouvel avis client.
   *
   * groupKey = review.received:{companyId}
   *   → agrège les avis successifs en un seul badge
   *   (ex: "3 personnes ont laissé un avis")
   */
  async notifyReviewReceived(params: {
    companyId:  string;
    clientId:   string;
    clientNom:  string;
    note:       number;
    commandeId: string;
  }): Promise<void> {
    try {
      const imageUrl = await this.resolveActorPhoto(NotificationActorType.CLIENT, params.clientId);
      await this.notifService.create({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   params.companyId,
        actorType:     NotificationActorType.CLIENT,
        actorId:       params.clientId,
        type:          NotificationType.REVIEW_RECEIVED,
        priority:      NotificationPriority.NORMAL,
        title:         'Nouvel avis reçu ⭐',
        body:          `${params.clientNom} a laissé un avis ${params.note}/5 sur votre boutique.`,
        imageUrl,
        /* BUG CORRIGÉ — segment /entreprise manquant, route inexistante. */
        actionUrl:     '/dashboard/entreprise/avis',
        groupKey:      `review.received:${params.companyId}`,
        resourceType:  'review',
        resourceId:    params.commandeId,
      });
    } catch (err) {
      this.logger.error('notifyReviewReceived failed', err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // PRODUITS CATALOG
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie l'entreprise qu'un client a ajouté un produit à ses favoris.
   *
   * groupKey = product.liked:{productId}
   *   → tous les likes du même produit = 1 notif avec count++
   *   plutôt que des dizaines de notifications individuelles.
   */
  async notifyProductLiked(params: {
    companyId:   string;
    productId:   string;
    productName: string;
    clientId:    string;
  }): Promise<void> {
    try {
      const imageUrl = await this.resolveActorPhoto(NotificationActorType.CLIENT, params.clientId);
      await this.notifService.create({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   params.companyId,
        actorType:     NotificationActorType.CLIENT,
        actorId:       params.clientId,
        type:          NotificationType.PRODUCT_LIKED,
        priority:      NotificationPriority.LOW,
        title:         'Produit ajouté aux favoris ❤️',
        body:          `"${params.productName}" a été ajouté aux favoris.`,
        imageUrl,
        /* Redirige vers la page "Mes Produits" du dashboard entreprise */
        actionUrl:     `/dashboard/entreprise/produits`,
        groupKey:      `product.liked:${params.productId}`,
        resourceType:  'product',
        resourceId:    params.productId,
      });
    } catch (err) {
      this.logger.error('notifyProductLiked failed', err);
    }
  }

  /**
   * Notifie un acteur d'un changement de statut de commande.
   *
   * Cas d'usage :
   *   - ENTREPRISE valide → IN_PROGRESS    → notifier CLIENT  (ORDER_CONFIRMED)
   *   - Tous valident     → AWAITING_CLIENT → notifier CLIENT
   *   - CLIENT valide     → DELIVERED       → notifier COMPANY
   *
   * L'actionUrl est adapté au rôle du destinataire :
   *   CLIENT        → /commande/:id/suivi   (page de suivi public)
   *   COMPANY       → /dashboard/entreprise
   *   DELIVERY      → /dashboard/livreur
   *   CORRESPONDENT → /dashboard/correspondant
   */
  async notifyOrderStatusChanged(params: IOrderStatusParams): Promise<void> {
    /* Tous les rôles sont redirigés vers la page de suivi de la commande.
     * Cette page lit le rôle depuis le JWT et adapte l'affichage. */
    const actionUrl = `/commande/${params.commandeId}/suivi`;

    try {
      const imageUrl = await this.resolveActorPhoto(params.actorType, params.actorId);
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     params.actorType,
        actorId:       params.actorId,
        type:          NotificationType.ORDER_STATUS_CHANGED,
        priority:      NotificationPriority.HIGH,
        title:         params.title,
        body:          params.body,
        imageUrl,
        actionUrl,
        resourceType:  'order',
        resourceId:    params.commandeId,
        payload: {
          commandeId: params.commandeId,
          orderRef:   params.orderRef,
          status:     params.newStatus,
        },
      });
    } catch (err) {
      this.logger.error(`notifyOrderStatusChanged (${params.newStatus}) failed`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // SUPPORT TICKETS (Phase 5)
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie l'utilisateur qu'un agent a répondu à son ticket de support.
   *
   * IMPORTANT — règle profileId :
   *   recipientId doit être le profileId (Client.id, Company.id, etc.)
   *   et NON le userId. L'appelant (SupportService) doit résoudre
   *   le profileId avant d'appeler cette méthode.
   *
   * PARAMÈTRES :
   *   recipientType  — type d'acteur du créateur du ticket ('client', 'company'…)
   *   recipientId    — profileId du créateur du ticket
   *   agentName      — nom de l'agent qui a répondu (affiché dans la notif)
   *   ticketId       — UUID du ticket (pour le lien deep-link)
   *   ticketRef      — référence lisible ex: 'SUP-2026-00001'
   *   ticketSubject  — sujet du ticket (affiché dans le corps de la notif)
   */
  // ─────────────────────────────────────────────────────────
  // PAIEMENTS & ESCROW  (ajoutés pour EventOrchestrationEngine)
  // ─────────────────────────────────────────────────────────

  async notifyPaymentConfirmed(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    commandeId:    string;
    commandeRef:   string;
    montant:       number;
    devise:        string;
    sessionId:     string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.PAYMENT_RECEIVED,
        priority:      NotificationPriority.HIGH,
        title:         'Paiement confirmé',
        body:          `Paiement de ${params.montant} ${params.devise} confirmé pour la commande ${params.commandeRef}.`,
        actionUrl:     `/commande/${params.commandeId}/suivi`,
        resourceType:  'payment',
        resourceId:    params.sessionId,
        payload:       { commandeId: params.commandeId, commandeRef: params.commandeRef, montant: params.montant },
      });
    } catch (err) {
      this.logger.error('notifyPaymentConfirmed failed', err);
    }
  }

  async notifyPaymentFailed(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    commandeId:    string;
    commandeRef:   string;
    reason:        string;
    sessionId:     string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.PAYMENT_FAILED,
        priority:      NotificationPriority.URGENT,
        title:         'Paiement échoué',
        body:          params.reason,
        /* BUG CORRIGÉ — /commande/:id/paiement n'existe pas côté frontend
         * (seule /commande/:id/suivi est enregistrée ; le retry de
         * paiement se fait depuis cette page). */
        actionUrl:     `/commande/${params.commandeId}/suivi`,
        resourceType:  'payment',
        resourceId:    params.sessionId,
      });
    } catch (err) {
      this.logger.error('notifyPaymentFailed failed', err);
    }
  }

  async notifyEscrowEvent(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    commandeId:    string;
    commandeRef:   string;
    title:         string;
    body:          string;
    montant:       number;
    devise:        string;
    escrowId:      string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.ORDER_STATUS_CHANGED,
        priority:      NotificationPriority.HIGH,
        title:         params.title,
        body:          params.body,
        actionUrl:     `/commande/${params.commandeId}/suivi`,
        resourceType:  'escrow',
        resourceId:    params.escrowId,
        payload:       { commandeRef: params.commandeRef, montant: params.montant, devise: params.devise },
      });
    } catch (err) {
      this.logger.error(`notifyEscrowEvent (${params.title}) failed`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // WALLET & RETRAITS
  // ─────────────────────────────────────────────────────────

  async notifyWalletOperation(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    walletId:      string;
    operationType: 'CREDIT' | 'DEBIT';
    montant:       number;
    devise:        string;
    newBalance:    number;
    title:         string;
    body:          string;
    reference?:    string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          params.operationType === 'CREDIT'
          ? NotificationType.PAYMENT_RECEIVED
          : NotificationType.PAYMENT_SENT,
        priority:      NotificationPriority.NORMAL,
        title:         params.title,
        body:          params.body,
        actionUrl:     params.recipientType === NotificationActorType.COMPANY
          ? '/dashboard/entreprise/finances'
          : params.recipientType === NotificationActorType.DELIVERY
          ? '/dashboard/livreur/revenus'
          : params.recipientType === NotificationActorType.CORRESPONDENT
          ? '/dashboard/correspondant'
          /* BUG CORRIGÉ — PARTNER retombait sur '/home' (route grand public,
           * hors dashboard) faute de branche dédiée : un partenaire recevant
           * une notif de crédit/débit wallet était redirigé n'importe où
           * sauf vers ses commissions. */
          : params.recipientType === NotificationActorType.PARTNER
          ? '/dashboard/partenaire'
          : '/home',
        resourceType:  'wallet',
        resourceId:    params.walletId,
        payload:       { montant: params.montant, devise: params.devise, newBalance: params.newBalance },
      });
    } catch (err) {
      this.logger.error(`notifyWalletOperation (${params.operationType}) failed`, err);
    }
  }

  async notifyWalletFrozen(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    walletId:      string;
    reason:        string;
    frozenBy:      string;
    title:         string;
    body:          string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.ADMIN,
        actorId:       null,
        type:          NotificationType.ACCOUNT_SUSPENDED,
        priority:      NotificationPriority.URGENT,
        title:         params.title,
        body:          params.body,
        actionUrl:     '/support',
        resourceType:  'wallet',
        resourceId:    params.walletId,
      });
    } catch (err) {
      this.logger.error('notifyWalletFrozen failed', err);
    }
  }

  async notifyWithdrawalStatus(params: {
    recipientType:   NotificationActorType;
    recipientId:     string;
    retraitId:       string;
    montant:         number;
    devise:          string;
    status:          'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    title:           string;
    body:            string;
    transactionRef?: string;
  }): Promise<void> {
    const type = params.status === 'COMPLETED'
      ? NotificationType.PAYMENT_SENT
      : params.status === 'FAILED'
        ? NotificationType.PAYMENT_FAILED
        : NotificationType.ORDER_STATUS_CHANGED;

    const priority = params.status === 'FAILED'
      ? NotificationPriority.URGENT
      : NotificationPriority.HIGH;

    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type,
        priority,
        title:         params.title,
        body:          params.body,
        actionUrl:     params.recipientType === NotificationActorType.COMPANY
          ? '/dashboard/entreprise/finances'
          : params.recipientType === NotificationActorType.DELIVERY
          ? '/dashboard/livreur/revenus'
          : params.recipientType === NotificationActorType.CORRESPONDENT
          ? '/dashboard/correspondant'
          /* BUG CORRIGÉ — voir notifyWalletOperation ci-dessus, même trou
           * pour PARTNER (un retrait de commission redirigeait vers '/home'). */
          : params.recipientType === NotificationActorType.PARTNER
          ? '/dashboard/partenaire'
          : '/home',
        resourceType:  'retrait',
        resourceId:    params.retraitId,
        payload:       { montant: params.montant, devise: params.devise, status: params.status },
      });
    } catch (err) {
      this.logger.error(`notifyWithdrawalStatus (${params.status}) failed`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // LITIGES & COMMISSIONS
  // ─────────────────────────────────────────────────────────

  async notifyDisputeEvent(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    disputeId:     string;
    disputeRef:    string;
    commandeId:    string;
    commandeRef:   string;
    title:         string;
    body:          string;
    status:        string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.ADMIN,
        actorId:       null,
        type:          NotificationType.ORDER_STATUS_CHANGED,
        priority:      NotificationPriority.HIGH,
        title:         params.title,
        body:          params.body,
        /* BUG CORRIGÉ — /commande/:id/litige n'existe pas côté frontend
         * (le litige se traite via une modale sur la page de suivi). */
        actionUrl:     `/commande/${params.commandeId}/suivi`,
        resourceType:  'dispute',
        resourceId:    params.disputeId,
        payload:       { disputeRef: params.disputeRef, commandeRef: params.commandeRef, status: params.status },
      });
    } catch (err) {
      this.logger.error(`notifyDisputeEvent (${params.status}) failed`, err);
    }
  }

  async notifyCommissionReceived(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    commandeId:    string;
    commandeRef:   string;
    montant:       number;
    devise:        string;
    title:         string;
    body:          string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.PAYMENT_SENT,
        priority:      NotificationPriority.NORMAL,
        title:         params.title,
        body:          params.body,
        actionUrl:     params.recipientType === NotificationActorType.DELIVERY
          ? '/dashboard/livreur/revenus'
          : params.recipientType === NotificationActorType.CORRESPONDENT
          ? '/dashboard/correspondant'
          /* BUG CORRIGÉ — voir notifyWalletOperation : PARTNER manquait ici
           * aussi (commission créditée → redirection vers '/home'). */
          : params.recipientType === NotificationActorType.PARTNER
          ? '/dashboard/partenaire'
          : '/home',
        resourceType:  'commission',
        resourceId:    params.commandeId,
        payload:       { commandeRef: params.commandeRef, montant: params.montant, devise: params.devise },
      });
    } catch (err) {
      this.logger.error('notifyCommissionReceived failed', err);
    }
  }

  async notifyAdminAlert(params: {
    recipientType: NotificationActorType;
    recipientId:   string | undefined;
    severity:      string;
    alertType:     string;
    title:         string;
    body:          string;
    metadata?:     Record<string, unknown>;
  }): Promise<void> {
    if (!params.recipientId) return;
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.SYSTEM_ANNOUNCEMENT,
        priority:      params.severity === 'CRITICAL' ? NotificationPriority.URGENT : NotificationPriority.HIGH,
        title:         params.title,
        body:          params.body,
        /* BUG CORRIGÉ — '/admin/dashboard' n'existe pas (router.tsx expose
         * '/dashboard/admin/*', pas '/admin/dashboard'). */
        actionUrl:     '/dashboard/admin',
        resourceType:  'system_alert',
        resourceId:    params.alertType,
        payload:       params.metadata,
      });
    } catch (err) {
      this.logger.error(`notifyAdminAlert (${params.alertType}) failed`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // SUPPORT TICKETS (Phase 5)
  // ─────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────
  // NOTIFICATIONS ADMIN DE ZONE
  // ─────────────────────────────────────────────────────────

  /**
   * Notifie un administrateur de zone qu'un nouveau compte est en attente
   * de validation dans sa zone (partenaire, entreprise ou livreur).
   *
   * Appelé depuis le service d'inscription quand un User PENDING est créé
   * et rattaché à un admin.
   *
   * adminProfileId = Admin.id (profileId, PAS le userId)
   */
  async notifyAdminValidationRequest(params: {
    adminProfileId: string;
    acteurNom:      string;
    acteurType:     'par' | 'ent' | 'lvr' | 'cor';
    userId:         string;
  }): Promise<void> {
    const labelType = {
      par: 'partenaire',
      ent: 'entreprise',
      lvr: 'livreur',
      cor: 'correspondant',
    }[params.acteurType] ?? params.acteurType;

    try {
      await this.notifService.create({
        recipientType: NotificationActorType.ADMIN,
        recipientId:   params.adminProfileId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.ACCOUNT_VERIFIED,
        priority:      NotificationPriority.HIGH,
        title:         'Nouvelle demande de validation',
        body:          `${params.acteurNom} demande la validation de son compte ${labelType}.`,
        /* BUG CORRIGÉ — '/dashboard/administrateur' n'existe pas
         * (router.tsx expose '/dashboard/admin/*', pas '/dashboard/administrateur'). */
        actionUrl:     '/dashboard/admin',
        groupKey:      `admin.validation.request:${params.adminProfileId}`,
        resourceType:  'validation',
        resourceId:    params.userId,
        payload:       { acteurNom: params.acteurNom, acteurType: params.acteurType },
      });
    } catch (err) {
      this.logger.error('notifyAdminValidationRequest failed', err);
    }
  }

  /**
   * Notifie un administrateur de zone qu'un nouveau signalement
   * a été créé et attend traitement.
   *
   * adminProfileId = Admin.id (profileId)
   */
  async notifyAdminNewSignalement(params: {
    adminProfileId: string;
    title:          string;
    severity:       'CRITICAL' | 'WARNING' | 'INFO';
    reportId:       string;
  }): Promise<void> {
    const isCritical = params.severity === 'CRITICAL';
    try {
      await this.notifService.create({
        recipientType: NotificationActorType.ADMIN,
        recipientId:   params.adminProfileId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.SYSTEM_ANNOUNCEMENT,
        priority:      isCritical ? NotificationPriority.URGENT : NotificationPriority.HIGH,
        title:         isCritical ? `Signalement critique ⚠️` : `Nouveau signalement`,
        body:          `"${params.title}" requiert votre attention.`,
        /* BUG CORRIGÉ — voir notifyAdminValidationRequest ci-dessus. */
        actionUrl:     '/dashboard/admin',
        groupKey:      `admin.signalement.new:${params.adminProfileId}`,
        resourceType:  'report',
        resourceId:    params.reportId,
        payload:       { severity: params.severity, title: params.title },
      });
    } catch (err) {
      this.logger.error('notifyAdminNewSignalement failed', err);
    }
  }

  /**
   * Notifie l'acteur que son compte vient d'être validé par l'administrateur.
   *
   * recipientId = profileId de l'acteur (Partner.id / Company.id / Delivery.id)
   */
  async notifyActeurAccountApproved(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    acteurNom:     string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.ADMIN,
        actorId:       null,
        type:          NotificationType.ACCOUNT_APPROVED,
        priority:      NotificationPriority.HIGH,
        title:         'Compte validé ✅',
        body:          `Votre compte a été validé par l'administrateur. Bienvenue sur Shopi !`,
        /* BUG CORRIGÉ — '/dashboard' seul (sans segment de rôle) n'existe
         * pas côté frontend. */
        actionUrl:     this.resolveOwnAccountUrl(params.recipientType),
        resourceType:  'account',
        resourceId:    params.recipientId,
      });
    } catch (err) {
      this.logger.error('notifyActeurAccountApproved failed', err);
    }
  }

  /**
   * Notifie l'acteur que son compte a été refusé par l'administrateur.
   *
   * recipientId = profileId de l'acteur
   */
  async notifyActeurAccountRejected(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.ADMIN,
        actorId:       null,
        type:          NotificationType.ACCOUNT_SUSPENDED,
        priority:      NotificationPriority.HIGH,
        title:         'Demande refusée ❌',
        body:          `Votre demande de compte n'a pas été acceptée. Contactez le support pour plus d'informations.`,
        actionUrl:     '/support',
        resourceType:  'account',
        resourceId:    params.recipientId,
      });
    } catch (err) {
      this.logger.error('notifyActeurAccountRejected failed', err);
    }
  }

  /**
   * Notifie l'acteur que son compte, jusque-là actif, vient d'être
   * suspendu par l'administrateur (action de modération — distincte du
   * refus d'une demande d'inscription, voir notifyActeurAccountRejected).
   *
   * recipientId = profileId de l'acteur
   */
  async notifyActeurAccountSuspended(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    motif?:        string | null;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.ADMIN,
        actorId:       null,
        type:          NotificationType.ACCOUNT_SUSPENDED,
        priority:      NotificationPriority.URGENT,
        title:         'Compte suspendu 🚫',
        body:          params.motif
          ? `Votre compte a été suspendu par l'administrateur. Motif : ${params.motif}`
          : `Votre compte a été suspendu par l'administrateur. Contactez le support pour plus d'informations.`,
        actionUrl:     '/support',
        resourceType:  'account',
        resourceId:    params.recipientId,
      });
    } catch (err) {
      this.logger.error('notifyActeurAccountSuspended failed', err);
    }
  }

  /**
   * Notifie l'acteur qu'il a reçu un avertissement de l'administrateur
   * suite à un signalement — sans suspension du compte.
   *
   * recipientId = profileId de l'acteur
   */
  async notifyActeurAccountWarned(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
    motif?:        string | null;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.ADMIN,
        actorId:       null,
        type:          NotificationType.SYSTEM_ANNOUNCEMENT,
        priority:      NotificationPriority.URGENT,
        title:         'Avertissement ⚠️',
        body:          params.motif
          ? `Vous avez reçu un avertissement de l'administrateur. Motif : ${params.motif}`
          : `Vous avez reçu un avertissement de l'administrateur suite à un signalement.`,
        actionUrl:     '/support',
        resourceType:  'account',
        resourceId:    params.recipientId,
      });
    } catch (err) {
      this.logger.error('notifyActeurAccountWarned failed', err);
    }
  }

  /**
   * Notifie l'acteur que son compte, précédemment suspendu, vient d'être
   * réactivé par l'administrateur.
   *
   * recipientId = profileId de l'acteur
   */
  async notifyActeurAccountReactivated(params: {
    recipientType: NotificationActorType;
    recipientId:   string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.ADMIN,
        actorId:       null,
        type:          NotificationType.ACCOUNT_APPROVED,
        priority:      NotificationPriority.HIGH,
        title:         'Compte réactivé ✅',
        body:          `Votre compte a été réactivé par l'administrateur. Vous pouvez de nouveau utiliser Shopi normalement.`,
        actionUrl:     this.resolveOwnAccountUrl(params.recipientType),
        resourceType:  'account',
        resourceId:    params.recipientId,
      });
    } catch (err) {
      this.logger.error('notifyActeurAccountReactivated failed', err);
    }
  }

  /**
   * Notifie le partenaire recruteur qu'un acteur qu'il a recruté (via son
   * code de création) vient d'activer son compte — validé par un admin.
   *
   * Type SYSTEM_ANNOUNCEMENT réutilisé volontairement (même motif que
   * notifyTeamPermissionChanged ci-dessus) : pas de valeur d'enum dédiée
   * pour éviter le risque d'ALTER TYPE en production.
   *
   * recipientId = Partner.id (profileId), PAS le userId.
   */
  async notifyPartnerActeurActivated(params: {
    recipientId: string;
    acteurNom:   string;
    acteurType:  'entreprise' | 'livreur';
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: NotificationActorType.PARTNER,
        recipientId:   params.recipientId,
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.SYSTEM_ANNOUNCEMENT,
        priority:      NotificationPriority.NORMAL,
        title:         'Nouvel acteur activé 🎉',
        body:          `${params.acteurNom} (${params.acteurType}) a activé son compte — recruté par vous.`,
        actionUrl:     '/dashboard/partenaire',
        resourceType:  'acteur',
        resourceId:    params.recipientId,
      });
    } catch (err) {
      this.logger.error('notifyPartnerActeurActivated failed', err);
    }
  }

  async notifySupportTicketReply(params: {
    recipientType:  string;
    recipientId:    string;
    agentName:      string;
    ticketId:       string;
    ticketRef:      string;
    ticketSubject:  string;
  }): Promise<void> {
    try {
      await this.notifService.create({
        recipientType: params.recipientType as NotificationActorType,
        recipientId:   params.recipientId,
        /* actorType SYSTEM car la réponse est initiée par un agent interne
         * et non par un profil public de l'application. */
        actorType:     NotificationActorType.SYSTEM,
        actorId:       null,
        type:          NotificationType.SUPPORT_TICKET_REPLY,
        priority:      NotificationPriority.HIGH,
        title:         'Réponse à votre ticket de support',
        body:          `${params.agentName} a répondu à "${params.ticketSubject}"`,
        /* Deep-link : l'utilisateur est redirigé directement vers le ticket */
        actionUrl:     `/support/tickets/${params.ticketId}`,
        /* groupKey : une seule notif de "réponse" par ticket à la fois.
         * Si l'agent envoie 2 réponses rapides, elles sont agrégées. */
        groupKey:      `support.reply:${params.ticketId}`,
        resourceType:  'support_ticket',
        resourceId:    params.ticketId,
        payload: {
          ticketId:     params.ticketId,
          ticketRef:    params.ticketRef,
          agentName:    params.agentName,
        },
      });
    } catch (err) {
      this.logger.error(`notifySupportTicketReply (${params.ticketRef}) failed`, err);
    }
  }
}
