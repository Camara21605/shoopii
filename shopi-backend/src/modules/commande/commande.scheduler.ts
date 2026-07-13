/* ============================================================
 * FICHIER : src/modules/commande/commande.scheduler.ts
 *
 * RÔLE : tâches planifiées liées aux commandes.
 *
 *   processAutoDelivered — toutes les 15 min
 *     → Passe en AUTO_DELIVERED toute commande AWAITING_CLIENT
 *       dont autoValidationAt est dépassé.
 *     → Notifie CLIENT + COMPANY.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { Commande, CommandeStatus } from '../../database/entities/commande/commande.entity';
import { NotificationActorType } from '../../database/entities/notification/notification.entitiy';
import { NotificationEventService } from '../notifications/events/notification-event.service';
import { DeliveryGroupService } from '../delivery-group/delivery-group.service';

@Injectable()
export class CommandeScheduler {

  private readonly logger = new Logger(CommandeScheduler.name);

  constructor(
    @InjectRepository(Commande) private readonly commandeRepo: Repository<Commande>,
    private readonly notifEventSvc: NotificationEventService,
    private readonly deliveryGroupSvc: DeliveryGroupService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * Toutes les 15 min — auto-validation des commandes
   ════════════════════════════════════════════════════════ */
  @Cron('0 */15 * * * *')
  async processAutoDelivered(): Promise<void> {
    const now = new Date();

    const commandes = await this.commandeRepo.find({
      where: {
        status:           CommandeStatus.AWAITING_CLIENT,
        autoValidationAt: LessThanOrEqual(now),
      },
    });

    if (commandes.length === 0) return;

    this.logger.log(`AUTO_DELIVERED: traitement de ${commandes.length} commande(s)`);

    for (const commande of commandes) {
      try {
        commande.status               = CommandeStatus.AUTO_DELIVERED;
        commande.dateLivraisonEffective = now;
        await this.commandeRepo.save(commande);

        void this.notifEventSvc.notifyOrderStatusChanged({
          recipientType: NotificationActorType.CLIENT,
          recipientId:   commande.clientId,
          actorType:     null,
          actorId:       null,
          orderRef:      commande.numero,
          commandeId:    commande.id,
          newStatus:     CommandeStatus.AUTO_DELIVERED,
          title:         'Commande validée automatiquement ✅',
          body:          `La commande ${commande.numero} a été validée automatiquement après le délai imparti.`,
        });

        void this.notifEventSvc.notifyOrderStatusChanged({
          recipientType: NotificationActorType.COMPANY,
          recipientId:   commande.companyId,
          actorType:     null,
          actorId:       null,
          orderRef:      commande.numero,
          commandeId:    commande.id,
          newStatus:     CommandeStatus.AUTO_DELIVERED,
          title:         'Livraison auto-validée ✅',
          body:          `La commande ${commande.numero} a été automatiquement confirmée comme livrée.`,
        });

        /* Groupe de livraison : démarrer compte à rebours 72h */
        void this.deliveryGroupSvc.handleOrderStatusChange(commande.id, CommandeStatus.AUTO_DELIVERED);
      } catch (err) {
        this.logger.error(`AUTO_DELIVERED échoué pour la commande ${commande.id}`, err);
      }
    }
  }
}
