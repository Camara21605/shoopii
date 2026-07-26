/* ============================================================
 * FICHIER : src/modules/escrow-engine/services/escrow-manager.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Gestion du cycle de vie d'un séquestre : création, verrouillage,
 * passage en WAITING_VALIDATION, marquage FAILED/EXPIRED.
 *
 * NE GÈRE PAS :
 *   - La libération des fonds → EscrowReleaseService
 *   - Les remboursements     → EscrowRefundService
 *   - L'historique           → EscrowHistoryService
 *
 * DÉLÉGATIONS :
 *   - WalletEngine.executer(ESCROW_CREDIT) pour créditer les wallets
 *   - EscrowValidatorService pour toutes les validations
 *   - PlatformSettings pour les délais configurables
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow, EscrowStatus, EscrowTrigger } from '../../../database/entities/paiement/escrow.entity';
import { EscrowHistory } from '../../../database/entities/paiement/escrow-history.entity';
import { PaiementDistribution, DistributionStatus } from '../../../database/entities/paiement/paiement-distribution.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { WalletEngine } from '../../wallet-engine/wallet.engine';
import { WalletOperationType, BalanceType } from '../../wallet-engine/types/wallet-engine.types';
import { EscrowValidatorService } from './escrow-validator.service';
import { EscrowEventBus } from '../events/escrow-event-bus.service';
import { ESCROW_EVENTS, EscrowCreatedEvent, EscrowFundsReceivedEvent, EscrowLockedEvent, EscrowWaitingValidationEvent, EscrowFailedEvent, EscrowExpiredEvent } from '../events/escrow.events';
import {
  EscrowCreationContext,
  EscrowFundsReceivedContext,
  EscrowLockContext,
  EscrowWaitingValidationContext,
  EscrowFailureContext,
  EscrowOperationResult,
  EscrowErreur,
  EscrowErreurType,
} from '../types/escrow-engine.types';

@Injectable()
export class EscrowManagerService {

  private readonly logger = new Logger(EscrowManagerService.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(EscrowHistory)
    private readonly historyRepo: Repository<EscrowHistory>,

    @InjectRepository(PaiementDistribution)
    private readonly distributionRepo: Repository<PaiementDistribution>,

    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,

    private readonly walletEngine: WalletEngine,
    private readonly validator: EscrowValidatorService,
    private readonly events: EscrowEventBus,
  ) {}

  /* ==========================================================
   * CRÉATION
   * ========================================================== */

  /**
   * Crée un séquestre en état CREATED.
   * Appelé dès qu'une commande est initiée côté paiement.
   * Les fonds ne sont pas encore reçus.
   */
  async creer(ctx: EscrowCreationContext): Promise<Escrow> {
    this.logger.log(`[Manager] Création escrow commande ${ctx.commandeNumero}`);

    /* Idempotence : un seul escrow par session */
    const existing = await this.escrowRepo.findOne({
      where: { sessionId: ctx.sessionId },
    });
    if (existing) {
      this.logger.warn(`[Manager] Escrow déjà existant pour session ${ctx.sessionId} → ${existing.id}`);
      return existing;
    }

    this.validator.validerMontant(ctx.montantTotal, 'Montant total escrow');

    const escrow = this.escrowRepo.create({
      commandeId:     ctx.commandeId,
      commandeNumero: ctx.commandeNumero,
      sessionId:      ctx.sessionId,
      clientUserId:   ctx.clientUserId,
      clientWalletId: ctx.clientWalletId,
      montantTotal:   ctx.montantTotal,
      currency:       ctx.currency,
      status:         EscrowStatus.CREATED,
      lastTrigger:    EscrowTrigger.SYSTEM,
      metadata:       ctx.metadata ?? null,
    });

    const saved = await this.escrowRepo.save(escrow);
    await this.enregistrerTransition(saved, null, EscrowStatus.CREATED, EscrowTrigger.SYSTEM);

    this.events.emit(
      ESCROW_EVENTS.CREATED,
      new EscrowCreatedEvent(
        saved.id, ctx.commandeId, ctx.commandeNumero,
        ctx.clientUserId, ctx.montantTotal, ctx.currency,
      ),
    );

    return saved;
  }

  /* ==========================================================
   * RÉCEPTION DES FONDS (FUNDS_RECEIVED)
   * ========================================================== */

  /**
   * Marque l'escrow FUNDS_RECEIVED après webhook paiement confirmé.
   * Vérifie la cohérence du montant reçu vs montant attendu.
   */
  async recevoirFonds(ctx: EscrowFundsReceivedContext): Promise<EscrowOperationResult> {
    this.logger.log(`[Manager] Fonds reçus escrow ${ctx.escrowId} — ${ctx.montantConfirme} via ${ctx.provider}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);
    this.validator.validerTransition(escrow, EscrowStatus.FUNDS_RECEIVED);
    this.validator.validerMontantConfirme(ctx.montantConfirme, escrow.montantTotal);

    const from = escrow.status;
    escrow.status = EscrowStatus.FUNDS_RECEIVED;
    escrow.lastTrigger = EscrowTrigger.WEBHOOK;
    escrow.fundsReceivedAt = new Date();
    escrow.metadata = { ...escrow.metadata, webhookProvider: ctx.provider, webhookPayload: ctx.webhookPayload };

    await this.escrowRepo.save(escrow);
    await this.enregistrerTransition(escrow, from, EscrowStatus.FUNDS_RECEIVED, EscrowTrigger.WEBHOOK);

    this.events.emit(
      ESCROW_EVENTS.FUNDS_RECEIVED,
      new EscrowFundsReceivedEvent(ctx.escrowId, escrow.commandeId, ctx.sessionId, ctx.montantConfirme, ctx.provider),
    );

    return this.buildResult(escrow, from, EscrowStatus.FUNDS_RECEIVED);
  }

  /* ==========================================================
   * VERROUILLAGE DES FONDS (LOCKED)
   * ========================================================== */

  /**
   * Passe l'escrow en LOCKED après crédit WalletEngine (ESCROW_CREDIT).
   * Crédite tous les acteurs en pendingBalance via WalletEngine.
   * Les distributions (PaiementDistribution) doivent déjà exister en ESCROW.
   */
  async verrouillerFonds(ctx: EscrowLockContext): Promise<EscrowOperationResult> {
    this.logger.log(`[Manager] Verrouillage fonds escrow ${ctx.escrowId}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);
    this.validator.validerTransition(escrow, EscrowStatus.LOCKED);

    /* Récupérer les distributions pour créditer chaque acteur */
    const distributions = await this.distributionRepo.find({
      where: { commandeId: escrow.commandeId, status: DistributionStatus.ESCROW },
    });

    /* Créditer chaque acteur en pendingBalance via WalletEngine */
    for (const dist of distributions) {
      if (!dist.walletId) continue;

      await this.walletEngine.executer({
        walletId:         dist.walletId,
        amount:           dist.montant,
        operationType:    WalletOperationType.ESCROW_CREDIT,
        balanceType:      BalanceType.PENDING,
        idempotencyKey:   `escrow-lock-${escrow.id}-${dist.id}`,
        referenceType:    'escrow',
        referenceId:      escrow.id,
        performedByRole:  'SYSTEM',
        description:      `Crédit séquestre commande ${escrow.commandeNumero}`,
        metadata:         { distributionId: dist.id, commandeId: escrow.commandeId },
      });
    }

    const from = escrow.status;
    escrow.status = EscrowStatus.LOCKED;
    escrow.lastTrigger = ctx.triggeredBy;
    escrow.lockedAt = new Date();

    await this.escrowRepo.save(escrow);
    await this.enregistrerTransition(escrow, from, EscrowStatus.LOCKED, ctx.triggeredBy, ctx.triggeredByUserId, ctx.note);

    this.events.emit(ESCROW_EVENTS.LOCKED, new EscrowLockedEvent(ctx.escrowId, escrow.commandeId, ctx.triggeredBy));

    return this.buildResult(escrow, from, EscrowStatus.LOCKED);
  }

  /* ==========================================================
   * ATTENTE VALIDATION CLIENT (WAITING_VALIDATION)
   * ========================================================== */

  /**
   * Passe l'escrow en WAITING_VALIDATION.
   * Déclenché quand les acteurs intermédiaires ont tous validé.
   * Calcule la date d'auto-release depuis PlatformSettings.
   */
  async attendreValidation(ctx: EscrowWaitingValidationContext): Promise<EscrowOperationResult> {
    this.logger.log(`[Manager] Passage WAITING_VALIDATION escrow ${ctx.escrowId}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);
    this.validator.validerTransition(escrow, EscrowStatus.WAITING_VALIDATION);

    /* Lire le délai depuis PlatformSettings */
    const settings = await this.settingsRepo.findOne({ where: {} });
    const delayDays = (settings as any)?.escrowClientValidationDelayDays ?? 3;

    const autoReleaseAt = new Date();
    autoReleaseAt.setDate(autoReleaseAt.getDate() + delayDays);

    const from = escrow.status;
    escrow.status = EscrowStatus.WAITING_VALIDATION;
    escrow.lastTrigger = ctx.triggeredBy;
    escrow.waitingValidationAt = new Date();
    escrow.autoReleaseAt = autoReleaseAt;

    await this.escrowRepo.save(escrow);
    await this.enregistrerTransition(escrow, from, EscrowStatus.WAITING_VALIDATION, ctx.triggeredBy, ctx.triggeredByUserId, ctx.note);

    this.events.emit(
      ESCROW_EVENTS.WAITING_VALIDATION,
      new EscrowWaitingValidationEvent(ctx.escrowId, escrow.commandeId, autoReleaseAt),
    );

    return this.buildResult(escrow, from, EscrowStatus.WAITING_VALIDATION);
  }

  /* ==========================================================
   * MARQUAGE FAILED
   * ========================================================== */

  /**
   * Marque l'escrow FAILED suite à une erreur non récupérable.
   * Nécessite une intervention manuelle Super Admin.
   */
  async marquerEchoue(ctx: EscrowFailureContext): Promise<EscrowOperationResult> {
    this.logger.error(`[Manager] Escrow ${ctx.escrowId} marqué FAILED : ${ctx.failureReason}`);

    const escrow = await this.chargerEscrow(ctx.escrowId);
    this.validator.validerTransition(escrow, EscrowStatus.FAILED);

    const from = escrow.status;
    escrow.status = EscrowStatus.FAILED;
    escrow.lastTrigger = EscrowTrigger.SYSTEM;
    escrow.failureReason = ctx.failureReason;
    escrow.metadata = { ...escrow.metadata, ...ctx.metadata };

    await this.escrowRepo.save(escrow);
    await this.enregistrerTransition(escrow, from, EscrowStatus.FAILED, EscrowTrigger.SYSTEM, undefined, ctx.failureReason);

    this.events.emit(ESCROW_EVENTS.FAILED, new EscrowFailedEvent(ctx.escrowId, escrow.commandeId, ctx.failureReason, from));

    return this.buildResult(escrow, from, EscrowStatus.FAILED);
  }

  /* ==========================================================
   * MARQUAGE EXPIRED
   * ========================================================== */

  /**
   * Marque l'escrow EXPIRED (délai dépassé sans paiement confirmé).
   * Déclenché par le scheduler.
   */
  async marquerExpire(escrowId: string): Promise<EscrowOperationResult> {
    this.logger.log(`[Manager] Escrow ${escrowId} marqué EXPIRED`);

    const escrow = await this.chargerEscrow(escrowId);
    this.validator.validerTransition(escrow, EscrowStatus.EXPIRED);

    const from = escrow.status;
    escrow.status = EscrowStatus.EXPIRED;
    escrow.lastTrigger = EscrowTrigger.SCHEDULER;

    await this.escrowRepo.save(escrow);
    await this.enregistrerTransition(escrow, from, EscrowStatus.EXPIRED, EscrowTrigger.SCHEDULER);

    this.events.emit(ESCROW_EVENTS.EXPIRED, new EscrowExpiredEvent(escrowId, escrow.commandeId, new Date()));

    return this.buildResult(escrow, from, EscrowStatus.EXPIRED);
  }

  /* ==========================================================
   * HELPERS PRIVÉS
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

  private async enregistrerTransition(
    escrow: Escrow,
    from: EscrowStatus | null,
    to: EscrowStatus,
    trigger: EscrowTrigger,
    triggeredByUserId?: string,
    note?: string,
  ): Promise<void> {
    await this.historyRepo.save(
      this.historyRepo.create({
        escrowId:         escrow.id,
        commandeId:       escrow.commandeId,
        fromStatus:       from,
        toStatus:         to,
        triggeredBy:      trigger,
        triggeredByUserId: triggeredByUserId ?? null,
        note:             note ?? null,
      }),
    );
  }

  private buildResult(
    escrow: Escrow,
    from: EscrowStatus | null,
    to: EscrowStatus,
  ): EscrowOperationResult {
    return {
      escrowId:   escrow.id,
      commandeId: escrow.commandeId,
      fromStatus: from,
      toStatus:   to,
      timestamp:  new Date(),
    };
  }
}
