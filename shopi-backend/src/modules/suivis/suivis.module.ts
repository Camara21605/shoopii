/* ============================================================
 * FICHIER : src/modules/suivis/suivis.module.ts
 *
 * MODULE UNIQUE qui regroupe tout le système de suivi.
 *
 * STRUCTURE INTERNE
 * ─────────────────
 *   3 Services    (1 par type de cible)
 *   3 Controllers (1 par type de cible, routes séparées)
 *   1 Gateway     (WebSocket /suivis — notifications temps réel)
 *   1 Processor   (BullMQ — opérations async post-follow)
 *   1 Queue       (Redis via BullMQ)
 *
 * DÉPENDANCES EXTERNES
 * ─────────────────────
 * Ce module nécessite dans app.module.ts :
 *
 *   BullModule.forRoot({
 *     connection: {
 *       host: process.env.REDIS_HOST ?? 'localhost',
 *       port: parseInt(process.env.REDIS_PORT ?? '6379'),
 *     },
 *   })
 *
 *   RedisModule.forRoot({
 *     config: { host: '...', port: ... }
 *   })
 *
 *   JwtModule.registerAsync({ ... })  ← pour le gateway WebSocket
 *
 * PACKAGES REQUIS
 * ───────────────
 *   npm install @nestjs/bullmq bullmq ioredis @nestjs-modules/ioredis
 *   npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
 * ============================================================ */

import { Module }           from '@nestjs/common';
import { TypeOrmModule }    from '@nestjs/typeorm';
import { BullModule }       from '@nestjs/bullmq';
import { JwtModule }        from '@nestjs/jwt';

/* ── Entités TypeORM ── */
import { Follow }           from '../../database/entities/follow/follow.entity';
import { FollowBlock }      from '../../database/entities/follow/follow-block.entity';
import { User }             from '../../database/entities/user.entity';
import { Client }           from '../../database/entities/profiles/client-profile.entity';
import { Company }          from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }         from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent }    from '../../database/entities/profiles/correspondant-profile.entity';

/* ── Services (1 par type de cible) ── */
import { MesAbonnementsController } from './controllers/mes-abonnements.controller';
import { MesAbonnementsService }    from './services/mes-abonnements.service';
import { SuivisCorrespondantService } from './services/suivis-correspondant.service';
import { SuivisLivreurService }       from './services/suivis-livreur.service';
import { SuivisEntrepriseService }    from './services/suivis-entreprise.service';

/* ── Controllers (1 par type de cible) ── */
import { SuivisCorrespondantController } from './controllers/suivis-correspondant.controller';
import { SuivisLivreurController }       from './controllers/suivis-livreur.controller';
import { SuivisEntrepriseController }    from './controllers/suivis-entreprise.controller';


import { ClientModule } from '../dashboard/client/client.module';

/* ── WebSocket Gateway ── */
import { SuivisGateway } from './gateways/suivis.gateway';

/* ── BullMQ Processor ── */
import { SuivisProcessor } from './processors/suivis.processor';

/* ── Constante du nom de la queue ── */
import { SUIVIS_QUEUE }  from './suivis.queue';

@Module({
  imports: [
    /* ── TypeORM : toutes les entités nécessaires ── */
    TypeOrmModule.forFeature([
      Follow,          // Table des suivis
      FollowBlock,     // Table des blocages
      User,            // Pour résoudre userId → profil
      Client,          // Profil client (follower)
      Company,         // Profil entreprise (follower + cible)
      Delivery,        // Profil livreur (follower + cible)
      Correspondent,   // Profil correspondant (follower + cible)
      
    ]),

    ClientModule,

    /* ── BullMQ : file d'attente Redis ── */
    BullModule.registerQueue({
      name: SUIVIS_QUEUE,
      defaultJobOptions: {
        /* Retry automatique en cas d'échec du job */
        attempts:  3,
        backoff:   { type: 'exponential', delay: 2000 },
        /* Conserver les jobs réussis 24h pour debug */
        removeOnComplete: { age: 86400 },
        /* Conserver les jobs échoués 7j pour analyse */
        removeOnFail:     { age: 604800 },
      },
    }),

    /*
     * JwtModule pour vérifier les tokens dans le WebSocket Gateway.
     * Le secret doit correspondre à celui utilisé dans AuthModule.
     */
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'shopi-secret',
    }),
  ],

  controllers: [
    /* Route /suivis/correspondants → SuivisCorrespondantController */
    SuivisCorrespondantController,
    /* Route /suivis/livreurs       → SuivisLivreurController       */
    SuivisLivreurController,
    /* Route /suivis/entreprises    → SuivisEntrepriseController     */
    SuivisEntrepriseController,
    MesAbonnementsController,
  ],

  providers: [
    /* ── 3 Services séparés ── */
    SuivisCorrespondantService,   // Cible : CORRESPONDENT
    SuivisLivreurService,         // Cible : DELIVERY
    SuivisEntrepriseService,      // Cible : COMPANY

    /* ── WebSocket Gateway (namespace /suivis) ── */
    SuivisGateway,

    /* ── BullMQ Processor (traite les jobs async) ── */
    SuivisProcessor,
    MesAbonnementsService, 
  ],

  /*
   * Exports : les services sont exportés pour pouvoir être utilisés
   * dans d'autres modules (ex: DashboardModule pour la page profil)
   */
  exports: [
    SuivisCorrespondantService,
    SuivisLivreurService,
    SuivisEntrepriseService,
    SuivisGateway,
  ],
})
export class SuivisModule {}