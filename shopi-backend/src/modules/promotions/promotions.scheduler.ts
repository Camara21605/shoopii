/* ============================================================
 * FICHIER : src/modules/promotions/promotions.scheduler.ts
 *
 * RÔLE : tâches planifiées liées aux promotions.
 *
 *   notifyEndingSoon — tous les jours à 09h00
 *     → Notifie les entreprises dont une promo ACTIVE
 *       expire dans les 24 heures suivantes.
 *     → groupKey = promo.ending_soon:{promoId} empêche
 *       les doublons si le CRON tourne plusieurs fois.
 *
 *   syncPromoPrices — toutes les 15 minutes
 *     → Filet de sécurité pour Product.prixPromo/activePromoId
 *       (le gros du travail est fait en temps réel par
 *       PromotionsService.syncCompanyProductPromoPrices lors de
 *       activate/pause/end/update). Rattrape :
 *       1) les promos ACTIVE dont endDate est dépassée (jusque-là
 *          seule une notification était envoyée, aucun statut ne
 *          changeait automatiquement → le prix réduit serait resté
 *          affiché indéfiniment après expiration) ;
 *       2) les promos activées à l'avance (startDate future) dont
 *          la date de début vient d'être atteinte.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Repository } from 'typeorm';

import {
  Promotion,
  PromoStatus,
} from '../../database/entities/entreprise.table/promotion.entity';
import { NotificationType } from '../../database/entities/notification/notification.entitiy';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { PromotionsService } from './services/promotions.service';

@Injectable()
export class PromotionsScheduler {

  private readonly logger = new Logger(PromotionsScheduler.name);

  constructor(
    @InjectRepository(Promotion) private readonly promoRepo: Repository<Promotion>,
    private readonly notifEventSvc: NotificationEventService,
    private readonly promotionsService: PromotionsService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * Tous les jours à 09h00 — promotions qui expirent dans 24h
   ════════════════════════════════════════════════════════ */
  @Cron('0 9 * * *')
  async notifyEndingSoon(): Promise<void> {
    const now      = new Date();
    const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1_000);

    const promos = await this.promoRepo.find({
      where: {
        status:  PromoStatus.ACTIVE,
        endDate: Between(now, in24h),
      },
      select: ['id', 'companyId', 'code', 'nom', 'endDate'],
    });

    if (promos.length === 0) return;

    this.logger.log(`PROMO_ENDING_SOON: ${promos.length} promotion(s) expirent dans 24h`);

    for (const promo of promos) {
      try {
        const heure = promo.endDate
          ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(promo.endDate))
          : 'bientôt';

        void this.notifEventSvc.notifyPromoEvent({
          companyId: promo.companyId,
          promoId:   promo.id,
          promoCode: promo.code,
          type:      NotificationType.PROMO_ENDING_SOON,
          title:     'Promotion expire bientôt ⏰',
          body:      `Votre promotion "${promo.nom}" (code : ${promo.code}) expire aujourd'hui à ${heure}.`,
        });
      } catch (err) {
        this.logger.error(`PROMO_ENDING_SOON échoué pour promo ${promo.id}`, err);
      }
    }
  }

  /* ════════════════════════════════════════════════════════
   * Toutes les 15 minutes — filet de sécurité prix promo
   ════════════════════════════════════════════════════════ */
  @Cron('*/15 * * * *')
  async syncPromoPrices(): Promise<void> {
    const now = new Date();

    // 1. Termine automatiquement les promos ACTIVE dont endDate est dépassée
    const expired = await this.promoRepo.find({
      where:  { status: PromoStatus.ACTIVE, endDate: LessThan(now) },
      select: ['id', 'companyId'],
    });

    if (expired.length > 0) {
      await this.promoRepo.update(expired.map(p => p.id), { status: PromoStatus.ENDED });
      this.logger.log(`PROMO_AUTO_END: ${expired.length} promotion(s) expirée(s) terminée(s) automatiquement`);
    }

    // 2. Resynchronise les entreprises impactées : celles dont une promo
    //    vient d'être auto-terminée + celles qui ont encore une promo ACTIVE
    //    (rattrape les startDate tout juste atteintes)
    const stillActive = await this.promoRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.companyId', 'companyId')
      .where('p.status = :status', { status: PromoStatus.ACTIVE })
      .getRawMany<{ companyId: string }>();

    const companyIds = new Set([
      ...expired.map(p => p.companyId),
      ...stillActive.map(c => c.companyId),
    ]);

    for (const companyId of companyIds) {
      try {
        await this.promotionsService.syncCompanyProductPromoPrices(companyId);
      } catch (err) {
        this.logger.error(`PROMO_SYNC_PRICES échoué pour company ${companyId}`, err);
      }
    }
  }
}
