/* ============================================================
 * FICHIER : src/modules/resolution-engine/services/dispute-manager.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Gère le cycle de vie principal d'un litige :
 *   - Ouverture (validation fenêtre, unicité, EscrowEngine.ouvrirLitige)
 *   - Prise en charge admin (OPEN → UNDER_REVIEW)
 *   - Demande de preuves (→ WAITING_FOR_EVIDENCE)
 *   - Passage en décision (→ DECISION_PENDING)
 *   - Escalade super admin
 *   - Fermeture forcée
 *   - Listage / recherche
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, DataSource, Not, In } from 'typeorm';

import { Dispute, DisputeStatus }  from '../../../database/entities/paiement/dispute.entity';
import { DisputeHistory, DisputeActorRole } from '../../../database/entities/paiement/dispute-history.entity';
import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { Escrow }                  from '../../../database/entities/paiement/escrow.entity';
import { PlatformSettings }        from '../../../database/entities/platform-settings.entity';

import { EscrowEngine }   from '../../escrow-engine/escrow.engine';
import { EscrowTrigger }  from '../../../database/entities/paiement/escrow.entity';

import { ResolutionEventBus } from '../events/resolution-event-bus.service';
import { RESOLUTION_EVENTS, DisputeOpenedEvent } from '../events/resolution.events';
import { ResolutionHistoryService } from './resolution-history.service';
import {
  ResolutionErreur, ResolutionErreurType,
  OuvertureDisputeContext, PriseEnChargeContext,
  DemandePreuvesContext, PassageDecisionContext,
  FermetureContext, EscaladeContext,
  DisputeOuvertureResult, DisputeListFilter,
  DISPUTE_TRANSITIONS, DISPUTE_FINAL_STATES,
} from '../types/resolution-engine.types';

@Injectable()
export class DisputeManagerService {

  private readonly logger = new Logger(DisputeManagerService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,

    private readonly escrowEngine:   EscrowEngine,
    private readonly eventBus:       ResolutionEventBus,
    private readonly historyService: ResolutionHistoryService,
    private readonly dataSource:     DataSource,
  ) {}

  /* ════════════════════════════════════════════════════════
   * OUVERTURE D'UN LITIGE
   ════════════════════════════════════════════════════════ */

  async ouvrir(ctx: OuvertureDisputeContext): Promise<DisputeOuvertureResult> {
    /* ── 1. Charger la commande ─────────────────────────── */
    const commande = await this.commandeRepo.findOne({
      where: { id: ctx.commandeId },
    });
    if (!commande) {
      throw new ResolutionErreur(
        ResolutionErreurType.COMMANDE_INTROUVABLE,
        `Commande introuvable : ${ctx.commandeId}`,
      );
    }

    /* ── 2. Statut commande : doit être DELIVERED / AUTO_DELIVERED ── */
    const statusLivrables: CommandeStatus[] = [
      CommandeStatus.DELIVERED,
      CommandeStatus.AUTO_DELIVERED,
      CommandeStatus.DISPUTED,
    ];
    if (!statusLivrables.includes(commande.status)) {
      throw new ResolutionErreur(
        ResolutionErreurType.COMMANDE_NON_LIVREE,
        `Le litige nécessite une commande livrée. Statut actuel : ${commande.status}`,
        { commandeId: ctx.commandeId, status: commande.status },
      );
    }

    /* ── 3. Fenêtre de litige ───────────────────────────── */
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    const windowDays = settings?.disputeWindowDays ?? 7;
    const slahours   = settings?.disputeInstructionSlaHours ?? 48;

    if (commande.dateLivraisonEffective) {
      const expiry = new Date(commande.dateLivraisonEffective);
      expiry.setDate(expiry.getDate() + windowDays);
      if (new Date() > expiry) {
        throw new ResolutionErreur(
          ResolutionErreurType.FENETRE_EXPIREE,
          `La fenêtre de litige est expirée (${windowDays} jours après livraison)`,
          { dateLivraison: commande.dateLivraisonEffective, expiry },
        );
      }
    }

    /* ── 4. Unicité : 1 seul litige actif par commande ──── */
    const active = await this.disputeRepo.findOne({
      where: {
        commandeId: ctx.commandeId,
        status: Not(In([DisputeStatus.CLOSED, DisputeStatus.REJECTED, DisputeStatus.REFUNDED])),
      },
    });
    if (active) {
      throw new ResolutionErreur(
        ResolutionErreurType.DISPUTE_DEJA_ACTIF,
        `Un litige actif existe déjà pour cette commande : ${active.id}`,
        { existingDisputeId: active.id },
      );
    }

    /* ── 5. Générer la référence DSP-YYYY-NNNNN ─────────── */
    const year  = new Date().getFullYear();
    const count = await this.disputeRepo.count();
    const reference = `DSP-${year}-${String(count + 1).padStart(5, '0')}`;

    /* ── 6. Calculer la deadline d'instruction ──────────── */
    const deadlineAt = new Date();
    deadlineAt.setHours(deadlineAt.getHours() + slahours);

    /* ── 7. Créer le Dispute en transaction ─────────────── */
    const dispute = await this.dataSource.transaction(async (manager) => {
      const d = manager.create(Dispute, {
        reference,
        commandeId:      ctx.commandeId,
        commandeNumero:  commande.numero,
        clientUserId:    ctx.clientUserId,
        motif:           ctx.motif,
        description:     ctx.description,
        montantConteste: ctx.montantConteste,
        savTicketId:     ctx.savTicketId ?? null,
        status:          DisputeStatus.OPEN,
        deadlineAt,
        sessionId:       null,
        escalatedAt:     null,
        resolvedAt:      null,
        closedAt:        null,
        decision:        null,
        decisionMotif:   null,
        montantRembourse: null,
      });
      const saved = await manager.save(Dispute, d);

      /* Marquer la commande DISPUTED */
      await manager.update(Commande, ctx.commandeId, { status: CommandeStatus.DISPUTED });

      return saved;
    });

    /* ── 8. EscrowEngine.ouvrirLitige() ─────────────────── */
    const escrow = await this.escrowRepo.findOne({ where: { commandeId: ctx.commandeId } });
    if (escrow) {
      try {
        await this.escrowEngine.ouvrirLitige({
          escrowId:          escrow.id,
          disputeId:         dispute.id,
          triggeredByUserId: ctx.clientUserId,
        });
      } catch (err) {
        this.logger.error(`[Dispute] EscrowEngine.ouvrirLitige() échoué :`, err);
      }
    } else {
      this.logger.warn(`[Dispute] Aucun escrow pour commande ${ctx.commandeId}`);
    }

    /* ── 9. Historique + événements ─────────────────────── */
    setImmediate(() => {
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus:  null,
        toStatus:    DisputeStatus.OPEN,
        actorUserId: ctx.clientUserId,
        actorRole:   DisputeActorRole.CLIENT,
        note:        `Ouverture : ${ctx.motif}`,
      }).catch(() => {});
    });

    this.eventBus.emit(
      RESOLUTION_EVENTS.DISPUTE_OPENED,
      new DisputeOpenedEvent(
        dispute.id,
        ctx.commandeId,
        reference,
        ctx.clientUserId,
        ctx.motif,
        ctx.montantConteste,
      ),
    );

    this.logger.log(`[Dispute] ✅ Ouverture ${reference} — commande ${commande.numero}`);

    return {
      disputeId:  dispute.id,
      reference,
      commandeId: ctx.commandeId,
      status:     DisputeStatus.OPEN,
      deadlineAt,
    };
  }

  /* ════════════════════════════════════════════════════════
   * PRISE EN CHARGE ADMIN (OPEN → UNDER_REVIEW)
   ════════════════════════════════════════════════════════ */

  async prendreEnCharge(ctx: PriseEnChargeContext): Promise<Dispute> {
    const dispute = await this._chargerDispute(ctx.disputeId);
    this._validerTransition(dispute.status, DisputeStatus.UNDER_REVIEW);

    dispute.status    = DisputeStatus.UNDER_REVIEW;
    dispute.adminUserId = ctx.adminUserId;
    const saved = await this.disputeRepo.save(dispute);

    setImmediate(() => {
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus:  DisputeStatus.OPEN,
        toStatus:    DisputeStatus.UNDER_REVIEW,
        actorUserId: ctx.adminUserId,
        actorRole:   DisputeActorRole.ADMIN,
        note:        ctx.note ?? null,
      }).catch(() => {});
    });

    return saved;
  }

  /* ════════════════════════════════════════════════════════
   * DEMANDE DE PREUVES (→ WAITING_FOR_EVIDENCE)
   ════════════════════════════════════════════════════════ */

  async demanderPreuves(ctx: DemandePreuvesContext): Promise<Dispute> {
    const dispute   = await this._chargerDispute(ctx.disputeId);
    const fromStatus = dispute.status;
    this._validerTransition(fromStatus, DisputeStatus.WAITING_FOR_EVIDENCE);

    dispute.status = DisputeStatus.WAITING_FOR_EVIDENCE;
    const saved = await this.disputeRepo.save(dispute);

    setImmediate(() => {
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus,
        toStatus:    DisputeStatus.WAITING_FOR_EVIDENCE,
        actorUserId: ctx.adminUserId,
        actorRole:   DisputeActorRole.ADMIN,
        note:        ctx.note ?? null,
      }).catch(() => {});
    });

    return saved;
  }

  /* ════════════════════════════════════════════════════════
   * PASSAGE EN DÉCISION (→ DECISION_PENDING)
   ════════════════════════════════════════════════════════ */

  async passerEnDecision(ctx: PassageDecisionContext): Promise<Dispute> {
    const dispute    = await this._chargerDispute(ctx.disputeId);
    const fromStatus = dispute.status;
    this._validerTransition(fromStatus, DisputeStatus.DECISION_PENDING);

    dispute.status = DisputeStatus.DECISION_PENDING;
    const saved = await this.disputeRepo.save(dispute);

    setImmediate(() => {
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus,
        toStatus:    DisputeStatus.DECISION_PENDING,
        actorUserId: ctx.adminUserId,
        actorRole:   DisputeActorRole.ADMIN,
        note:        ctx.note ?? 'Passage en décision',
      }).catch(() => {});
    });

    return saved;
  }

  /* ════════════════════════════════════════════════════════
   * ESCALADE SUPER ADMIN
   ════════════════════════════════════════════════════════ */

  async escalader(ctx: EscaladeContext): Promise<Dispute> {
    const dispute = await this._chargerDispute(ctx.disputeId);

    if (DISPUTE_FINAL_STATES.has(dispute.status)) {
      throw new ResolutionErreur(
        ResolutionErreurType.ETAT_FINAL_IRREVOCABLE,
        `Impossible d'escalader un litige en état final : ${dispute.status}`,
      );
    }

    dispute.escalatedAt = new Date();
    const saved = await this.disputeRepo.save(dispute);

    setImmediate(() => {
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus:  dispute.status,
        toStatus:    dispute.status,
        actorUserId: ctx.adminUserId,
        actorRole:   DisputeActorRole.ADMIN,
        note:        ctx.note ?? 'Escalade super admin',
        metadata:    { escalated: true },
      }).catch(() => {});
    });

    this.logger.warn(`[Dispute] ⚠️ Escalade super admin — ${dispute.reference}`);
    return saved;
  }

  /* ════════════════════════════════════════════════════════
   * FERMETURE FORCÉE (→ CLOSED)
   ════════════════════════════════════════════════════════ */

  async fermer(ctx: FermetureContext): Promise<Dispute> {
    const dispute    = await this._chargerDispute(ctx.disputeId);
    const fromStatus = dispute.status;
    this._validerTransition(fromStatus, DisputeStatus.CLOSED);

    dispute.status   = DisputeStatus.CLOSED;
    dispute.closedAt = new Date();
    const saved = await this.disputeRepo.save(dispute);

    setImmediate(() => {
      this.historyService.enregistrer({
        disputeId:   dispute.id,
        fromStatus,
        toStatus:    DisputeStatus.CLOSED,
        actorUserId: ctx.actorUserId,
        actorRole:   ctx.actorRole === 'CLIENT' ? DisputeActorRole.CLIENT
                   : ctx.actorRole === 'SYSTEM' ? DisputeActorRole.SYSTEM
                   : DisputeActorRole.ADMIN,
        note:        ctx.note ?? null,
      }).catch(() => {});
    });

    return saved;
  }

  /* ════════════════════════════════════════════════════════
   * CONSULTATION
   ════════════════════════════════════════════════════════ */

  async findById(id: string): Promise<Dispute> {
    return this._chargerDispute(id);
  }

  async lister(filter: DisputeListFilter): Promise<{ data: Dispute[]; total: number }> {
    const qb = this.disputeRepo.createQueryBuilder('d');

    if (filter.status)       qb.andWhere('d.status = :status', { status: filter.status });
    if (filter.commandeId)   qb.andWhere('d.commandeId = :cid', { cid: filter.commandeId });
    if (filter.clientUserId) qb.andWhere('d.clientUserId = :uid', { uid: filter.clientUserId });
    if (filter.adminUserId)  qb.andWhere('d.adminUserId = :aid', { aid: filter.adminUserId });
    if (filter.fromDate)     qb.andWhere('d.createdAt >= :from', { from: filter.fromDate });
    if (filter.toDate)       qb.andWhere('d.createdAt <= :to',   { to: filter.toDate });

    qb.orderBy('d.createdAt', 'DESC');
    const limit = filter.limit ?? 20;
    const page  = filter.page  ?? 1;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  /* ════════════════════════════════════════════════════════
   * UTILITAIRES PRIVÉS
   ════════════════════════════════════════════════════════ */

  async _chargerDispute(id: string): Promise<Dispute> {
    const d = await this.disputeRepo.findOne({ where: { id } });
    if (!d) {
      throw new ResolutionErreur(
        ResolutionErreurType.DISPUTE_INTROUVABLE,
        `Litige introuvable : ${id}`,
      );
    }
    return d;
  }

  _validerTransition(from: DisputeStatus, to: DisputeStatus): void {
    if (DISPUTE_FINAL_STATES.has(from)) {
      throw new ResolutionErreur(
        ResolutionErreurType.ETAT_FINAL_IRREVOCABLE,
        `Litige en état final irréversible : ${from}`,
      );
    }
    const allowed = DISPUTE_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ResolutionErreur(
        ResolutionErreurType.TRANSITION_INVALIDE,
        `Transition invalide : ${from} → ${to}. Autorisées : [${allowed.join(', ')}]`,
      );
    }
  }
}
