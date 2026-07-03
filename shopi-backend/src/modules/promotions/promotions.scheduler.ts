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
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';

import {
  Promotion,
  PromoStatus,
} from '../../database/entities/entreprise.table/promotion.entity';
import { NotificationType } from '../../database/entities/notification/notification.entitiy';
import { NotificationEventService } from '../notifications/events/notification-event.service';

@Injectable()
export class PromotionsScheduler {

  private readonly logger = new Logger(PromotionsScheduler.name);

  constructor(
    @InjectRepository(Promotion) private readonly promoRepo: Repository<Promotion>,
    private readonly notifEventSvc: NotificationEventService,
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
}
