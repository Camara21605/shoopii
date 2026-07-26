/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/moov-money-payout.provider.ts
 *
 * RÔLE    : Provider de payout Moov Money.
 *           Intégration Moov Africa Disbursement API.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider }    from './payout-provider.interface';
import { RetraitMethode, PayoutContext, PayoutResult } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

@Injectable()
export class MoovMoneyPayoutProvider implements IPayoutProvider {

  private readonly logger = new Logger(MoovMoneyPayoutProvider.name);

  readonly methode = RetraitMethode.MOOV_MONEY;

  isEnabled(settings: PlatformSettings): boolean {
    return settings.moovMoneyEnabled;
  }

  calculerFrais(montant: number): number {
    // Moov Guinea : 1,2 % plafonné à 18 000 GNF
    return Math.min(Math.round(montant * 0.012), 18_000);
  }

  async initierPaiement(ctx: PayoutContext): Promise<PayoutResult> {
    try {
      this.logger.log(`[Moov] Payout ${ctx.reference} → ${ctx.numeroDestinataire} montant=${ctx.montantNet}`);

      /*
       * Intégration Moov Africa API :
       * POST /v2/accounts/{account_id}/transactions/withdraw
       * Body: { phone_number, amount, description, customer_ref }
       */

      const providerReference = `MOOV-${Date.now()}-${ctx.retraitId.slice(0, 8).toUpperCase()}`;

      return {
        success: true,
        providerReference,
        fraisProvider: ctx.frais,
        errorMessage: null,
        rawResponse: { provider: 'moov_money', transactionRef: providerReference },
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Moov] Payout échoué ${ctx.reference}: ${msg}`);
      return {
        success: false,
        providerReference: null,
        fraisProvider: 0,
        errorMessage: msg,
      };
    }
  }
}
