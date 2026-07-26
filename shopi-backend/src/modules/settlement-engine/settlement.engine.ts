/* ============================================================
 * FICHIER : src/modules/settlement-engine/settlement.engine.ts
 *
 * RÔLE    : Orchestrateur principal du Settlement & Payout Engine.
 *           Point d'entrée UNIQUE pour les modules consommateurs.
 *
 * DÉLÉGUÉS PUBLICS :
 *   demanderRetrait()      — soumettre une demande de retrait
 *   annulerRetrait()       — annuler avant traitement
 *   validerRetrait()       — validation manuelle admin
 *   refuserRetrait()       — refus admin avec justification
 *   executerPayout()       — exécuter un payout individuel
 *   retryPayout()          — relancer après échec
 *   lancerBatchManuel()    — batch déclenché manuellement
 *   verifierEligibilite()  — vérification non-bloquante
 *   getRetrait()           — lecture retrait
 *   getRetraits()          — historique paginé
 *   getBatch()             — lecture batch
 *   getMethodesActives()   — méthodes de payout disponibles
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSettings } from '../../database/entities/platform-settings.entity';

import { EligibilityValidatorService }   from './services/eligibility-validator.service';
import { WithdrawalManagerService }      from './services/withdrawal-manager.service';
import { WithdrawalValidationService }   from './services/withdrawal-validation.service';
import { PayoutManagerService }          from './services/payout-manager.service';
import { SettlementSchedulerService }    from './services/settlement-scheduler.service';
import { SettlementHistoryService, RetraitHistoriqueFilter, RetraitPage } from './services/settlement-history.service';
import { PayoutProviderFactory }         from './providers/payout-provider.factory';
import { SettlementEventBus }            from './events/settlement-event-bus.service';

import {
  DemandeRetraitContext,
  DemandeRetraitResult,
  ExecutePayoutContext,
  PayoutExecutionResult,
  EligibiliteResult,
  RetraitMethode,
  SettlementBatchContext,
} from './types/settlement-engine.types';

import { Retrait }         from '../../database/entities/paiement/retrait.entity';
import { SettlementBatch } from '../../database/entities/paiement/settlement-batch.entity';

@Injectable()
export class SettlementEngine {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    private readonly eligibilityService:  EligibilityValidatorService,
    private readonly withdrawalManager:   WithdrawalManagerService,
    private readonly validationService:   WithdrawalValidationService,
    private readonly payoutManager:       PayoutManagerService,
    private readonly scheduler:           SettlementSchedulerService,
    private readonly historyService:      SettlementHistoryService,
    private readonly providerFactory:     PayoutProviderFactory,
    readonly eventBus:                    SettlementEventBus,
  ) {}

  /* ==========================================================
   * DEMANDES
   * ========================================================== */

  /**
   * Soumet une demande de retrait.
   * Déclenche automatiquement le payout si montant ≤ seuil.
   */
  async demanderRetrait(ctx: DemandeRetraitContext): Promise<DemandeRetraitResult> {
    const result = await this.withdrawalManager.demanderRetrait(ctx);

    if (result.autoProcessed) {
      setImmediate(() => {
        this.scheduler.traiterImmediatement(result.retraitId, ctx.performedByUserId ?? undefined);
      });
    }

    return result;
  }

  /** Annule un retrait PENDING. */
  async annulerRetrait(retraitId: string, userId: string, raison?: string): Promise<void> {
    return this.withdrawalManager.annulerRetrait(retraitId, userId, raison);
  }

  /* ==========================================================
   * VALIDATION
   * ========================================================== */

  /** Validation manuelle par un admin. */
  async validerRetrait(retraitId: string, adminUserId: string): Promise<void> {
    return this.validationService.validerManuellement(retraitId, adminUserId);
  }

  /** Refus avec justification obligatoire. */
  async refuserRetrait(retraitId: string, adminUserId: string, raison: string): Promise<void> {
    return this.validationService.refuser(retraitId, adminUserId, raison);
  }

  /* ==========================================================
   * PAYOUT
   * ========================================================== */

  /** Exécute un payout individuel (PENDING → PROCESSING → COMPLETED/FAILED). */
  async executerPayout(ctx: ExecutePayoutContext): Promise<PayoutExecutionResult> {
    return this.payoutManager.executerPayout(ctx);
  }

  /** Relance un payout après échec. */
  async retryPayout(retraitId: string, triggeredByUserId?: string): Promise<PayoutExecutionResult> {
    return this.payoutManager.retryPayout(retraitId, triggeredByUserId);
  }

  /* ==========================================================
   * BATCH
   * ========================================================== */

  /** Déclenche un batch manuel sur tous les retraits PENDING. */
  async lancerBatchManuel(triggeredByUserId?: string): Promise<void> {
    return this.scheduler.lancerBatchManuel(triggeredByUserId);
  }

  /**
   * Crée et exécute un batch sur une liste de retraits fournie.
   * Utile pour les tests et les traitements filtrés.
   */
  async executerBatch(batchCtx: SettlementBatchContext, retraits: Retrait[]): Promise<SettlementBatch> {
    return this.payoutManager.executerBatch(batchCtx, retraits);
  }

  /* ==========================================================
   * ÉLIGIBILITÉ
   * ========================================================== */

  /** Vérifie l'éligibilité sans lever d'exception. */
  async verifierEligibilite(walletId: string, montant: number, userId: string): Promise<EligibiliteResult> {
    return this.eligibilityService.verifier(walletId, montant, userId);
  }

  /* ==========================================================
   * LECTURE
   * ========================================================== */

  async getRetrait(retraitId: string): Promise<Retrait | null> {
    return this.historyService.getRetrait(retraitId);
  }

  async getRetraits(filter: RetraitHistoriqueFilter): Promise<RetraitPage> {
    return this.historyService.getRetraits(filter);
  }

  async getBatch(batchId: string): Promise<SettlementBatch | null> {
    return this.historyService.getBatch(batchId);
  }

  async getBatches(limit?: number): Promise<SettlementBatch[]> {
    return this.historyService.getBatches(limit);
  }

  /** Retourne les méthodes de payout actuellement activées. */
  async getMethodesActives(): Promise<RetraitMethode[]> {
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!settings) return [];
    return this.providerFactory.getMethodesActives(settings);
  }
}
