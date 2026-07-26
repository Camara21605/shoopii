/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/payout-provider.factory.ts
 *
 * RÔLE    : Résout le provider correct selon la méthode de retrait
 *           et vérifie qu'il est activé dans PlatformSettings.
 *
 * EXTENSIBILITÉ : ajouter un provider = ajouter une injection
 *   ici + l'enregistrer dans SettlementEngineModule.providers.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { IPayoutProvider }          from './payout-provider.interface';
import { OrangeMoneyPayoutProvider } from './orange-money-payout.provider';
import { MtnPayoutProvider }         from './mtn-payout.provider';
import { WavePayoutProvider }        from './wave-payout.provider';
import { DjomyPayoutProvider }       from './djomy-payout.provider';
import { BankTransferPayoutProvider } from './bank-transfer-payout.provider';
import { MoovMoneyPayoutProvider }   from './moov-money-payout.provider';
import { RetraitMethode, SettlementErreur, SettlementErreurType } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

@Injectable()
export class PayoutProviderFactory {

  private readonly providers: Map<RetraitMethode, IPayoutProvider>;

  constructor(
    private readonly orangeMoney:  OrangeMoneyPayoutProvider,
    private readonly mtn:          MtnPayoutProvider,
    private readonly wave:         WavePayoutProvider,
    private readonly djomy:        DjomyPayoutProvider,
    private readonly bankTransfer: BankTransferPayoutProvider,
    private readonly moovMoney:    MoovMoneyPayoutProvider,
  ) {
    this.providers = new Map<RetraitMethode, IPayoutProvider>([
      [RetraitMethode.ORANGE_MONEY,    this.orangeMoney],
      [RetraitMethode.MTN_MONEY,       this.mtn],
      [RetraitMethode.WAVE,            this.wave],
      [RetraitMethode.DJOMY,           this.djomy],
      [RetraitMethode.VIREMENT_BANCAIRE, this.bankTransfer],
      [RetraitMethode.MOOV_MONEY,      this.moovMoney],
    ]);
  }

  /**
   * Retourne le provider pour la méthode donnée, après vérification
   * que ce provider est activé dans les settings de la plateforme.
   */
  getProvider(methode: RetraitMethode, settings: PlatformSettings): IPayoutProvider {
    const provider = this.providers.get(methode);

    if (!provider) {
      throw new SettlementErreur(
        SettlementErreurType.METHODE_INDISPONIBLE,
        `Méthode de retrait non supportée : ${methode}`,
        { methode },
      );
    }

    if (!provider.isEnabled(settings)) {
      throw new SettlementErreur(
        SettlementErreurType.METHODE_INDISPONIBLE,
        `La méthode ${methode} est désactivée sur cette plateforme.`,
        { methode },
      );
    }

    return provider;
  }

  /** Liste toutes les méthodes actuellement activées. */
  getMethodesActives(settings: PlatformSettings): RetraitMethode[] {
    return Array.from(this.providers.entries())
      .filter(([, p]) => p.isEnabled(settings))
      .map(([m]) => m);
  }
}
