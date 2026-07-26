/* ============================================================
 * FICHIER : src/modules/escrow-engine/services/escrow-release.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Libération des fonds du séquestre vers les wallets acteurs.
 *
 * FLUX
 * ------------------------------------------------------------
 * 1. Charger l'escrow + valider transition vers RELEASED
 * 2. Bloquer double-release (idempotence)
 * 3. Charger les PaiementDistributions (status=ESCROW)
 * 4. Pour chaque distribution :
 *    a. WalletEngine.executer(ESCROW_RELEASE) → pendingBalance → balance
 *    b. Mettre à jour distribution.status = RELEASED
 * 5. Mettre à jour escrow.status = RELEASED + timestamps
 * 6. Enregistrer EscrowHistory
 * 7. Émettre EscrowReleasedEvent
 *
 * PRINCIPE
 * ------------------------------------------------------------
 * Les commissions sont déjà calculées dans PaiementDistribution
 * lors de la création par PaiementWebhookService.
 * EscrowReleaseService ne re-calcule PAS — il libère ce qui
 * a déjà été ventilé lors du paiement.
 *
 * IDEMPOTENCE
 * ------------------------------------------------------------
 * Clé d'idempotence WalletEngine : "escrow-release-<escrowId>-<distId>"
 * → Permet de rejouer sans créer de doublon.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Escrow, EscrowStatus, EscrowTrigger } from '../../../database/entities/paiement/escrow.entity';
import { EscrowHistory } from '../../../database/entities/paiement/escrow-history.entity';
import { PaiementDistribution, DistributionStatus } from '../../../database/entities/paiement/paiement-distribution.entity';
import { WalletEngine } from '../../wallet-engine/wallet.engine';
import { WalletOperationType, BalanceType } from '../../wallet-engine/types/wallet-engine.types';
import { EscrowValidatorService } from './escrow-validator.service';
import { EscrowEventBus } from '../events/escrow-event-bus.service';
import { ESCROW_EVENTS, EscrowReleasedEvent } from '../events/escrow.events';
import {
  EscrowReleaseContext,
  EscrowReleaseResult,
  EscrowErreur,
  EscrowErreurType,
} from '../types/escrow-engine.types';

@Injectable()
export class EscrowReleaseService {

  private readonly logger = new Logger(EscrowReleaseService.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(EscrowHistory)
    private readonly historyRepo: Repository<EscrowHistory>,

    @InjectRepository(PaiementDistribution)
    private readonly distributionRepo: Repository<PaiementDistribution>,

    private readonly walletEngine: WalletEngine,
    private readonly validator: EscrowValidatorService,
    private readonly events: EscrowEventBus,
    private readonly dataSource: DataSource,
  ) {}

  /* ==========================================================
   * LIBÉRATION PRINCIPALE
   * ========================================================== */

  /**
   * Libère les fonds vers les wallets de tous les acteurs.
   * Appelé quand le client valide son code OU délai auto dépassé.
   */
  async liberer(ctx: EscrowReleaseContext): Promise<EscrowReleaseResult> {
    this.logger.log(`[Release] Libération escrow ${ctx.escrowId} — raison: ${ctx.releaseReason}`);

    /* ── 1. Charger l'escrow ─────────────────────────────── */
    const escrow = await this.chargerEscrow(ctx.escrowId);

    /* ── 2. Valider ─────────────────────────────────────── */
    this.validator.validerPasDoubleRelease(escrow);
    this.validator.validerEtatAttendu(
      escrow,
      EscrowStatus.WAITING_VALIDATION,
      EscrowStatus.RESOLVED,
    );
    this.validator.validerTransition(escrow, EscrowStatus.RELEASED);

    /* ── 3. Charger les distributions ESCROW ────────────── */
    const distributions = await this.distributionRepo.find({
      where: {
        commandeId: escrow.commandeId,
        status: DistributionStatus.ESCROW,
      },
    });

    if (distributions.length === 0) {
      this.logger.warn(`[Release] Aucune distribution ESCROW pour commande ${escrow.commandeId}`);
    }

    /* ── 4. Libérer chaque distribution via WalletEngine ── */
    const walletTransactionIds: string[] = [];
    let montantDistribue = 0;

    for (const dist of distributions) {
      try {
        const result = await this.walletEngine.executer({
          walletId:         dist.walletId,
          amount:           dist.montant,
          operationType:    WalletOperationType.ESCROW_RELEASE,
          balanceType:      BalanceType.PENDING,
          idempotencyKey:   `escrow-release-${escrow.id}-${dist.id}`,
          referenceType:    'escrow',
          referenceId:      escrow.id,
          performedByRole:  ctx.triggeredBy === EscrowTrigger.CLIENT ? 'CLIENT' : 'SYSTEM',
          performedByUserId: ctx.triggeredByUserId ?? null,
          description:      `Libération séquestre commande ${escrow.commandeNumero} — ${dist.acteurType}`,
          metadata:         {
            distributionId:  dist.id,
            acteurType:      dist.acteurType,
            acteurNom:       dist.acteurNom,
            releaseReason:   ctx.releaseReason,
            escrowId:        escrow.id,
          },
        });

        walletTransactionIds.push(result.transactionId);
        montantDistribue += dist.montant;

        /* Marquer la distribution RELEASED */
        dist.status = DistributionStatus.RELEASED;
        dist.releasedAt = new Date();
        dist.releaseTransactionId = result.transactionId;
        await this.distributionRepo.save(dist);

      } catch (err) {
        this.logger.error(
          `[Release] Erreur WalletEngine pour distribution ${dist.id} (${dist.acteurType}) : ${(err as Error).message}`,
        );
        throw new EscrowErreur(
          EscrowErreurType.WALLET_ENGINE_ERREUR,
          `Échec libération distribution ${dist.id} : ${(err as Error).message}`,
          { distributionId: dist.id, escrowId: escrow.id },
        );
      }
    }

    /* ── 5. Mettre à jour l'escrow ──────────────────────── */
    const from = escrow.status;
    escrow.status = EscrowStatus.RELEASED;
    escrow.lastTrigger = ctx.triggeredBy;
    escrow.releasedAt = new Date();
    escrow.montantDistribue = montantDistribue;
    escrow.releaseTriggeredBy = ctx.releaseReason;
    escrow.adminDecisionUserId = ctx.triggeredByUserId ?? null;

    await this.escrowRepo.save(escrow);

    /* ── 6. Enregistrer la transition ───────────────────── */
    await this.historyRepo.save(
      this.historyRepo.create({
        escrowId:          escrow.id,
        commandeId:        escrow.commandeId,
        fromStatus:        from,
        toStatus:          EscrowStatus.RELEASED,
        triggeredBy:       ctx.triggeredBy,
        triggeredByUserId: ctx.triggeredByUserId ?? null,
        montant:           montantDistribue,
        currency:          escrow.currency,
        note:              ctx.note ?? `Libération : ${ctx.releaseReason}`,
        metadata:          { walletTransactionIds, nbActeurs: distributions.length },
      }),
    );

    /* ── 7. Émettre l'événement ─────────────────────────── */
    this.events.emit(
      ESCROW_EVENTS.RELEASED,
      new EscrowReleasedEvent(
        escrow.id,
        escrow.commandeId,
        escrow.montantTotal,
        montantDistribue,
        ctx.releaseReason,
        ctx.triggeredBy,
      ),
    );

    this.logger.log(
      `[Release] Escrow ${escrow.id} libéré — ${distributions.length} acteurs — ${montantDistribue} ${escrow.currency}`,
    );

    return {
      escrowId:             escrow.id,
      commandeId:           escrow.commandeId,
      fromStatus:           from,
      toStatus:             EscrowStatus.RELEASED,
      timestamp:            new Date(),
      montantTotal:         escrow.montantTotal,
      montantDistribue,
      nbActeurs:            distributions.length,
      walletTransactionIds,
    };
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
