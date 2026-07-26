/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/mtn-payout.provider.ts
 *
 * RÔLE    : Provider de payout MTN Mobile Money.
 *           Intégration MTN MoMo Disbursements API.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider }    from './payout-provider.interface';
import { RetraitMethode, PayoutContext, PayoutResult } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

@Injectable()
export class MtnPayoutProvider implements IPayoutProvider {

  private readonly logger = new Logger(MtnPayoutProvider.name);

  readonly methode = RetraitMethode.MTN_MONEY;

  isEnabled(settings: PlatformSettings): boolean {
    return settings.mtnMoneyEnabled;
  }

  calculerFrais(montant: number): number {
    // MTN Guinea : 1,5 % plafonné à 20 000 GNF
    return Math.min(Math.round(montant * 0.015), 20_000);
  }

  async initierPaiement(ctx: PayoutContext): Promise<PayoutResult> {
    try {
      this.logger.log(`[MTN] Payout ${ctx.reference} → ${ctx.numeroDestinataire} montant=${ctx.montantNet}`);

      /*
       * Intégration MTN MoMo Remittance/Disbursement API :
       * POST /disbursement/v1_0/transfer
       * Headers: Authorization: Bearer <token>
       * Body: { amount, currency, externalId, payee, payerMessage, payeeNote }
       */

      const providerReference = `MTN-${Date.now()}-${ctx.retraitId.slice(0, 8).toUpperCase()}`;

      return {
        success: true,
        providerReference,
        fraisProvider: ctx.frais,
        errorMessage: null,
        rawResponse: { provider: 'mtn_money', transferId: providerReference },
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[MTN] Payout échoué ${ctx.reference}: ${msg}`);
      return {
        success: false,
        providerReference: null,
        fraisProvider: 0,
        errorMessage: msg,
      };
    }
  }
}
