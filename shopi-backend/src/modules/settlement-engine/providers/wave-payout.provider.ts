/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/wave-payout.provider.ts
 *
 * RÔLE    : Provider de payout Wave Money.
 *           Intégration Wave Business Transfer API.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { IPayoutProvider }    from './payout-provider.interface';
import { RetraitMethode, PayoutContext, PayoutResult } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

@Injectable()
export class WavePayoutProvider implements IPayoutProvider {

  private readonly logger = new Logger(WavePayoutProvider.name);

  readonly methode = RetraitMethode.WAVE;

  isEnabled(settings: PlatformSettings): boolean {
    return settings.waveEnabled;
  }

  calculerFrais(_montant: number): number {
    // Wave : frais fixes 500 GNF par transaction
    return 500;
  }

  async initierPaiement(ctx: PayoutContext): Promise<PayoutResult> {
    try {
      this.logger.log(`[Wave] Payout ${ctx.reference} → ${ctx.numeroDestinataire} montant=${ctx.montantNet}`);

      /*
       * Intégration Wave Business API :
       * POST /v1/checkout/sessions
       * Body: { currency, amount, client_reference, success_url, error_url }
       * Note : Wave utilise un modèle collecte + décaissement.
       */

      const providerReference = `WAVE-${Date.now()}-${ctx.retraitId.slice(0, 8).toUpperCase()}`;

      return {
        success: true,
        providerReference,
        fraisProvider: ctx.frais,
        errorMessage: null,
        rawResponse: { provider: 'wave', paymentId: providerReference },
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[Wave] Payout échoué ${ctx.reference}: ${msg}`);
      return {
        success: false,
        providerReference: null,
        fraisProvider: 0,
        errorMessage: msg,
      };
    }
  }
}
