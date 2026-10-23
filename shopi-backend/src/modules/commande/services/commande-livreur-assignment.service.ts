/* ============================================================
 * FICHIER : src/modules/commande/services/commande-livreur-assignment.service.ts
 *
 * RÔLE : cycle d'acceptation du livreur sur une commande, et
 * assignation/réassignation du livreur par le client ou l'entreprise.
 *
 *   - accepter()          → PATCH /livreur/missions/:id/accepter
 *   - refuser()            → PATCH /livreur/missions/:id/refuser
 *   - assignerParEntreprise() → PATCH /entreprise/commandes/:id/livreur
 *   - assignerParClient()     → PATCH /client/commandes/:id/livreur
 *
 * Groupe de livraison de la commande tenu à jour : un livreur réaffecté y
 * entre (l'ancien en sort), un livreur qui refuse la mission en sort.
 * Le code de validation LIVREUR n'est créé QUE dans accepter() —
 * tant que le livreur n'a pas répondu, aucun code n'existe pour ce
 * rôle (voir commande-creation.service.ts, qui ne le crée plus non
 * plus à la création de la commande).
 * ============================================================ */

import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserStatus } from '../../../database/entities/user.entity';
import {
  Commande, CommandeStatus, LivreurAssignmentStatus,
} from '../../../database/entities/commande/commande.entity';
import {
  CommandeCode, CodeActeurType, CodeCommandeStatus,
} from '../../../database/entities/commande/commande-code.entity';
import { Delivery, DeliveryStatus } from '../../../database/entities/profiles/livreur-profile.entity';
import { Client } from '../../../database/entities/profiles/client-profile.entity';
import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';
import { NotificationActorType } from 'src/database/entities/notification/notification.entity';
import { CODE_EXPIRY_MS, genererCode } from './commande.helpers';
import { DeliveryGroupService } from '../../delivery-group/delivery-group.service';

@Injectable()
export class CommandeLivreurAssignmentService {

  constructor(
    @InjectRepository(Commande)     private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(CommandeCode) private readonly codeRepo: Repository<CommandeCode>,
    @InjectRepository(Delivery)     private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Client)       private readonly clientRepo: Repository<Client>,
    @InjectRepository(Company)      private readonly companyRepo: Repository<Company>,
    private readonly notifEventSvc: NotificationEventService,
    /* Groupe de livraison de la commande (membres à jour) — facultatif */
    @Optional() private readonly deliveryGroupSvc?: DeliveryGroupService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // LIVREUR — accepte / refuse la mission qui lui est assignée
  // ══════════════════════════════════════════════════════════════

  async accepter(user: User, commandeId: string) {
    const delivery = await this.resolveDelivery(user);
    /* Activité en pause (Paramètres > Zone sensible) : comme pour les missions diffusées */
    if (delivery.suspendedUntil) {
      throw new ForbiddenException('Votre activité est en pause : reprenez-la pour accepter une mission.');
    }
    const commande = await this.loadAssignedCommande(commandeId, delivery.id);

    const now      = new Date();
    const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MS);

    const code = this.codeRepo.create({
      commandeId: commande.id,
      code:       genererCode(),
      acteurType: CodeActeurType.LIVREUR,
      acteurId:   delivery.userId,
      acteurNom:  delivery.fullName,
      ordre:      2,
      status:     CodeCommandeStatus.PENDING,
      expiresAt,
    });
    await this.codeRepo.save(code);

    commande.livreurAssignmentStatus = LivreurAssignmentStatus.ACCEPTED;
    commande.livreurRespondedAt      = now;
    await this.commandeRepo.save(commande);

    void this.notifyAssigner(commande, delivery, 'accepted');

    return { ok: true, livreurAssignmentStatus: commande.livreurAssignmentStatus };
  }

  async refuser(user: User, commandeId: string, reason: string) {
    const delivery = await this.resolveDelivery(user);
    const commande = await this.loadAssignedCommande(commandeId, delivery.id);

    const now = new Date();
    const refusingLivreurId = commande.livreurId;
    commande.livreurId               = null;
    commande.livreurAssignmentStatus = LivreurAssignmentStatus.REFUSED;
    commande.livreurRefusalReason    = reason;
    commande.livreurRespondedAt      = now;
    await this.commandeRepo.save(commande);

    /* Il ne livre pas : il quitte le groupe de la commande (plus d'accès à la discussion) */
    if (refusingLivreurId) void this.deliveryGroupSvc?.removeLivreurFromOrderGroup(commande.id, refusingLivreurId);

    void this.notifyAssigner(commande, delivery, 'refused');

    return { ok: true };
  }

  private async loadAssignedCommande(commandeId: string, deliveryId: string): Promise<Commande> {
    const commande = await this.commandeRepo.findOne({ where: { id: commandeId } });
    if (!commande) throw new NotFoundException('Commande introuvable.');
    if (commande.livreurId !== deliveryId) {
      throw new ForbiddenException('Cette mission ne vous est pas assignée.');
    }
    if (commande.livreurAssignmentStatus !== LivreurAssignmentStatus.PENDING) {
      throw new BadRequestException("Cette mission n'est plus en attente d'acceptation.");
    }
    if ([CommandeStatus.CANCELLED, CommandeStatus.REFUNDED, CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED].includes(commande.status)) {
      throw new BadRequestException('Cette commande est terminée ou annulée.');
    }
    return commande;
  }

  private async notifyAssigner(commande: Commande, delivery: Delivery, action: 'accepted' | 'refused') {
    const isClient      = commande.livreurAssignedBy === 'client';
    const recipientType = isClient ? NotificationActorType.CLIENT : NotificationActorType.COMPANY;
    const recipientId   = isClient ? commande.clientId : commande.companyId;
    const nom            = delivery.fullName ?? 'Le livreur';

    const title = action === 'accepted'
      ? 'Livreur confirmé ✅'
      : 'Livreur indisponible — à réassigner ⚠️';
    const body = action === 'accepted'
      ? `${nom} a accepté la commande ${commande.numero}.`
      : `${nom} a refusé la commande ${commande.numero}` +
        `${commande.livreurRefusalReason ? ` (${commande.livreurRefusalReason})` : ''} ` +
        `— veuillez choisir un autre livreur.`;

    void this.notifEventSvc.notifyOrderStatusChanged({
      recipientType,
      recipientId,
      actorType:  NotificationActorType.DELIVERY,
      actorId:    delivery.id,
      orderRef:   commande.numero,
      commandeId: commande.id,
      newStatus:  commande.status,
      title,
      body,
    });
  }

  private async resolveDelivery(user: User): Promise<Delivery> {
    const actorId  = (user as any).actorId as string | undefined;
    let delivery = await this.deliveryRepo.findOne({ where: { userId: user.id } });
    if (!delivery && actorId) delivery = await this.deliveryRepo.findOne({ where: { id: actorId } });
    if (!delivery) throw new NotFoundException('Profil livreur introuvable.');
    return delivery;
  }

  // ══════════════════════════════════════════════════════════════
  // ENTREPRISE / CLIENT — assigner ou changer le livreur
  // ══════════════════════════════════════════════════════════════

  async assignerParEntreprise(user: User, commandeId: string, livreurId: string) {
    const actorId  = (user as any).actorId as string | undefined;
    let company = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!company && actorId) company = await this.companyRepo.findOne({ where: { id: actorId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');

    const commande = await this.commandeRepo.findOne({ where: { id: commandeId } });
    if (!commande) throw new NotFoundException('Commande introuvable.');
    if (commande.companyId !== company.id) {
      throw new ForbiddenException("Cette commande n'appartient pas à votre entreprise.");
    }

    return this.reassigner(commande, livreurId, 'company');
  }

  async assignerParClient(user: User, commandeId: string, livreurId: string) {
    const client = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!client) throw new NotFoundException('Profil client introuvable.');

    const commande = await this.commandeRepo.findOne({ where: { id: commandeId } });
    if (!commande) throw new NotFoundException('Commande introuvable.');
    if (commande.clientId !== client.id) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }
    /* Le client ne choisit un autre livreur que si le précédent a refusé
     * (ou n'a pas encore répondu) — jamais à la place d'un livreur en route. */
    if (commande.livreurAssignmentStatus === LivreurAssignmentStatus.ACCEPTED) {
      throw new BadRequestException('Le livreur a déjà accepté la mission.');
    }

    return this.reassigner(commande, livreurId, 'client');
  }

  private async reassigner(commande: Commande, livreurId: string, assignedBy: 'client' | 'company') {
    /* Commande terminée / annulée : plus de livreur à choisir */
    const fermee = [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED, CommandeStatus.CANCELLED, CommandeStatus.REFUNDED];
    if (fermee.includes(commande.status)) {
      throw new BadRequestException('Cette commande est terminée : le livreur ne peut plus être changé.');
    }
    /* Colis déjà récupéré par le livreur (son étape est validée) */
    const codeLivreur = await this.codeRepo.findOne({ where: { commandeId: commande.id, acteurType: CodeActeurType.LIVREUR } });
    if (codeLivreur?.status === CodeCommandeStatus.VALIDATED) {
      throw new BadRequestException('Le livreur a déjà récupéré le colis : il ne peut plus être changé.');
    }

    const delivery = await this.deliveryRepo.findOne({ where: { id: livreurId }, relations: ['user'] });
    if (!delivery || !delivery.user) throw new NotFoundException('Livreur introuvable.');   // compte supprimé compris
    /* BUG CORRIGÉ — n'importe quel livreur pouvait être choisi : suspendu,
     * banni, en pause ou dont le compte est fermé. */
    if (delivery.status === DeliveryStatus.SUSPENDED || delivery.status === DeliveryStatus.BANNED
        || delivery.suspendedUntil || delivery.user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Ce livreur n’est pas disponible en ce moment. Choisissez-en un autre.');
    }

    /* Un code LIVREUR déjà validé (mission acceptée) devient obsolète — on
     * l'annule proprement plutôt que de le laisser traîner en PENDING. */
    if (commande.livreurAssignmentStatus === LivreurAssignmentStatus.ACCEPTED) {
      const ancienCode = await this.codeRepo.findOne({
        where: { commandeId: commande.id, acteurType: CodeActeurType.LIVREUR },
      });
      if (ancienCode && ancienCode.status === CodeCommandeStatus.PENDING) {
        ancienCode.status = CodeCommandeStatus.CANCELLED;
        await this.codeRepo.save(ancienCode);
      }
    }

    const previousLivreurId = commande.livreurId;
    commande.livreurId               = delivery.id;
    commande.livreurAssignmentStatus = LivreurAssignmentStatus.PENDING;
    commande.livreurAssignedBy       = assignedBy;
    commande.livreurRespondedAt      = null;
    commande.livreurRefusalReason    = null;
    await this.commandeRepo.save(commande);

    /* Nouveau livreur : il entre dans le groupe de la commande (l'ancien en sort) */
    if (previousLivreurId !== delivery.id) {
      void this.deliveryGroupSvc?.handleOrderStatusChange(commande.id, commande.status, {
        newLivreurId:     delivery.id,
        newLivreurUserId: delivery.userId,
        newLivreurName:   delivery.fullName ?? 'Livreur',
      });
    }

    void this.notifEventSvc.notifyOrderStatusChanged({
      recipientType: NotificationActorType.DELIVERY,
      recipientId:   delivery.id,
      actorType:     assignedBy === 'client' ? NotificationActorType.CLIENT : NotificationActorType.COMPANY,
      actorId:       assignedBy === 'client' ? commande.clientId : commande.companyId,
      orderRef:      commande.numero,
      commandeId:    commande.id,
      newStatus:     commande.status,
      title:         'Nouvelle mission de livraison 🛵',
      body:          `Commande ${commande.numero} à livrer — merci de confirmer.`,
      kind:          'mission_assigned',
    });

    return { ok: true, livreurId: commande.livreurId, livreurAssignmentStatus: commande.livreurAssignmentStatus };
  }
}
