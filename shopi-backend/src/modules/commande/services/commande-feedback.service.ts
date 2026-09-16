/* ============================================================
 * FICHIER : src/modules/commande/services/commande-feedback.service.ts
 *
 * RÔLE : retours de fin de commande (notations + litiges).
 *   - envoyerNotations  : POST /commandes/:id/notes
 *     → Sauvegarde l'avis dans company_avis
 *     → Met à jour averageRating + totalRatings sur Company
 *   - signalerProbleme  : POST /commandes/:id/litige
 * ============================================================ */

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User }        from '../../../database/entities/user.entity';
import { Commande, CommandeStatus, LivreurAssignmentStatus } from '../../../database/entities/commande/commande.entity';
import { Company }     from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }    from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { Client }      from '../../../database/entities/profiles/client-profile.entity';
import { CompanyAvis } from '../../../database/entities/entreprise.table/company-avis.entity';
import { LivreurAvis } from '../../../database/entities/livreur.table/livreur-avis.entity';
import { CorrespondantAvis } from '../../../database/entities/correspondant.table/correspondant-avis.entity';
import { NotificationActorType } from '../../../database/entities/notification/notification.entitiy';
import { NotificationEventService } from '../../notifications/events/notification-event.service';

import { EnvoyerNotationsDto, LitigeDto } from '../dto/notation.dto';

interface ClientSnapshot {
  clientNom:       string;
  clientInitiales: string;
}

@Injectable()
export class CommandeFeedbackService {
  constructor(
    @InjectRepository(Commande)    private readonly commandeRepo:   Repository<Commande>,
    @InjectRepository(Company)     private readonly companyRepo:    Repository<Company>,
    @InjectRepository(Delivery)    private readonly deliveryRepo:   Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly correspondantRepo: Repository<Correspondent>,
    @InjectRepository(Client)      private readonly clientRepo:     Repository<Client>,
    @InjectRepository(CompanyAvis) private readonly avisRepo:       Repository<CompanyAvis>,
    @InjectRepository(LivreurAvis) private readonly livreurAvisRepo: Repository<LivreurAvis>,
    @InjectRepository(CorrespondantAvis) private readonly correspondantAvisRepo: Repository<CorrespondantAvis>,
    private readonly notifEventSvc: NotificationEventService,
  ) {}

  /** Snapshot nom/initiales du client au moment de l'avis — partagé entre
   *  la note entreprise et la note livreur d'une même commande. */
  private buildClientSnapshot(user: User): ClientSnapshot {
    let clientNom       = 'Client Shopi';
    let clientInitiales = 'C';
    try {
      const firstName = user.firstName ?? '';
      const lastName  = user.lastName  ?? '';
      const fullName  = `${firstName} ${lastName}`.trim();
      if (fullName) {
        clientNom = fullName;
        clientInitiales = [firstName[0], lastName[0]]
          .filter(Boolean)
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'C';
      }
    } catch { /* silencieux */ }
    return { clientNom, clientInitiales };
  }

  /* ════════════════════════════════════════════════════════
   * POST /commandes/:id/notes
   ════════════════════════════════════════════════════════ */
  async envoyerNotations(
    commandeId: string,
    user: User,
    dto: EnvoyerNotationsDto,
  ): Promise<{ ok: boolean }> {

    /* 1. Vérifier la commande */
    const commande = await this.commandeRepo.findOne({
      where:  { id: commandeId },
      select: ['id', 'companyId', 'clientId', 'status', 'livreurId', 'livreurAssignmentStatus', 'correspondantId'],
    });
    if (!commande) throw new NotFoundException('Commande introuvable.');

    /* Autorisation — seul le client de la commande peut la noter. Sans ce
     * contrôle, n'importe quel utilisateur authentifié pouvait soumettre
     * un avis (avec son propre nom en snapshot) sur la commande d'un
     * tiers et fausser la note moyenne de l'entreprise concernée. */
    const actorId = (user as any).actorId as string | undefined;
    if (commande.clientId !== actorId) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }

    /* 2. Note de l'entreprise */
    const entrepriseNote = dto.notes.find(n => n.role === 'entreprise');

    /* BUG CORRIGÉ — Company.allowReviews (Paramètres > Catalogue,
     * "Autoriser les avis clients") était enregistré mais jamais lu :
     * même désactivé, un acheteur confirmé pouvait toujours laisser un
     * avis. La restriction "acheteur confirmé uniquement" (vérifiée
     * juste au-dessus via commande.clientId === actorId) reste, elle,
     * indépendante de ce toggle — les deux se cumulent. */
    const allowReviews = entrepriseNote && commande.companyId
      ? (await this.companyRepo.findOne({
          where: { id: commande.companyId }, select: ['allowReviews'],
        }))?.allowReviews ?? true
      : true;

    if (entrepriseNote && commande.companyId && allowReviews) {

      /* 3. Nom du client (snapshot) */
      const { clientNom, clientInitiales } = this.buildClientSnapshot(user);

      /* 4. Sauvegarder l'avis (ignore si déjà existant pour cette commande) */
      const existingAvis = await this.avisRepo.findOne({ where: { commandeId } });
      if (!existingAvis) {
        const avis = this.avisRepo.create({
          companyId:       commande.companyId,
          commandeId,
          clientNom,
          clientInitiales,
          note:            entrepriseNote.note,
          commentaire:     entrepriseNote.commentaire ?? null,
        });
        await this.avisRepo.save(avis);

        void this.notifEventSvc.notifyReviewReceived({
          companyId:  commande.companyId,
          clientId:   commande.clientId,
          clientNom,
          note:       entrepriseNote.note,
          commandeId,
        });
      }

      /* 5. Mettre à jour la moyenne glissante sur Company */
      const company = await this.companyRepo.findOne({
        where:  { id: commande.companyId },
        select: ['id', 'averageRating', 'totalRatings'],
      });
      if (company && !existingAvis) {
        const oldTotal = company.totalRatings ?? 0;
        const oldAvg   = Number(company.averageRating) || 0;
        const newTotal = oldTotal + 1;
        const newAvg   = parseFloat(
          ((oldAvg * oldTotal + entrepriseNote.note) / newTotal).toFixed(2),
        );
        company.averageRating = newAvg;
        company.totalRatings  = newTotal;
        await this.companyRepo.save(company);
      }
    }

    /* 6. Note du livreur — miroir du bloc entreprise ci-dessus, pour
     * l'acteur DELIVERY. N'a de sens QUE si un livreur a réellement pris
     * en charge cette commande (livreurId renseigné ET son assignation
     * ACCEPTED — un livreur PENDING n'a jamais livré, et un livreur
     * REFUSED voit `livreurId` remis à null par CommandeLivreurAssignment
     * Service, donc ce filtre exclut déjà ce cas). Avant ce correctif,
     * une note "livreur" était acceptée par la validation (le DTO
     * autorise role:'livreur') mais silencieusement ignorée ici : aucun
     * avis, aucune notification, aucune mise à jour de Delivery.averageRating. */
    const livreurNote = dto.notes.find(n => n.role === 'livreur');
    if (
      livreurNote &&
      commande.livreurId &&
      commande.livreurAssignmentStatus === LivreurAssignmentStatus.ACCEPTED
    ) {
      const { clientNom, clientInitiales } = this.buildClientSnapshot(user);

      const existingLivreurAvis = await this.livreurAvisRepo.findOne({ where: { commandeId } });
      if (!existingLivreurAvis) {
        const avis = this.livreurAvisRepo.create({
          livreurId:   commande.livreurId,
          commandeId,
          clientNom,
          clientInitiales,
          note:        livreurNote.note,
          commentaire: livreurNote.commentaire ?? null,
        });
        await this.livreurAvisRepo.save(avis);

        void this.notifEventSvc.notifyLivreurReviewReceived({
          livreurId:  commande.livreurId,
          clientId:   commande.clientId,
          clientNom,
          note:       livreurNote.note,
          commandeId,
        });
      }

      const delivery = await this.deliveryRepo.findOne({
        where:  { id: commande.livreurId },
        select: ['id', 'averageRating', 'totalRatings'],
      });
      if (delivery && !existingLivreurAvis) {
        const oldTotal = delivery.totalRatings ?? 0;
        const oldAvg   = Number(delivery.averageRating) || 0;
        const newTotal = oldTotal + 1;
        const newAvg   = parseFloat(
          ((oldAvg * oldTotal + livreurNote.note) / newTotal).toFixed(2),
        );
        delivery.averageRating = newAvg;
        delivery.totalRatings  = newTotal;
        await this.deliveryRepo.save(delivery);
      }
    }

    /* 7. Note du correspondant — même miroir, pour l'acteur CORRESPONDENT.
     * Pas d'équivalent de LivreurAssignmentStatus ici : un correspondant
     * n'a pas de flux d'acceptation/refus séparé (contrairement au
     * livreur) — dès que la commande atteint l'état "terminée" (seul
     * moment où ce formulaire de notation est proposé, voir DoneBanner/
     * RatingModal), un correspondantId renseigné a nécessairement déjà
     * validé son code (la chaîne de validation ne peut pas se terminer
     * sinon). commande.correspondantId truthy suffit donc. */
    const correspondantNote = dto.notes.find(n => n.role === 'correspondant');
    if (correspondantNote && commande.correspondantId) {
      const { clientNom, clientInitiales } = this.buildClientSnapshot(user);

      const existingCorAvis = await this.correspondantAvisRepo.findOne({ where: { commandeId } });
      if (!existingCorAvis) {
        const avis = this.correspondantAvisRepo.create({
          correspondantId: commande.correspondantId,
          commandeId,
          clientNom,
          clientInitiales,
          note:        correspondantNote.note,
          commentaire: correspondantNote.commentaire ?? null,
        });
        await this.correspondantAvisRepo.save(avis);

        void this.notifEventSvc.notifyCorrespondantReviewReceived({
          correspondantId: commande.correspondantId,
          clientId:        commande.clientId,
          clientNom,
          note:             correspondantNote.note,
          commandeId,
        });
      }

      const correspondant = await this.correspondantRepo.findOne({
        where:  { id: commande.correspondantId },
        select: ['id', 'averageRating', 'totalRatings'],
      });
      if (correspondant && !existingCorAvis) {
        const oldTotal = correspondant.totalRatings ?? 0;
        const oldAvg   = Number(correspondant.averageRating) || 0;
        const newTotal = oldTotal + 1;
        const newAvg   = parseFloat(
          ((oldAvg * oldTotal + correspondantNote.note) / newTotal).toFixed(2),
        );
        correspondant.averageRating = newAvg;
        correspondant.totalRatings  = newTotal;
        await this.correspondantRepo.save(correspondant);
      }
    }

    return { ok: true };
  }

  /* ════════════════════════════════════════════════════════
   * POST /commandes/:id/litige
   ════════════════════════════════════════════════════════ */
  async signalerProbleme(
    commandeId: string,
    user: User,
    _dto: LitigeDto,
  ): Promise<{ ok: boolean }> {
    const commande = await this.commandeRepo.findOne({ where: { id: commandeId } });
    if (!commande) throw new NotFoundException('Commande introuvable.');

    /* Autorisation — seul un acteur impliqué dans la commande (client,
     * entreprise, livreur, correspondant, partenaire) peut signaler un
     * litige. Sans ce contrôle, n'importe quel utilisateur authentifié
     * pouvait faire passer une commande tierce en statut DISPUTED. */
    const actorId = (user as any).actorId as string | undefined;
    const isInvolved =
      commande.clientId === actorId ||
      commande.companyId === actorId ||
      commande.livreurId === actorId ||
      commande.correspondantId === actorId ||
      commande.partenaireId === actorId;
    if (!isInvolved) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }

    commande.status = CommandeStatus.DISPUTED;
    await this.commandeRepo.save(commande);

    void this.notifEventSvc.notifyOrderStatusChanged({
      recipientType: NotificationActorType.COMPANY,
      recipientId:   commande.companyId,
      actorType:     NotificationActorType.CLIENT,
      actorId:       commande.clientId,
      orderRef:      commande.numero,
      commandeId:    commande.id,
      newStatus:     CommandeStatus.DISPUTED,
      title:         'Litige signalé ⚠️',
      body:          `Un problème a été signalé sur la commande ${commande.numero}.`,
    });

    return { ok: true };
  }
}
