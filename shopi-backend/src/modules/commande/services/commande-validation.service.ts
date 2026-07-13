/* ============================================================
 * FICHIER : src/modules/commande/services/commande-validation.service.ts
 *
 * RÔLE : validation des étapes de la chaîne (codes acteurs).
 *   - validerEtape : POST /commandes/:id/valider
 * ============================================================ */

import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../../database/entities/user.entity';
import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import {
  CommandeCode, CodeActeurType, CodeCommandeStatus,
} from '../../../database/entities/commande/commande-code.entity';

import { ValiderEtapeDto } from '../dto/valider-etape.dto';
import { CODE_EXPIRY_MS } from './commande.helpers';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';
import { NotificationActorType } from 'src/database/entities/notification/notification.entitiy';
import { DeliveryGroupService } from 'src/modules/delivery-group/delivery-group.service';

@Injectable()
export class CommandeValidationService {
  constructor(
    @InjectRepository(Commande) private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(CommandeCode) private readonly codeRepo: Repository<CommandeCode>,
    private readonly notifEventSvc: NotificationEventService,
    private readonly deliveryGroupSvc: DeliveryGroupService,
  ) {}

  /* ════════════════════════════════════════════════════════
   * POST /commandes/:id/valider — valider le code d'une étape
   ════════════════════════════════════════════════════════ */
  async validerEtape(commandeId: string, user: User, dto: ValiderEtapeDto): Promise<{ ok: boolean; valideA: string }> {
    const commande = await this.commandeRepo.findOne({
      where: { id: commandeId },
      relations: ['codes'],
    });
    if (!commande) throw new NotFoundException('Commande introuvable.');

    const acteurType = dto.role as unknown as CodeActeurType;
    const code = commande.codes.find(c => c.acteurType === acteurType);
    if (!code) throw new NotFoundException('Code introuvable pour ce rôle.');

    if (code.acteurId !== user.id) {
      throw new ForbiddenException('Vous n\'êtes pas autorisé à valider cette étape.');
    }
    if (code.status === CodeCommandeStatus.AWAITING_UNLOCK) {
      throw new BadRequestException('Ce code n\'est pas encore disponible.');
    }
    if (code.status !== CodeCommandeStatus.PENDING) {
      throw new BadRequestException('Ce code a déjà été traité.');
    }
    if (code.expiresAt < new Date()) {
      code.status = CodeCommandeStatus.EXPIRED;
      await this.codeRepo.save(code);
      throw new BadRequestException('Ce code a expiré.');
    }
    if (code.code !== dto.code.trim().toUpperCase()) {
      code.tentativesEchouees += 1;
      if (code.tentativesEchouees >= 5) code.status = CodeCommandeStatus.EXPIRED;
      await this.codeRepo.save(code);
      throw new BadRequestException('Code invalide.');
    }

    const now = new Date();
    code.status = CodeCommandeStatus.VALIDATED;
    code.validatedAt = now;
    await this.codeRepo.save(code);

    if (acteurType === CodeActeurType.CLIENT) {
      commande.status = CommandeStatus.DELIVERED;
      commande.dateLivraisonEffective = now;
      await this.commandeRepo.save(commande);

      /* Groupe de livraison : démarrer le compte à rebours 72h */
      void this.deliveryGroupSvc.handleOrderStatusChange(commande.id, CommandeStatus.DELIVERED);

      /* Notifier l'entreprise : commande réceptionnée par le client */
      void this.notifEventSvc.notifyOrderStatusChanged({
        recipientType: NotificationActorType.COMPANY,
        recipientId:   commande.companyId,
        actorType:     NotificationActorType.CLIENT,
        actorId:       commande.clientId,
        orderRef:      commande.numero,
        commandeId:    commande.id,
        newStatus:     CommandeStatus.DELIVERED,
        title:         'Livraison confirmée ✅',
        body:          `La commande ${commande.numero} a été réceptionnée par le client.`,
      });
    } else {
      if (acteurType === CodeActeurType.ENTREPRISE) {
        commande.status = CommandeStatus.IN_PROGRESS;
        await this.commandeRepo.save(commande);

        /* Notifier le client : commande confirmée par l'entreprise */
        void this.notifEventSvc.notifyOrderStatusChanged({
          recipientType: NotificationActorType.CLIENT,
          recipientId:   commande.clientId,
          actorType:     NotificationActorType.COMPANY,
          actorId:       commande.companyId,
          orderRef:      commande.numero,
          commandeId:    commande.id,
          newStatus:     CommandeStatus.IN_PROGRESS,
          title:         'Commande confirmée ✅',
          body:          `Votre commande ${commande.numero} a été confirmée et est en cours de traitement.`,
        });
      }

      if (acteurType === CodeActeurType.LIVREUR) {
        void this.notifEventSvc.notifyOrderStatusChanged({
          recipientType: NotificationActorType.CLIENT,
          recipientId:   commande.clientId,
          actorType:     NotificationActorType.DELIVERY,
          actorId:       commande.livreurId,
          orderRef:      commande.numero,
          commandeId:    commande.id,
          newStatus:     commande.status,
          title:         'Votre commande est en route 🛵',
          body:          `Le livreur est en route avec votre commande ${commande.numero}.`,
        });
      }

      if (acteurType === CodeActeurType.CORRESPONDANT) {
        void this.notifEventSvc.notifyOrderStatusChanged({
          recipientType: NotificationActorType.CLIENT,
          recipientId:   commande.clientId,
          actorType:     NotificationActorType.CORRESPONDENT,
          actorId:       commande.correspondantId,
          orderRef:      commande.numero,
          commandeId:    commande.id,
          newStatus:     commande.status,
          title:         'Votre colis est chez le correspondant 📦',
          body:          `La commande ${commande.numero} est disponible chez votre correspondant.`,
        });
      }

      const autresValides = commande.codes
        .filter(c => c.acteurType !== CodeActeurType.CLIENT)
        .every(c => c.status === CodeCommandeStatus.VALIDATED);

      if (autresValides) {
        const codeClient = commande.codes.find(c => c.acteurType === CodeActeurType.CLIENT);
        if (codeClient && codeClient.status === CodeCommandeStatus.AWAITING_UNLOCK) {
          codeClient.status = CodeCommandeStatus.PENDING;
          codeClient.debloquéAt = now;
          codeClient.expiresAt = new Date(now.getTime() + CODE_EXPIRY_MS);
          await this.codeRepo.save(codeClient);

          commande.status = CommandeStatus.AWAITING_CLIENT;
          commande.autoValidationAt = new Date(now.getTime() + commande.autoValidationDelayDays * 24 * 3600 * 1000);
          await this.commandeRepo.save(commande);

          /* Notifier le client : son code de réception est disponible */
          void this.notifEventSvc.notifyOrderStatusChanged({
            recipientType: NotificationActorType.CLIENT,
            recipientId:   commande.clientId,
            actorType:     null,
            actorId:       null,
            orderRef:      commande.numero,
            commandeId:    commande.id,
            newStatus:     CommandeStatus.AWAITING_CLIENT,
            title:         'Votre colis est prêt 📦',
            body:          `Votre commande ${commande.numero} est prête. Validez avec votre code de réception.`,
          });
        }
      }
    }

    return { ok: true, valideA: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) };
  }
}
