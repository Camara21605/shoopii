/* ============================================================
 * FICHIER : src/modules/livreurs/livreurs.module.ts
 *
 * RÔLE    : Module NestJS unique du système livreurs.
 *
 * ─── ENREGISTREMENT DANS EntrepriseDashboardModule ───────────
 *
 *   import { LivreursModule } from '../../livreurs/livreurs.module';
 *
 *   @Module({
 *     imports: [
 *       ...
 *       LivreursModule,   // ← ajouter ici
 *     ],
 *   })
 *   export class EntrepriseDashboardModule {}
 *
 * ─── OU DIRECTEMENT DANS app.module.ts ───────────────────────
 *
 *   import { LivreursModule } from './modules/livreurs/livreurs.module';
 *
 *   @Module({
 *     imports: [ ..., LivreursModule ],
 *   })
 *   export class AppModule {}
 *
 * ─── DÉPENDANCES EXTÉRIEURES ─────────────────────────────────
 *
 *   CodesModule   → exporte CodeCreationService
 *                   utilisé par InvitationLivreurService.inviter()
 *                   pour générer les codes XXXX-XXXX-XX
 *
 *   MailModule    → exporte MailService
 *                   utilisé pour sendInvitationEmail + sendContactEmail
 *
 * ─── NOTES SUR LES IMPORTS ───────────────────────────────────
 *
 *   Si CodesModule est déjà global → pas besoin de l'importer ici.
 *   Même chose pour MailModule si isGlobal: true.
 *
 * ============================================================ */

import { Module }         from '@nestjs/common';
import { TypeOrmModule }  from '@nestjs/typeorm';

import {
  Delivery,
} from 'src/database/entities/profiles/livreur-profile.entity';
import {
  Company,
} from 'src/database/entities/profiles/entreprise-profile.entity';

import { LivreursController }         from './livreurs.controller';
import { LivreursService }            from './services/livreurs.service';
import { InvitationLivreurService }   from './services/invitation-livreur.service';

import { MailModule }  from 'src/modules/email/email.module';
import { CodesModule } from 'src/modules/auth/code-creation/code-creation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Delivery,   // Profils des livreurs
      Company,    // Pour résoudre companyId depuis userId JWT
    ]),

    // CodeCreationService → génération code XXXX-XXXX-XX
    CodesModule,

    // MailService → sendInvitationEmail + sendContactEmail
    MailModule,
  ],

  controllers: [
    LivreursController,   // Un seul controller — 11 routes
  ],

  providers: [
    LivreursService,            // CRUD + stats + zones + activité
    InvitationLivreurService,   // Invitation + contact
  ],

  exports: [
    LivreursService,            // Exporté si besoin dans d'autres modules
  ],
})
export class LivreursModule {}