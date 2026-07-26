/* ============================================================
 * FICHIER : src/modules/settlement-engine/services/withdrawal-manager.service.ts
 *
 * RÔLE    : Gère le cycle de vie des demandes de retrait :
 *           création (PENDING) et annulation (CANCELLED).
 *
 * FLUX :
 *   demanderRetrait → EligibilityValidator → Retrait(PENDING)
 *                  → si montant ≤ autoValidationThreshold → lance PayoutManager
 *   annulerRetrait  → Retrait(CANCELLED)
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Retrait, RetraitStatus } from '../../../database/entities/paiement/retrait.entity';
import { PlatformSettings }       from '../../../database/entities/platform-settings.entity';

import { EligibilityValidatorService } from './eligibility-validator.service';
import { SettlementAuditService }      from './settlement-audit.service';
import { SettlementEventBus }          from '../events/settlement-event-bus.service';
import { SETTLEMENT_EVENTS, WithdrawalRequestedEvent, WithdrawalRejectedEvent } from '../events/settlement.events';

import {
  DemandeRetraitContext,
  DemandeRetraitResult,
  SettlementErreur,
  SettlementErreurType,
  RETRAIT_FINAL_STATUSES,
} from '../types/settlement-engine.types';

@Injectable()
export class WithdrawalManagerService {

  private readonly logger = new Logger(WithdrawalManagerService.name);

  constructor(
    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    private readonly eligibilityService: EligibilityValidatorService,
    private readonly auditService:       SettlementAuditService,
    private readonly eventBus:           SettlementEventBus,
    private readonly dataSource:         DataSource,
  ) {}

  /**
   * Crée une demande de retrait après vérification d'éligibilité.
   * Si le montant est en dessous du seuil d'auto-validation,
   * signale au PayoutManager de traiter immédiatement (autoProcessed=true).
   */
  async demanderRetrait(ctx: DemandeRetraitContext): Promise<DemandeRetraitResult> {
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!settings) throw new SettlementErreur(SettlementErreurType.ERREUR_INTERNE, 'PlatformSettings introuvable.');

    // Validation d'éligibilité — lève SettlementErreur si non éligible
    try {
      await this.eligibilityService.valider(ctx.walletId, ctx.montant, ctx.userId);
    } catch (err) {
      setImmediate(() => {
        this.auditService.logEligibiliteRefusee({
          walletId: ctx.walletId,
          userId:   ctx.userId,
          montant:  ctx.montant,
          raison:   err instanceof Error ? err.message : String(err),
          ipAddress: ctx.ipAddress ?? null,
        });
      });
      throw err;
    }

    // Calcul des frais et génération de la référence
    const count     = await this.retraitRepo.count();
    const reference = `RET-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const frais     = 0; // frais calculés au moment de l'exécution par le provider
    const montantNet = ctx.montant - frais;

    const retrait = this.retraitRepo.create({
      walletId:           ctx.walletId,
      userId:             ctx.userId,
      montant:            ctx.montant,
      frais,
      montantNet,
      methode:            ctx.methode,
      numeroDestinataire: ctx.numeroDestinataire,
      nomDestinataire:    ctx.nomDestinataire ?? null,
      status:             RetraitStatus.PENDING,
      notes:              ctx.note ?? null,
      reference,
      attempts:           1,
      requestedAt:        new Date(),
    });

    await this.retraitRepo.save(retrait);

    // Audit + événement (fire-and-forget)
    setImmediate(() => {
      this.auditService.logWithdrawalRequested({
        retraitId: retrait.id,
        walletId:  ctx.walletId,
        userId:    ctx.userId,
        montant:   ctx.montant,
        methode:   ctx.methode,
        ipAddress: ctx.ipAddress ?? null,
      });
    });

    this.eventBus.emit(
      SETTLEMENT_EVENTS.WITHDRAWAL_REQUESTED,
      new WithdrawalRequestedEvent(
        retrait.id,
        ctx.walletId,
        ctx.userId,
        ctx.montant,
        ctx.methode,
        reference,
        retrait.requestedAt,
      ),
    );

    const autoProcessed = ctx.montant <= settings.autoValidationThreshold;

    return {
      retraitId:   retrait.id,
      reference,
      montant:     ctx.montant,
      frais,
      montantNet,
      methode:     ctx.methode,
      status:      RetraitStatus.PENDING,
      autoProcessed,
      requestedAt: retrait.requestedAt,
    };
  }

  /**
   * Annule un retrait PENDING.
   * Impossible si PROCESSING, COMPLETED ou déjà CANCELLED.
   */
  async annulerRetrait(
    retraitId: string,
    userId: string,
    raison?: string,
  ): Promise<void> {
    const retrait = await this.retraitRepo.findOne({ where: { id: retraitId } });
    if (!retrait) {
      throw new SettlementErreur(
        SettlementErreurType.RETRAIT_INTROUVABLE,
        `Retrait ${retraitId} introuvable.`,
        { retraitId },
      );
    }

    if (retrait.status !== RetraitStatus.PENDING) {
      throw new SettlementErreur(
        SettlementErreurType.ANNULATION_IMPOSSIBLE,
        `Impossible d'annuler un retrait en statut ${retrait.status}.`,
        { retraitId, status: retrait.status },
      );
    }

    retrait.status      = RetraitStatus.CANCELLED;
    retrait.completedAt = new Date();
    retrait.notes       = raison ? `${retrait.notes ?? ''}\nAnnulé : ${raison}`.trim() : retrait.notes;
    await this.retraitRepo.save(retrait);

    this.eventBus.emit(
      SETTLEMENT_EVENTS.WITHDRAWAL_REJECTED,
      new WithdrawalRejectedEvent(
        retraitId,
        retrait.walletId,
        retrait.montant,
        userId,
        raison ?? 'Annulation demandée',
        new Date(),
      ),
    );

    this.logger.log(`[WithdrawalManager] Retrait ${retrait.reference} annulé par userId=${userId}`);
  }
}
