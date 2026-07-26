/* ============================================================
 * FICHIER : src/modules/settlement-engine/services/withdrawal-validation.service.ts
 *
 * RÔLE    : Gère la validation (approbation) et le refus des retraits.
 *
 * RÈGLES :
 *   - Auto-validation : montant ≤ autoValidationThreshold → immédiat
 *   - Validation manuelle : montant > seuil → admin explicite requis
 *   - Refus : admin fournit une justification obligatoire
 *   - Toutes les décisions sont horodatées et auditées
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Retrait, RetraitStatus } from '../../../database/entities/paiement/retrait.entity';
import { PlatformSettings }       from '../../../database/entities/platform-settings.entity';

import { SettlementEventBus }     from '../events/settlement-event-bus.service';
import {
  SETTLEMENT_EVENTS,
  WithdrawalValidatedEvent,
  WithdrawalRejectedEvent,
} from '../events/settlement.events';
import { SettlementErreur, SettlementErreurType } from '../types/settlement-engine.types';

@Injectable()
export class WithdrawalValidationService {

  private readonly logger = new Logger(WithdrawalValidationService.name);

  constructor(
    @InjectRepository(Retrait)
    private readonly retraitRepo: Repository<Retrait>,
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    private readonly eventBus: SettlementEventBus,
  ) {}

  /**
   * Validation manuelle d'un retrait PENDING par un admin.
   * Ne déclenche pas le payout — juste un marqueur d'approbation dans les notes.
   * Le payout est ensuite déclenché par PayoutManagerService.
   */
  async validerManuellement(retraitId: string, adminUserId: string): Promise<void> {
    const retrait = await this._chargerPending(retraitId);

    // Marqueur d'approbation dans les notes (pas de champ dédié dans l'entité)
    retrait.processedByUserId = adminUserId;
    retrait.notes = `${retrait.notes ?? ''}\nValidé manuellement par ${adminUserId} le ${new Date().toISOString()}`.trim();
    await this.retraitRepo.save(retrait);

    this.eventBus.emit(
      SETTLEMENT_EVENTS.WITHDRAWAL_VALIDATED,
      new WithdrawalValidatedEvent(
        retrait.id,
        retrait.walletId,
        retrait.montant,
        adminUserId,
        false,
        new Date(),
      ),
    );

    this.logger.log(`[Validation] Retrait ${retrait.reference} validé manuellement par ${adminUserId}`);
  }

  /**
   * Validation automatique pour les montants sous seuil.
   * Appelée directement par WithdrawalManagerService après création.
   */
  async autoValider(retraitId: string): Promise<void> {
    const retrait = await this._chargerPending(retraitId);

    retrait.notes = `${retrait.notes ?? ''}\nAuto-validé le ${new Date().toISOString()}`.trim();
    await this.retraitRepo.save(retrait);

    this.eventBus.emit(
      SETTLEMENT_EVENTS.WITHDRAWAL_VALIDATED,
      new WithdrawalValidatedEvent(
        retrait.id,
        retrait.walletId,
        retrait.montant,
        null,
        true,
        new Date(),
      ),
    );
  }

  /**
   * Refuse un retrait PENDING avec une justification obligatoire.
   * Le retrait passe en CANCELLED.
   */
  async refuser(retraitId: string, adminUserId: string, raison: string): Promise<void> {
    if (!raison || raison.trim().length === 0) {
      throw new SettlementErreur(
        SettlementErreurType.MONTANT_INVALIDE,
        'La justification du refus est obligatoire.',
      );
    }

    const retrait = await this._chargerPending(retraitId);

    retrait.status              = RetraitStatus.CANCELLED;
    retrait.completedAt         = new Date();
    retrait.processedByUserId   = adminUserId;
    retrait.failureReason       = raison;
    retrait.notes               = `${retrait.notes ?? ''}\nRefusé par ${adminUserId} : ${raison}`.trim();
    await this.retraitRepo.save(retrait);

    this.eventBus.emit(
      SETTLEMENT_EVENTS.WITHDRAWAL_REJECTED,
      new WithdrawalRejectedEvent(
        retrait.id,
        retrait.walletId,
        retrait.montant,
        adminUserId,
        raison,
        new Date(),
      ),
    );

    this.logger.log(`[Validation] Retrait ${retrait.reference} refusé par ${adminUserId}`);
  }

  /**
   * Vérifie si un retrait dépasse le seuil d'auto-validation.
   * Vrai = validation manuelle requise.
   */
  async demandeValidationManuelle(montant: number): Promise<boolean> {
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    return !!settings && montant > settings.autoValidationThreshold;
  }

  private async _chargerPending(retraitId: string): Promise<Retrait> {
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
        SettlementErreurType.RETRAIT_TERMINAL,
        `Retrait ${retraitId} n'est pas PENDING (statut : ${retrait.status}).`,
        { retraitId, status: retrait.status },
      );
    }
    return retrait;
  }
}
