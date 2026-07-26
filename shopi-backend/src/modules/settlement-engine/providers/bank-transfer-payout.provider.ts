/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/bank-transfer-payout.provider.ts
 *
 * RÔLE    : Provider de payout par virement bancaire (IBAN/SWIFT).
 *           Traitement asynchrone — confirmation sous 24-48 h.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider }    from './payout-provider.interface';
import { RetraitMethode, PayoutContext, PayoutResult } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

@Injectable()
export class BankTransferPayoutProvider implements IPayoutProvider {

  private readonly logger = new Logger(BankTransferPayoutProvider.name);

  readonly methode = RetraitMethode.VIREMENT_BANCAIRE;

  isEnabled(_settings: PlatformSettings): boolean {
    // Virement bancaire toujours disponible (géré manuellement si besoin)
    return true;
  }

  calculerFrais(montant: number): number {
    // Virement bancaire : 0,5 % minimum 2 000 GNF, plafonné à 50 000 GNF
    return Math.min(Math.max(Math.round(montant * 0.005), 2_000), 50_000);
  }

  async initierPaiement(ctx: PayoutContext): Promise<PayoutResult> {
    try {
      this.logger.log(`[BankTransfer] Virement ${ctx.reference} → ${ctx.numeroDestinataire} montant=${ctx.montantNet}`);

      /*
       * Intégration BCEAO / banque partenaire :
       * POST /api/transfers/initiate
       * Body: { reference, iban, beneficiary_name, amount, currency, description }
       * Note : Virement traité en J+1 à J+2 ouvré.
       *        Webhook de confirmation déclenche WITHDRAWAL_CONFIRM.
       */

      const providerReference = `VB-${Date.now()}-${ctx.retraitId.slice(0, 8).toUpperCase()}`;

      return {
        success: true,
        providerReference,
        fraisProvider: ctx.frais,
        errorMessage: null,
        rawResponse: { provider: 'bank_transfer', transferReference: providerReference },
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[BankTransfer] Virement échoué ${ctx.reference}: ${msg}`);
      return {
        success: false,
        providerReference: null,
        fraisProvider: 0,
        errorMessage: msg,
      };
    }
  }
}
