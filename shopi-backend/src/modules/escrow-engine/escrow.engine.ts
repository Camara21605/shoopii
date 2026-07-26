/* ============================================================
 * FICHIER : src/modules/escrow-engine/escrow.engine.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Orchestrateur principal de l'Escrow Engine de Shopi.
 * Point d'entrée UNIQUE pour toutes les opérations de séquestre.
 *
 * PIPELINE
 * ------------------------------------------------------------
 *  creer()              → EscrowManagerService.creer()
 *  recevoirFonds()      → EscrowManagerService.recevoirFonds()
 *  verrouillerFonds()   → EscrowManagerService.verrouillerFonds()
 *  attendreValidation() → EscrowManagerService.attendreValidation()
 *  liberer()            → EscrowReleaseService.liberer()
 *  rembourser()         → EscrowRefundService.initierRemboursement()
 *  ouvrirLitige()       → this._ouvrirLitige()
 *  resoudreLitige()     → EscrowReleaseService | EscrowRefundService
 *  marquerEchoue()      → EscrowManagerService.marquerEchoue()
 *  marquerExpire()      → EscrowManagerService.marquerExpire()
 *
 * DÉLÉGATIONS
 * ------------------------------------------------------------
 * - WalletEngine  → pour tout mouvement financier
 * - EscrowAuditService → fire-and-forget, ne bloque jamais
 * - EscrowEventBus     → propagation événements inter-modules
 *
 * EXPORTS DU MODULE
 * ------------------------------------------------------------
 * EscrowEngine, EscrowHistoryService, EscrowEventBus
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow, EscrowStatus, EscrowTrigger } from '../../database/entities/paiement/escrow.entity';
import { EscrowHistory } from '../../database/entities/paiement/escrow-history.entity';

import { EscrowManagerService }  from './services/escrow-manager.service';
import { EscrowReleaseService }  from './services/escrow-release.service';
import { EscrowRefundService }   from './services/escrow-refund.service';
import { EscrowHistoryService }  from './services/escrow-history.service';
import { EscrowAuditService }    from './services/escrow-audit.service';
import { EscrowValidatorService } from './services/escrow-validator.service';
import { EscrowEventBus }        from './events/escrow-event-bus.service';
import { ESCROW_EVENTS, EscrowDisputedEvent, EscrowResolvedEvent } from './events/escrow.events';

import {
  EscrowCreationContext,
  EscrowFundsReceivedContext,
  EscrowLockContext,
  EscrowWaitingValidationContext,
  EscrowReleaseContext,
  EscrowRefundContext,
  EscrowDisputeContext,
  EscrowResolveContext,
  EscrowFailureContext,
  EscrowOperationResult,
  EscrowReleaseResult,
  EscrowRefundResult,
  EscrowErreur,
  EscrowErreurType,
  EscrowPage,
  EscrowFilter,
} from './types/escrow-engine.types';

@Injectable()
export class EscrowEngine {

  private readonly logger = new Logger(EscrowEngine.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(EscrowHistory)
    private readonly historyRepo: Repository<EscrowHistory>,

    private readonly managerSvc:   EscrowManagerService,
    private readonly releaseSvc:   EscrowReleaseService,
    private readonly refundSvc:    EscrowRefundService,
    private readonly historySvc:   EscrowHistoryService,
    private readonly auditSvc:     EscrowAuditService,
    private readonly validatorSvc: EscrowValidatorService,
    private readonly eventBus:     EscrowEventBus,
  ) {}

  /* ==========================================================
   * CRÉATION
   * ========================================================== */

  /**
   * Crée un nouveau séquestre (état CREATED).
   * Idempotent : si la session existe déjà, retourne l'escrow existant.
   */
  async creer(ctx: EscrowCreationContext): Promise<Escrow> {
    this.logger.log(`[Engine] creer() — commande ${ctx.commandeNumero}`);

    const escrow = await this.managerSvc.creer(ctx);

    this.auditSvc.logCreation({
      escrowId:     escrow.id,
      commandeId:   ctx.commandeId,
      montantTotal: ctx.montantTotal,
      currency:     ctx.currency,
      actorUserId:  ctx.clientUserId,
    });

    return escrow;
  }

  /* ==========================================================
   * RÉCEPTION DES FONDS
   * ========================================================== */

  /**
   * Marque l'escrow FUNDS_RECEIVED après webhook paiement confirmé.
   */
  async recevoirFonds(ctx: EscrowFundsReceivedContext): Promise<EscrowOperationResult> {
    this.logger.log(`[Engine] recevoirFonds() — escrow ${ctx.escrowId}`);
    return this.managerSvc.recevoirFonds(ctx);
  }

  /* ==========================================================
   * VERROUILLAGE
   * ========================================================== */

  /**
   * Passe l'escrow en LOCKED et crédite les wallets acteurs en pending.
   */
  async verrouillerFonds(ctx: EscrowLockContext): Promise<EscrowOperationResult> {
    this.logger.log(`[Engine] verrouillerFonds() — escrow ${ctx.escrowId}`);
    return this.managerSvc.verrouillerFonds(ctx);
  }

  /* ==========================================================
   * ATTENTE VALIDATION CLIENT
   * ========================================================== */

  /**
   * Passe l'escrow en WAITING_VALIDATION.
   * Code client envoyé, délai auto-release calculé.
   */
  async attendreValidation(ctx: EscrowWaitingValidationContext): Promise<EscrowOperationResult> {
    this.logger.log(`[Engine] attendreValidation() — escrow ${ctx.escrowId}`);
    return this.managerSvc.attendreValidation(ctx);
  }

  /* ==========================================================
   * LIBÉRATION
   * ========================================================== */

  /**
   * Libère les fonds vers les wallets acteurs (RELEASED).
   * Déclenché par : validation client, auto-release, décision admin.
   */
  async liberer(ctx: EscrowReleaseContext): Promise<EscrowReleaseResult> {
    this.logger.log(`[Engine] liberer() — escrow ${ctx.escrowId} — raison: ${ctx.releaseReason}`);

    const result = await this.releaseSvc.liberer(ctx);

    this.auditSvc.logRelease({
      escrowId:         ctx.escrowId,
      commandeId:       result.commandeId,
      montantDistribue: result.montantDistribue,
      currency:         'GNF',
      nbActeurs:        result.nbActeurs,
      releaseReason:    ctx.releaseReason,
      actorUserId:      ctx.triggeredByUserId,
    });

    return result;
  }

  /* ==========================================================
   * REMBOURSEMENT
   * ========================================================== */

  /**
   * Rembourse le client (total ou partiel).
   * Annule les distributions ESCROW côté acteurs.
   */
  async rembourser(ctx: EscrowRefundContext): Promise<EscrowRefundResult> {
    this.logger.log(`[Engine] rembourser() — escrow ${ctx.escrowId} — total: ${ctx.total}`);

    const result = await this.refundSvc.initierRemboursement(ctx);

    this.auditSvc.logRefund({
      escrowId:            ctx.escrowId,
      commandeId:          result.commandeId,
      montantRembourse:    result.montantRembourse,
      currency:            'GNF',
      raison:              ctx.raison,
      walletTransactionId: result.walletTransactionId,
      actorUserId:         ctx.triggeredByUserId,
    });

    return result;
  }

  /* ==========================================================
   * LITIGE
   * ========================================================== */

  /**
   * Ouvre un litige sur l'escrow (DISPUTED).
   */
  async ouvrirLitige(ctx: EscrowDisputeContext): Promise<EscrowOperationResult> {
    this.logger.log(`[Engine] ouvrirLitige() — escrow ${ctx.escrowId} — dispute ${ctx.disputeId}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);
    this.validatorSvc.validerTransition(escrow, EscrowStatus.DISPUTED);

    const from = escrow.status;
    escrow.status = EscrowStatus.DISPUTED;
    escrow.lastTrigger = EscrowTrigger.CLIENT;
    escrow.disputeId = ctx.disputeId;
    escrow.disputedAt = new Date();

    await this.escrowRepo.save(escrow);

    await this.historyRepo.save(
      this.historyRepo.create({
        escrowId:          escrow.id,
        commandeId:        escrow.commandeId,
        fromStatus:        from,
        toStatus:          EscrowStatus.DISPUTED,
        triggeredBy:       EscrowTrigger.CLIENT,
        triggeredByUserId: ctx.triggeredByUserId,
        note:              ctx.note ?? `Litige ouvert — dispute ${ctx.disputeId}`,
        metadata:          { disputeId: ctx.disputeId },
      }),
    );

    this.eventBus.emit(
      ESCROW_EVENTS.DISPUTED,
      new EscrowDisputedEvent(
        escrow.id, escrow.commandeId, ctx.disputeId, escrow.clientUserId, ctx.triggeredByUserId,
      ),
    );

    return {
      escrowId:   escrow.id,
      commandeId: escrow.commandeId,
      fromStatus: from,
      toStatus:   EscrowStatus.DISPUTED,
      timestamp:  new Date(),
      metadata:   { disputeId: ctx.disputeId },
    };
  }

  /**
   * Résout un litige.
   * Selon la décision :
   *   - REJET         → liberer() (acteurs reçoivent les fonds)
   *   - REMBOURSEMENT → rembourser() (client remboursé)
   */
  async resoudreLitige(ctx: EscrowResolveContext): Promise<EscrowOperationResult | EscrowReleaseResult | EscrowRefundResult> {
    this.logger.log(`[Engine] resoudreLitige() — escrow ${ctx.escrowId} — décision: ${ctx.decision}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);
    this.validatorSvc.validerLitigeOuvert(escrow);
    this.validatorSvc.validerTransition(escrow, EscrowStatus.RESOLVED);

    /* Passer en RESOLVED */
    const fromDisputed = escrow.status;
    escrow.status = EscrowStatus.RESOLVED;
    escrow.lastTrigger = EscrowTrigger.ADMIN;
    escrow.resolvedAt = new Date();
    escrow.disputeDecision = ctx.decision;
    escrow.adminDecisionUserId = ctx.adminUserId;

    await this.escrowRepo.save(escrow);

    await this.historyRepo.save(
      this.historyRepo.create({
        escrowId:          escrow.id,
        commandeId:        escrow.commandeId,
        fromStatus:        fromDisputed,
        toStatus:          EscrowStatus.RESOLVED,
        triggeredBy:       EscrowTrigger.ADMIN,
        triggeredByUserId: ctx.adminUserId,
        note:              ctx.note,
        metadata:          { decision: ctx.decision, disputeId: ctx.disputeId },
      }),
    );

    this.eventBus.emit(
      ESCROW_EVENTS.RESOLVED,
      new EscrowResolvedEvent(
        escrow.id, escrow.commandeId, ctx.decision, ctx.adminUserId,
        ctx.decision === 'REJET' ? EscrowStatus.RELEASED : EscrowStatus.REFUND_PENDING,
      ),
    );

    /* Appliquer la décision */
    if (ctx.decision === 'REJET') {
      return this.liberer({
        escrowId:         ctx.escrowId,
        triggeredBy:      EscrowTrigger.ADMIN,
        triggeredByUserId: ctx.adminUserId,
        releaseReason:    `admin-decision:${ctx.decision}`,
        note:             ctx.note,
      });
    }

    /* REMBOURSEMENT_TOTAL | REMBOURSEMENT_PARTIEL | RE_LIVRAISON → remboursement */
    return this.rembourser({
      escrowId:          ctx.escrowId,
      triggeredBy:       EscrowTrigger.ADMIN,
      triggeredByUserId: ctx.adminUserId,
      total:             ctx.decision === 'REMBOURSEMENT_TOTAL',
      montantRembourse:  ctx.montantRembourse,
      raison:            `admin-decision:${ctx.decision}`,
      note:              ctx.note,
    });
  }

  /* ==========================================================
   * ÉTATS D'ERREUR / EXPIRATION
   * ========================================================== */

  async marquerEchoue(ctx: EscrowFailureContext): Promise<EscrowOperationResult> {
    this.logger.error(`[Engine] marquerEchoue() — escrow ${ctx.escrowId} : ${ctx.failureReason}`);

    const result = await this.managerSvc.marquerEchoue(ctx);

    this.auditSvc.logErreur({
      escrowId:   ctx.escrowId,
      commandeId: result.commandeId,
      erreur:     ctx.failureReason,
      context:    ctx.metadata,
    });

    return result;
  }

  async marquerExpire(escrowId: string): Promise<EscrowOperationResult> {
    this.logger.log(`[Engine] marquerExpire() — escrow ${escrowId}`);
    return this.managerSvc.marquerExpire(escrowId);
  }

  /* ==========================================================
   * LECTURE
   * ========================================================== */

  async getById(escrowId: string): Promise<Escrow> {
    return this.historySvc.getById(escrowId);
  }

  async getByCommandeId(commandeId: string): Promise<Escrow | null> {
    return this.historySvc.getByCommandeId(commandeId);
  }

  async getBySessionId(sessionId: string): Promise<Escrow | null> {
    return this.historySvc.getBySessionId(sessionId);
  }

  async lister(filter: EscrowFilter): Promise<EscrowPage<Escrow>> {
    return this.historySvc.lister(filter);
  }

  async getHistorique(escrowId: string) {
    return this.historySvc.getHistorique(escrowId);
  }

  async getEscrowsAutoReleaseExpires(): Promise<Escrow[]> {
    return this.historySvc.getEscrowsAutoReleaseExpires();
  }

  /* ==========================================================
   * HELPER PRIVÉ
   * ========================================================== */

  private async chargerEscrow(escrowId: string): Promise<Escrow> {
    const escrow = await this.escrowRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new EscrowErreur(
        EscrowErreurType.ESCROW_INTROUVABLE,
        `Escrow introuvable : ${escrowId}`,
        { escrowId },
      );
    }
    return escrow;
  }
}
