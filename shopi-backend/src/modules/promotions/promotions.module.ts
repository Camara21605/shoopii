/* ============================================================
 * FICHIER : src/modules/promotions/promotions.module.ts
 *
 * RÔLE    : Module NestJS du système de promotions.
 *           Déclare et connecte tous les composants :
 *           Controller, Services, Repositories TypeORM.
 *
 * ─── ENREGISTREMENT DANS app.module.ts ───────────────────────
 *
 *   import { PromotionsModule } from './modules/promotions/promotions.module';
 *
 *   @Module({
 *     imports: [
 *       ...
 *       PromotionsModule,   // ← ajouter ici
 *     ],
 *   })
 *   export class AppModule {}
 *
 * ─── UTILISATION DE applyCode DEPUIS CommandesModule ─────────
 *
 *   Si CommandesService doit appeler PromoCodeService.applyCode(),
 *   exporter PromoCodeService depuis ce module et l'importer
 *   dans CommandesModule :
 *
 *   Dans PromotionsModule : exports: [PromoCodeService]
 *   Dans CommandesModule  : imports: [PromotionsModule]
 *
 * ============================================================ */

import { Module }                from '@nestjs/common';
import { TypeOrmModule }         from '@nestjs/typeorm';

// ── Entités enregistrées dans ce module ──────────────────────
import { Promotion }
  from 'src/database/entities/entreprise.table/promotion.entity';
import { PromotionProduct }
  from 'src/database/entities/entreprise.table/promotion-product.entity';
import { PromotionUsage }
  from 'src/database/entities/entreprise.table/promotion-usage.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';
import { Product }
  from 'src/database/entities/entreprise.table/product.entity';

// ── Composants du module ──────────────────────────────────────
import { PromotionsController } from './promotions.controller';
import { PromotionsService }    from './services/promotions.service';
import { PromoCodeService }     from './services/promo-code.service';
import { PromotionsScheduler }  from './promotions.scheduler';
import { NotificationsModule }  from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Promotion,
      PromotionProduct,
      PromotionUsage,
      Company,
      Product,
    ]),
    NotificationsModule,
  ],

  controllers: [
    PromotionsController,
  ],

  providers: [
    PromotionsService,
    PromoCodeService,
    PromotionsScheduler,
  ],

  exports: [
    PromoCodeService,
    PromotionsService,
  ],
})
export class PromotionsModule {}