/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/payout-provider.interface.ts
 *
 * RÔLE    : Contrat commun pour tous les providers de payout.
 *           Chaque méthode (Orange Money, MTN, etc.) l'implémente.
 *           Permet d'activer/désactiver un provider via PlatformSettings.
 * ============================================================ */

import { RetraitMethode } from '../types/settlement-engine.types';
import { PayoutContext, PayoutResult } from '../types/settlement-engine.types';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

export interface IPayoutProvider {
  /** Méthode associée à ce provider. */
  readonly methode: RetraitMethode;

  /** Vérifie si le provider est activé dans PlatformSettings. */
  isEnabled(settings: PlatformSettings): boolean;

  /** Calcule les frais provider pour un montant donné (en GNF). */
  calculerFrais(montant: number): number;

  /** Lance le virement vers le compte destinataire. */
  initierPaiement(ctx: PayoutContext): Promise<PayoutResult>;
}

/** Token d'injection pour la liste de tous les providers. */
export const PAYOUT_PROVIDERS = 'PAYOUT_PROVIDERS';
