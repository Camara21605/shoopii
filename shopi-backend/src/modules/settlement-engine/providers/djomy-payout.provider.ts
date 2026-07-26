/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/djomy-payout.provider.ts
 *
 * RÔLE    : Provider de payout Djomy (fintech locale guinéenne).
 *           API REST Djomy — stub prêt pour intégration réelle.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider }    from './payout-provider.interface';
import { RetraitMethode, PayoutContext, PayoutResult } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

@Injectable()
export class DjomyPayoutProvider implements IPayoutProvider {

  private readonly logger = new Logger(DjomyPayoutProvider.name);

  readonly methode = RetraitMethode.DJOMY;

  isEnabled(settings: PlatformSettings): boolean {
    return settings.djomyEnabled;
  }

  calculerFrais(montant: number): number {
    // Djomy : 0,8 % plafonné à 10 000 GNF
    return Math.min(Math.round(montant * 0.008), 10_000);
  }

  async initierPaiement(ctx: PayoutContext): Promise<PayoutResult> {
    try {
      this.logger.log(`[Djomy] Payout ${ctx.reference} → ${ctx.numeroDestinataire} montant=${ctx.montantNet}`);

      /*
       * Intégration Djomy Payout API :
       * POST /api/v1/payouts
       * Headers: X-Api-Key: <key>
       * Body: { reference, amount, currency: 'GNF', beneficiary_phone, description }
       */

      const providerReference = `DJOMY-${Date.now()}-${ctx.retraitId.slice(0, 8).toUpperCase()}`;

      return {
        success: true,
        providerReference,
        fraisProvider: ctx.frais,
        errorMessage: null,
        rawResponse: { provider: 'djomy', payoutId: providerReference },
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Djomy] Payout échoué ${ctx.reference}: ${msg}`);
      return {
        success: false,
        providerReference: null,
        fraisProvider: 0,
        errorMessage: msg,
      };
    }
  }
}
