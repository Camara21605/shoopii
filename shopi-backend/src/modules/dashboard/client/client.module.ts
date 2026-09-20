/* ============================================================
 * FICHIER : src/modules/dashboard/client/client.module.ts
 *
 * MODIFICATIONS :
 *   ✅ Ajout LivreurProfile (Delivery) dans TypeOrmModule.forFeature
 *   ✅ Ajout Follow dans TypeOrmModule.forFeature
 *   ✅ Ajout LivreursClientController + LivreursClientService
 *   ✅ Ajout ClientProfilController + ClientProfilService
 *      → active GET /client/profil (profil client dynamique)
 *   ✅ Ajout Correspondent + CorrespondantHoraire dans forFeature
 *   ✅ Ajout CorrespondantProfilController + CorrespondantProfilService
 *      → active GET /client/correspondants/:id (profil correspondant)
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ReturnsModule }       from '../entreprise/returns/returns.module';
import { ClientSavController } from './sav/client-sav.controller';
import { SecurityAlertsModule } from '../../security-alerts/security-alerts.module';
import { MailModule } from '../../email/email.module';
/* ✅ Référentiel géographique réel — communes actives pour le filtre
 * "Zone de livraison" de LivreursClientService.getZoneCounts() */
import { GeoModule } from '../../geo/geo.module';
/* ✅ TwoFaService — vérifie mot de passe + code TOTP avant de désactiver
 * la 2FA (voir SecuriteService.update2fa) */
import { TwoFaModule } from '../../auth/twofa/twofa.module';
import { SessionModule } from '../../session/session.module';

import { User }           from '../../../database/entities/user.entity';
import { Client }         from '../../../database/entities/profiles/client-profile.entity';
import { PanierItem }     from '../../../database/entities/panier-item.entity';
import { Product }        from '../../../database/entities/entreprise.table/product.entity';
/* Entités livreurs */
import { Delivery }       from '../../../database/entities/profiles/livreur-profile.entity';
import { Follow }         from '../../../database/entities/follow/follow.entity';
/* ✅ Résolution du companyId de l'entreprise connectée — exclut ses
 * propres livreurs de GET /suivis/livreurs (LivreursClientService) */
import { Company }        from '../../../database/entities/profiles/entreprise-profile.entity';
/* ✅ Entités correspondant (profil) */
import { Correspondent }        from '../../../database/entities/profiles/correspondant-profile.entity';
import { CorrespondantHoraire } from '../../../database/entities/profiles/correspondant-horaire.entity';
/* ✅ Entité likes (favoris) */
import { ProductLike }          from '../../../database/entities/entreprise.table/product-like.entity';
/* ✅ Entités prestations de service (favoris services) */
import { Service }              from '../../../database/entities/entreprise.table/service.entity';
import { ServiceLike }          from '../../../database/entities/entreprise.table/service-like.entity';
/* ✅ Liste de souhaits (distincte des favoris — voir wishlist-item.entity.ts) */
import { WishlistItem }         from '../../../database/entities/entreprise.table/wishlist-item.entity';
/* ✅ Révocation des sessions lors d'un changement de mot de passe */
import { RefreshToken }         from '../../../database/entities/refresh-token.entity';
/* ✅ Profil public client — compteur de commandes complétées */
import { Commande }             from '../../../database/entities/commande/commande.entity';
/* ✅ Journal d'audit — consigne les demandes RGPD (section Données) */
import { AuditLog }             from '../../../database/entities/audit-log.entity';
import { AuthLog }              from '../../../database/entities/auth-log.entity';

/* Controllers existants */
import { ClientParametresController } from './client-parametres.controller';
import { PanierController }           from './panier.controller';
import { LivreursClientController }   from './livreurs/livreurs-client.controller';
/* ✅ Nouveau controller profil */
import { ClientProfilController }     from './client-profil.controller';
/* ✅ Nouveau controller profil correspondant */
import { CorrespondantProfilController } from './correspondant-profil.controller';
/* ✅ Nouveau controller favoris */
import { FavorisController }          from './favoris.controller';
/* ✅ Nouveau controller favoris (prestations de service) */
import { ServiceFavorisController }   from './service-favoris.controller';
/* ✅ Nouveau controller liste de souhaits */
import { WishlistController }         from './wishlist.controller';
/* ✅ Nouveau controller profil public client */
import { ClientPublicProfilController } from './client-public-profil.controller';
/* ✅ Nouveau controller demandes de retour */
import { ClientReturnsController }      from './returns/client-returns.controller';

/* Services existants */
import { ProfilService }    from './services/profil.service';
import { SecuriteService }  from './services/securite.service';
import { PointsService }    from './services/points.service';
import { SessionsService }  from './services/sessions.service';
import { ActiviteService }  from './services/activite.service';
import {
  NotifsService,
  PrivacyService,
  ApparenceService,
  LangueService,
  DonneesService,
  DangerService,
} from './services/preferences.service';
import { PanierService }         from './services/panier.service';
import { LivreursClientService } from './livreurs/livreurs-client.service';
/* ✅ Nouveau service profil */
import { ClientProfilService }   from './client-profil.service';
/* ✅ Nouveau service profil correspondant */
import { CorrespondantProfilService } from './correspondant-profil.service';
/* ✅ Nouveau service favoris */
import { FavorisService }             from './services/favoris.service';
/* ✅ Nouveau service favoris (prestations de service) */
import { ServiceFavorisService }      from './services/service-favoris.service';
/* ✅ Nouveau service liste de souhaits */
import { WishlistService }            from './services/wishlist.service';
/* ✅ Nouveau service profil public client */
import { ClientPublicProfilService }  from './client-public-profil.service';

@Module({
  imports: [
    NotificationsModule,
    ReturnsModule,
    SecurityAlertsModule,
    MailModule,
    GeoModule,
    TwoFaModule,
    SessionModule,          /* sessions réelles (Redis) — section Appareils connectés */
    TypeOrmModule.forFeature([
      User,
      Client,
      PanierItem,
      Product,
      Delivery,
      Follow,
      Company,                /* ✅ ajout — LivreursClientService.resolveOwnCompanyId */
      Correspondent,         /* ✅ ajout */
      CorrespondantHoraire,  /* ✅ ajout */
      ProductLike,           /* ✅ ajout favoris */
      Service,               /* ✅ ajout favoris services */
      ServiceLike,           /* ✅ ajout favoris services */
      WishlistItem,          /* ✅ ajout liste de souhaits */
      RefreshToken,          /* ✅ ajout — révocation sessions au changement MDP */
      Commande,              /* ✅ ajout — profil public client (compteur commandes) */
      AuditLog,              /* ✅ ajout — demandes RGPD (section Données) */
      AuthLog,               /* journal d'activité (connexions, changements de compte) */
    ]),
  ],

  controllers: [
    ClientParametresController,
    PanierController,
    LivreursClientController,      /* GET /client/livreurs/* */
    ClientProfilController,        /* GET /client/profil */
    CorrespondantProfilController, /* GET /client/correspondants/:id */
    FavorisController,             /* GET/POST /client/favoris */
    ServiceFavorisController,      /* GET/POST /client/favoris-services */
    WishlistController,            /* GET/POST /client/wishlist */
    ClientPublicProfilController,  /* GET /client/profils/:id */
    ClientSavController,           /* POST/GET /client/sav */
    ClientReturnsController,       /* POST/GET /client/returns */
  ],

  providers: [
    ProfilService,
    PointsService,
    SecuriteService,
    SessionsService,
    ActiviteService,
    NotifsService,
    PrivacyService,
    ApparenceService,
    LangueService,
    DonneesService,
    DangerService,
    PanierService,
    LivreursClientService,
    ClientProfilService,            /* ✅ ajout */
    CorrespondantProfilService,     /* ✅ ajout */
    FavorisService,                 /* ✅ ajout */
    ServiceFavorisService,          /* ✅ ajout */
    WishlistService,                /* ✅ ajout */
    ClientPublicProfilService,      /* ✅ ajout */
  ],

  exports: [
    ProfilService,
    PanierService,
    LivreursClientService,          /* partagé avec SuivisModule */
    ClientProfilService,            /* ✅ ajout */
    CorrespondantProfilService,     /* ✅ ajout */
    FavorisService,                 /* ✅ ajout */
    ServiceFavorisService,          /* ✅ ajout */
    WishlistService,                /* ✅ ajout — réutilisé par ExploreModule (pour-vous) */
  ],
})
export class ClientModule {}