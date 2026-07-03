/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/produits/products.scheduler.ts
 *
 * RÔLE : Tâches planifiées liées aux stocks des produits.
 *
 *   checkStockAlerts — tous les jours à 08h00
 *     → STOCK_CRITICAL : produits avec stock = 0 (rupture)
 *     → STOCK_LOW      : produits avec stock > 0 et stock <= seuil
 *
 *   groupKey = ${type}:${productId}
 *     Empêche les doublons si le CRON tourne plusieurs fois
 *     dans la journée (ex: rollout ou redémarrage du process).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron }               from '@nestjs/schedule';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';

import {
  Product,
  ProductVisibility,
} from 'src/database/entities/entreprise.table/product.entity';
import { NotificationType }         from 'src/database/entities/notification/notification.entitiy';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';

@Injectable()
export class ProductsScheduler {

  private readonly logger = new Logger(ProductsScheduler.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly notifEventSvc: NotificationEventService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * Tous les jours à 08h00 — alertes de stock
   ════════════════════════════════════════════════════════ */
  @Cron('0 8 * * *')
  async checkStockAlerts(): Promise<void> {
    await Promise.all([
      this.notifyCritical(),
      this.notifyLow(),
    ]);
  }

  // ── Rupture totale (stock = 0) ─────────────────────────

  private async notifyCritical(): Promise<void> {
    const products = await this.productRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.companyId', 'p.nom', 'p.stock'])
      .where('p.stock = 0')
      .andWhere('p.visibilite != :draft', { draft: ProductVisibility.DRAFT })
      .getMany();

    if (products.length === 0) return;

    this.logger.log(`STOCK_CRITICAL: ${products.length} produit(s) en rupture`);

    for (const product of products) {
      try {
        void this.notifEventSvc.notifyStockAlert({
          companyId:   product.companyId,
          productId:   product.id,
          productName: product.nom,
          stock:       product.stock,
          type:        NotificationType.STOCK_CRITICAL,
        });
      } catch (err) {
        this.logger.error(`STOCK_CRITICAL échoué pour produit ${product.id}`, err);
      }
    }
  }

  // ── Stock faible (0 < stock <= seuil) ─────────────────

  private async notifyLow(): Promise<void> {
    const products = await this.productRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.companyId', 'p.nom', 'p.stock'])
      .where('p.stock > 0')
      .andWhere('p.seuil IS NOT NULL')
      .andWhere('p.stock <= p.seuil')
      .andWhere('p.visibilite != :draft', { draft: ProductVisibility.DRAFT })
      .getMany();

    if (products.length === 0) return;

    this.logger.log(`STOCK_LOW: ${products.length} produit(s) sous le seuil`);

    for (const product of products) {
      try {
        void this.notifEventSvc.notifyStockAlert({
          companyId:   product.companyId,
          productId:   product.id,
          productName: product.nom,
          stock:       product.stock,
          type:        NotificationType.STOCK_LOW,
        });
      } catch (err) {
        this.logger.error(`STOCK_LOW échoué pour produit ${product.id}`, err);
      }
    }
  }
}
