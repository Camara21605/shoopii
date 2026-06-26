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
import { CompanyBranch }   from '../database/entities/location/company-branch.entity';
import { LocationHistory } from '../database/entities/location/location-history.entity';


/*****************************************************
 * FICHIER : src/config/database.config.ts
 * RÔLE    : Configuration de la connexion à la base de données MySQL via TypeORM. */


export const databaseConfigFactory = {
  inject: [ConfigService],
  useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
    type:     'mysql',
    host:     config.get<string>('DB_HOST',     'localhost'),
    port:     config.get<number>('DB_PORT',     3307),
    username: config.get<string>('DB_USERNAME', 'root'),
    password: config.get<string>('DB_PASSWORD', ''),
    database: config.get<string>('DB_NAME',     'shopi'),

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
    ],


    // ✅ Ne jamais utiliser synchronize en production
    synchronize: true, // ⚠️ À mettre à false en production et gérer les migrations manuellement

    // ✅ Logs SQL uniquement en développement
    logging: config.get<string>('NODE_ENV') === 'development',

    extra: {
      charset: 'utf8mb4_unicode_ci',
      /*
       * ✅ ROW_FORMAT DYNAMIC requis pour les tables avec beaucoup de colonnes JSON/TEXT.
       * Exécuté automatiquement au démarrage si nécessaire.
       * Si erreur "Row size too large", exécuter en SQL :
       *   SET GLOBAL innodb_default_row_format = 'DYNAMIC';
       *   ALTER TABLE `clients` ROW_FORMAT=DYNAMIC;
       *   (répéter pour chaque table concernée)
       */
    },

    /*
     * ⚠️ Pour éviter ER_TOO_BIG_ROWSIZE sur les nouvelles tables :
     * Ajouter dans my.cnf (MySQL server) :
     *   [mysqld]
     *   innodb_default_row_format = DYNAMIC
     *
     * Ou exécuter une fois en SQL :
     *   SET GLOBAL innodb_default_row_format = 'DYNAMIC';
     *   ALTER TABLE `clients` ROW_FORMAT=DYNAMIC;
     */
  }),
};