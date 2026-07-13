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

import { User }           from '../../../database/entities/user.entity';
import { Client }         from '../../../database/entities/profiles/client-profile.entity';
import { PanierItem }     from '../../../database/entities/panier-item.entity';
import { Product }        from '../../../database/entities/entreprise.table/product.entity';
/* Entités livreurs */
import { Delivery }       from '../../../database/entities/profiles/livreur-profile.entity';
import { Follow }         from '../../../database/entities/follow/follow.entity';
/* ✅ Entités correspondant (profil) */
import { Correspondent }        from '../../../database/entities/profiles/correspondant-profile.entity';
import { CorrespondantHoraire } from '../../../database/entities/profiles/correspondant-horaire.entity';
/* ✅ Entité likes (favoris) */
import { ProductLike }          from '../../../database/entities/entreprise.table/product-like.entity';

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

/* Services existants */
import { ProfilService }    from './services/profil.service';
import { AdressesService }  from './services/adresses.service';
import { PaiementService }  from './services/paiement.service';
import { SecuriteService }  from './services/securite.service';
import { PointsService }    from './services/points.service';
import { SessionsService }  from './services/sessions.service';
import { ActiviteService }  from './services/activite.service';
import {
  ApprobationsService,
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

@Module({
  imports: [
    NotificationsModule,
    ReturnsModule,
    TypeOrmModule.forFeature([
      User,
      Client,
      PanierItem,
      Product,
      Delivery,
      Follow,
      Correspondent,         /* ✅ ajout */
      CorrespondantHoraire,  /* ✅ ajout */
      ProductLike,           /* ✅ ajout favoris */
    ]),
  ],

  controllers: [
    ClientParametresController,
    PanierController,
    LivreursClientController,      /* GET /client/livreurs/* */
    ClientProfilController,        /* GET /client/profil */
    CorrespondantProfilController, /* GET /client/correspondants/:id */
    FavorisController,             /* GET/POST /client/favoris */
    ClientSavController,           /* POST/GET /client/sav */
  ],

  providers: [
    ProfilService,
    AdressesService,
    PaiementService,
    PointsService,
    SecuriteService,
    SessionsService,
    ActiviteService,
    ApprobationsService,
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
  ],

  exports: [
    ProfilService,
    PanierService,
    LivreursClientService,          /* partagé avec SuivisModule */
    ClientProfilService,            /* ✅ ajout */
    CorrespondantProfilService,     /* ✅ ajout */
    FavorisService,                 /* ✅ ajout */
  ],
})
export class ClientModule {}