/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/orange-money-payout.provider.ts
 *
 * RÔLE    : Provider de payout Orange Money.
 *           Simule l'appel API Orange Money MoMo disbursement.
 *           En production : remplacer initierPaiement par l'API réelle.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider }    from './payout-provider.interface';
import { RetraitMethode, PayoutContext, PayoutResult } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

@Injectable()
export class OrangeMoneyPayoutProvider implements IPayoutProvider {

  private readonly logger = new Logger(OrangeMoneyPayoutProvider.name);

  readonly methode = RetraitMethode.ORANGE_MONEY;

  isEnabled(settings: PlatformSettings): boolean {
    return settings.orangeMoneyEnabled;
  }

  calculerFrais(montant: number): number {
    // Orange Money Guinea : 1 % plafonné à 15 000 GNF
    return Math.min(Math.round(montant * 0.01), 15_000);
  }

  async initierPaiement(ctx: PayoutContext): Promise<PayoutResult> {
    try {
      this.logger.log(`[OrangeMoney] Payout ${ctx.reference} → ${ctx.numeroDestinataire} montant=${ctx.montantNet}`);

      /*
       * Intégration Orange Money MoMo API :
       * POST /v1/disbursements
       * Body: { externalId, amount, currency, payer: { partyIdType: 'MSISDN', partyId } }
       *
       * Remplacer ce stub par l'appel HTTP réel via ConfigService/HttpService.
       */

      const providerReference = `OM-${Date.now()}-${ctx.retraitId.slice(0, 8).toUpperCase()}`;

      return {
        success: true,
        providerReference,
        fraisProvider: ctx.frais,
        errorMessage: null,
        rawResponse: { provider: 'orange_money', transactionId: providerReference },
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[OrangeMoney] Payout échoué ${ctx.reference}: ${msg}`);
      return {
        success: false,
        providerReference: null,
        fraisProvider: 0,
        errorMessage: msg,
      };
    }
  }
}
