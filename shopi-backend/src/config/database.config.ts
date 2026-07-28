// src/config/database.config.ts

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService }        from '@nestjs/config';

// ── Entité principale ──────────────────────────────────────────────────────
import { User }         from '../database/entities/user.entity';
import { CreationCode } from '../database/entities/code-creation.entity'; // ✅ CORRIGÉ : code-creation → creation-code
import { PanierItem }   from '../database/entities/panier-item.entity';
// ── Profils acteurs ────────────────────────────────────────────────────────
import { Admin }         from '../database/entities/profiles/admin-profile.entity';
import { Partner }       from '../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../database/entities/profiles/correspondant-profile.entity'; // ✅ AJOUTÉ : était commenté
import { Client }        from '../database/entities/profiles/client-profile.entity';        // ✅ AJOUTÉ : était commenté

// ── Portefeuille ───────────────────────────────────────────────────────────
import { Wallet }            from '../database/entities/wallet.entity';
import { WalletTransaction } from '../database/entities/wallet-transaction.entity';
import { Promotion } from 'src/database/entities/entreprise.table/promotion.entity';

// ── Localisation ───────────────────────────────────────────────────────────
import { Localisation } from '../database/entities/localisation.entity';

// ── Catalogue produits ─────────────────────────────────────────────────────
// ✅ CORRIGÉ : le point dans "entreprise.table" est invalide comme nom de dossier
// Renommez le dossier "entreprise.table" en "product" ou "catalogue"
// et ajustez les imports ici en conséquence.
// En attendant, on suppose que le dossier s'appelle "product" :
import { Category }       from '../database/entities/entreprise.table/category.entity';
import { SubCategory }    from '../database/entities/entreprise.table/sub-category.entity';
import { Product }        from '../database/entities/entreprise.table/product.entity';
import { ProductVariant } from '../database/entities/entreprise.table/product-variant.entity';
import { ProductSpec }    from '../database/entities/entreprise.table/product-spec.entity';
import { ProductWholesaleTier } from '../database/entities/entreprise.table/product-wholesale-tier.entity';
import { ProductMedia }   from '../database/entities/entreprise.table/product-media.entity';
import { ProductStory } from '../database/entities/entreprise.table/product-story.entity';
import { ProductLike } from '../database/entities/entreprise.table/product-like.entity';  
import { PromotionProduct } from '../database/entities/entreprise.table/promotion-product.entity'; // ✅ AJOUTÉ : manquait l'import de PromotionProduct
import { PromotionUsage } from 'src/database/entities/entreprise.table/promotion-usage.entity';
import {Commande} from "../database/entities/commande/commande.entity";
import {CorrespondantHoraire} from "../database/entities/profiles/correspondant-horaire.entity";
import {FollowBlock} from "../database/entities/follow/follow-block.entity";
import { AuditLog } from '../database/entities/audit-log.entity';
import { Report } from '../database/entities/report.entity';
import {Follow} from "../database/entities/follow/follow.entity";
import {FollowRequest} from "../database/entities/follow/follow-request.entity";
import {CommandeItem} from "../database/entities/commande/commande-item.entity";
import {CommandeCode} from "../database/entities/commande/commande-code.entity";
import { Conversation } from '../database/entities/messaging/conversation.entity';  
import { ConversationPermission } from '../database/entities/messaging/conversation-permission.entity';
import { LivreurHoraire} from '../database/entities/livreur.table/livreur-horaire.entity';
import { Message } from '../database/entities/messaging/message.entity'; // ✅ AJOUTÉ : manquait l'import de Message  
import { MessageReadReceipt } from 'src/database/entities/messaging/message-read-receipt.entity';
import { Notification } from '../database/entities/notification/notification.entitiy';
import { NotificationPreference } from '../database/entities/notification/notification-preference.entity';
import { NotificationDeliveryLog } from '../database/entities/notification/notification-delivery-log.entity'; // ✅ AJOUTÉ : manquait l'import de NotificationDeliveryLog
import { CompanyType }    from '../database/entities/entreprise.table/company-type.entity';
import { CompanyHoraire } from '../database/entities/entreprise.table/company-horaire.entity';
import { CompanyAvis }    from '../database/entities/entreprise.table/company-avis.entity';
// ── Location ───────────────────────────────────────────────────────────────────
import { CompanyBranch }    from '../database/entities/location/company-branch.entity';
import { LocationHistory }  from '../database/entities/location/location-history.entity';
import { PlatformSettings } from '../database/entities/platform-settings.entity';
import { ReturnRequest }    from '../database/entities/returns/return-request.entity';
import { ReturnEvidence }   from '../database/entities/returns/return-evidence.entity';
import { ReturnHistory }    from '../database/entities/returns/return-history.entity';
import { SavTicket }        from '../database/entities/returns/sav-ticket.entity';
import { SavMessage }       from '../database/entities/returns/sav-message.entity';
// ── Messagerie avancée ─────────────────────────────────────────────────────
import { MessagingAuditLog }    from '../database/entities/messaging/messaging-audit-log.entity';
import { UserContact }          from '../database/entities/contacts/user-contact.entity';
import { ContactSyncSession }   from '../database/entities/contacts/contact-sync-session.entity';
// ── Centre d'aide ──────────────────────────────────────────────────────────
import { HelpCategory }    from '../database/entities/help/help-category.entity';
import { HelpArticle }     from '../database/entities/help/help-article.entity';
import { HelpFaqItem }     from '../database/entities/help/help-faq-item.entity';
import { HelpSearchQuery } from '../database/entities/help/help-search-query.entity';
// ── Support tickets ────────────────────────────────────────────────────────
import { SupportTicket }  from '../database/entities/support/support-ticket.entity';
import { SupportMessage } from '../database/entities/support/support-message.entity';
import { Attachment }     from '../database/entities/support/attachment.entity';
// ── Formulaire de contact ──────────────────────────────────────────────────
import { ContactMessage } from '../database/entities/contact/contact-message.entity';
// ── Référentiel géographique ───────────────────────────────────
import { GeoPays }       from '../database/entities/geo/geo-pays.entity';
import { GeoRegion }     from '../database/entities/geo/geo-region.entity';
import { GeoPrefecture } from '../database/entities/geo/geo-prefecture.entity';
import { GeoCommune }    from '../database/entities/geo/geo-commune.entity';
import { GeoQuartier }   from '../database/entities/geo/geo-quartier.entity';
import { GeoZone }       from '../database/entities/geo/geo-zone.entity';
// ── Préférences d'apparence ────────────────────────────────────
import { AppearancePreference } from '../database/entities/appearance-preference.entity';
// ── Moteur de validation ───────────────────────────────────────
import { ValidationConfig }     from '../modules/validation-config/validation-config.entity';
// ── Configuration entreprises ──────────────────────────────────
import { CompanySetting }       from '../modules/company-settings/company-settings.entity';
// ── Configuration livreurs ─────────────────────────────────────
import { DeliverySetting }      from '../modules/delivery-settings/delivery-settings.entity';
// ── Configuration partenaires ──────────────────────────────────
import { PartnerSetting }       from '../modules/partner-settings/partner-settings.entity';
// ── Groupes de livraison automatiques ──────────────────────────
import { DeliveryGroup }        from '../database/entities/delivery-group/delivery-group.entity';
import { DeliveryGroupMember }  from '../database/entities/delivery-group/delivery-group-member.entity';
import { GroupMessage }         from '../database/entities/delivery-group/group-message.entity';
// ── Company Team Management — Phase 1 ───────────────────────
import { CompanyTeamMember }      from '../database/entities/company-team/company-team-member.entity';
import { CompanyTeamPermission }  from '../database/entities/company-team/company-team-permission.entity';
import { CompanyTeamActivityLog } from '../database/entities/company-team/company-team-activity-log.entity';
import { CompanyTeamAuditLog }    from '../database/entities/company-team/company-team-audit-log.entity';
// ── Company Team Management — Phase 2 (Extensions) ──────────
import { TeamPlanConfig }            from '../database/entities/company-team/team-plan-config.entity';
import { CompanyPlanAssignment }     from '../database/entities/company-team/company-plan-assignment.entity';
import { CompanyTeamInvitation }     from '../database/entities/company-team/company-team-invitation.entity';
import { TeamPermissionCategory }    from '../database/entities/company-team/team-permission-category.entity';
import { TeamPermissionDefinition }  from '../database/entities/company-team/team-permission-definition.entity';
import { TeamPermissionTemplate }    from '../database/entities/company-team/team-permission-template.entity';
// ── Auth — journalisation et refresh tokens ───────────────────
import { AuthLog }      from '../database/entities/auth-log.entity';
import { RefreshToken } from '../database/entities/refresh-token.entity';
// ── Sécurité plateforme ──────────────────────────────────────
import { SystemMetric }       from '../database/entities/security/system-metric.entity';
import { SecurityEventLog }   from '../database/entities/security/security-event-log.entity';
import { PlatformIncident }   from '../database/entities/security/platform-incident.entity';
// ── Moteur de paiement / reporting financier ──────────────────
import { PaiementSession }      from '../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution } from '../database/entities/paiement/paiement-distribution.entity';
import { Retrait }              from '../database/entities/paiement/retrait.entity';
import { Dispute }              from '../database/entities/paiement/dispute.entity';
import { DisputeEvidence }      from '../database/entities/paiement/dispute-evidence.entity';
import { DisputeHistory }       from '../database/entities/paiement/dispute-history.entity';
import { FinancialAuditLog }    from '../database/entities/paiement/financial-audit-log.entity';
import { CommissionRule }       from '../database/entities/paiement/commission-rule.entity';
import { ConfigurationSnapshot } from '../database/entities/paiement/configuration-snapshot.entity';
import { Escrow }                from '../database/entities/paiement/escrow.entity';
import { EscrowHistory }         from '../database/entities/paiement/escrow-history.entity';
import { ProviderConfig }        from '../database/entities/paiement/provider-config.entity';
import { SettlementBatch }       from '../database/entities/paiement/settlement-batch.entity';
import { WebhookEvent }          from '../database/entities/paiement/webhook-event.entity';
import { WalletLedgerEntry }     from '../database/entities/wallet-ledger-entry.entity';


/* ============================================================
 * FICHIER      : src/config/database.config.ts
 * MODULE       : Config
 * ROLE         : Configuration de la connexion PostgreSQL via TypeORM.
 *
 * RESPONSABILITES :
 *   - Lire DATABASE_URL depuis les variables d'environnement (crash si absente).
 *   - Configurer SSL (obligatoire en production / Supabase).
 *   - Déclarer les 60+ entités TypeORM (source de vérité pour le schéma DB).
 *   - Configurer le pool de connexions (min 2, max 10) via le
 *     Transaction pooler Supabase (port 6543).
 *
 * DEPENDANCES  :
 *   - @nestjs/typeorm (TypeOrmModuleOptions)
 *   - @nestjs/config (ConfigService)
 *   - Toutes les entités de src/database/entities/**
 *
 * CONSOMME PAR :
 *   - AppModule — TypeOrmModule.forRootAsync(databaseConfigFactory)
 *
 * VARIABLES D'ENVIRONNEMENT :
 *   DATABASE_URL  — URL PostgreSQL complète (OBLIGATOIRE)
 *   NODE_ENV      — 'production' active SSL automatiquement
 *   DB_SSL        — 'true' force SSL même en dev
 *   DB_SYNC       — 'true' active TypeORM synchronize (JAMAIS en prod)
 *
 * PRECAUTION :
 *   DB_SYNC=true en production peut modifier/supprimer des colonnes sans avertissement.
 *   Toujours utiliser des migrations en production.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */


export const databaseConfigFactory = {
  inject: [ConfigService],
  useFactory: (config: ConfigService): TypeOrmModuleOptions => {

    /*
     * ── SSL ────────────────────────────────────────────────────────
     * Obligatoire pour Supabase et tout hébergement PostgreSQL distant.
     * rejectUnauthorized: false → accepte les certificats auto-signés
     * (pratique pour dev/staging ; mettre true + CA en production).
     */
    /*
     * ── DATABASE_URL obligatoire ─────────────────────────────────────
     * On n'autorise AUCUN fallback vers localhost.
     * Sur Render / Supabase, DATABASE_URL doit TOUJOURS être définie.
     * Si elle est absente → crash immédiat avec message explicite.
     */
    const databaseUrl = config.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error(
        '[DB] DATABASE_URL is missing. ' +
        'Set it in your environment variables (Render → Settings → Environment). ' +
        'Example: postgresql://user:pass@host:5432/db',
      );
    }

    /*
     * SSL toujours activé en production (Supabase l'exige).
     * En développement, DB_SSL=false désactive si besoin.
     */
    const isProd = config.get<string>('NODE_ENV') === 'production';
    const useSSL = isProd || config.get<string>('DB_SSL') === 'true';

    /*
     * ── SSL via extra uniquement ───────────────────────────────────────
     *
     * On NE touche PAS à DATABASE_URL (pas de sslmode= injecté).
     * Raison : pg-connection-string traite sslmode=require comme
     * verify-full → "self-signed certificate in certificate chain".
     *
     * Solution : passer ssl UNIQUEMENT via extra.ssl avec
     * rejectUnauthorized: false → accepte le certificat Supabase
     * sans vérifier la chaîne CA.
     *
     * dns.setDefaultResultOrder('ipv4first') dans main.ts gère IPv4.
     * family: 4 ici renforce au niveau pg driver.
     */
    return {
      type: 'postgres' as const,
      url:  databaseUrl,
      extra: {
        family: 4,
        /* max: 10 — valeur prudente côté app. DATABASE_URL pointe désormais
         * vers le Transaction pooler Supabase (port 6543), qui supporte
         * bien plus de connexions concurrentes que le Session pooler
         * (port 5432, plafonné à pool_size=15 → erreurs EMAXCONNSESSION
         * observées avec max:20). */
        max: 10,
        min: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        ...(useSSL && {
          ssl: { rejectUnauthorized: false },
        }),
      },

      entities: [
      // 1. Aucune dépendance
      User,
      PanierItem,
      Category,
      SubCategory,

      // 2. Dépend de User
      Admin,
      Wallet,
      WalletTransaction,
      Localisation,

      // 3. Dépend de User + Admin
      Partner,

      // 4. Dépend de User + Admin + Partner
      CompanyType,
      Company,

      // 5. Dépend de User + Admin + Partner + Company
      Delivery,

      // 6. Dépend de User + Company + Delivery + Partner
      Correspondent,
      Client,

      // 7. Catalogue — dépend de Company
      Product,
      ProductVariant,
      ProductSpec,
      ProductWholesaleTier,
      ProductMedia,
      Promotion,

      // 8. EN DERNIER — dépend de tous les profils
      ProductStory,
      ProductLike,
      CreationCode,
      PromotionProduct,
      PromotionUsage,
      Commande,
      CommandeItem,
      CommandeCode,
      Conversation,
      ConversationPermission,
      Message,
      MessageReadReceipt,
      Notification,
      NotificationPreference,
      NotificationDeliveryLog,
      CompanyHoraire,
      CompanyAvis,
      LivreurHoraire,
      CorrespondantHoraire,
      Follow,
      FollowRequest,
      FollowBlock,
      AuditLog,
      Report,
      // ── Location ──────────────────────────────────────────
      CompanyBranch,
      LocationHistory,
      // ── Config globale ────────────────────────────────────
      PlatformSettings,
      // ── Retours & SAV ─────────────────────────────────────
      ReturnRequest,
      ReturnEvidence,
      ReturnHistory,
      SavTicket,
      SavMessage,
      // ── Messagerie avancée ────────────────────────────────────
      MessagingAuditLog,
      UserContact,
      ContactSyncSession,
      // ── Centre d'aide ─────────────────────────────────────────
      HelpCategory,
      HelpArticle,
      HelpFaqItem,
      HelpSearchQuery,
      // ── Support tickets ───────────────────────────────────────
      SupportTicket,
      SupportMessage,
      Attachment,
      // ── Formulaire de contact ─────────────────────────────────
      ContactMessage,
      // ── Référentiel géographique ──────────────────────────────
      GeoPays,
      GeoRegion,
      GeoPrefecture,
      GeoCommune,
      GeoQuartier,
      GeoZone,
      // ── Préférences d'apparence ───────────────────────────────
      AppearancePreference,
      // ── Moteur de validation ──────────────────────────────────
      ValidationConfig,
      // ── Configuration entreprises ─────────────────────────────
      CompanySetting,
      // ── Configuration livreurs ────────────────────────────────
      DeliverySetting,
      // ── Configuration partenaires ─────────────────────────────
      PartnerSetting,
      // ── Groupes de livraison automatiques ─────────────────────
      // Ces trois tables sont créées par TypeORM uniquement si elles
      // apparaissent ici ET que DB_SYNC=true est dans le .env.
      DeliveryGroup,
      DeliveryGroupMember,
      GroupMessage,
      // ── Company Team Management — Phase 1 ─────────────────
      CompanyTeamMember,
      CompanyTeamPermission,
      CompanyTeamActivityLog,
      CompanyTeamAuditLog,
      // ── Company Team Management — Phase 2 (Extensions) ────
      TeamPlanConfig,
      CompanyPlanAssignment,
      CompanyTeamInvitation,
      TeamPermissionCategory,
      TeamPermissionDefinition,
      TeamPermissionTemplate,
      // ── Auth — journalisation et refresh tokens ──────────────
      AuthLog,
      RefreshToken,
      // ── Sécurité plateforme ────────────────────────────────
      SystemMetric,
      SecurityEventLog,
      PlatformIncident,
      // ── Moteur de paiement / reporting financier ────────────
      PaiementSession,
      PaiementDistribution,
      Retrait,
      Dispute,
      DisputeEvidence,
      DisputeHistory,
      FinancialAuditLog,
      CommissionRule,
      ConfigurationSnapshot,
      Escrow,
      EscrowHistory,
      ProviderConfig,
      SettlementBatch,
      WebhookEvent,
      WalletLedgerEntry,
    ],


    /* synchronize — activé uniquement si DB_SYNC=true ET hors production.
     * En développement : DB_SYNC=true pour laisser TypeORM créer/mettre à jour les tables.
     * En production  : JAMAIS activer — TypeORM peut modifier/supprimer des colonnes.
     * Utiliser les migrations (src/database/migrations/) à la place. */
    synchronize: config.get<string>('NODE_ENV') !== 'production' && config.get<string>('DB_SYNC') === 'true',

    /* Logs SQL : erreurs uniquement — ['query'] est trop verbeux et ralentit le dev */
    logging: ['error'],

    } as TypeOrmModuleOptions;
  },
};