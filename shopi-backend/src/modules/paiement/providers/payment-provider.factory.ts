/* ============================================================
 * FICHIER : src/modules/paiement/providers/payment-provider.factory.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Factory qui résout le bon IPaymentProvider selon :
 *   1. La variable d'env PAYMENT_PROVIDER (provider par défaut)
 *   2. La méthode de paiement choisie par le client
 *
 * ─────────────────────────────────────────────────────────────
 * PRIORITÉ DE RÉSOLUTION
 * ─────────────────────────────────────────────────────────────
 *
 *   1. Si `PAYMENT_PROVIDER=internal` → toujours InternalProvider
 *   2. Sinon → cherche le premier provider qui supporte la méthode
 *   3. Fallback → InternalProvider (jamais de crash)
 *
 * ─────────────────────────────────────────────────────────────
 * AJOUTER UN PROVIDER
 * ─────────────────────────────────────────────────────────────
 *
 *   1. Créer `monprovider.provider.ts` qui implémente IPaymentProvider
 *   2. L'injecter ici dans le constructeur
 *   3. L'ajouter à `this.providers`
 *   4. L'injecter en provider dans PaiementModule
 *
 * ─────────────────────────────────────────────────────────────
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/modules/paiement/providers/payment-provider.factory.ts
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';

import type { IPaymentProvider }  from './payment-provider.interface';
import { InternalProvider }       from './internal.provider';
import { FedaPayProvider }        from './fedapay.provider';
import { MethodePaiementSession } from '../../../database/entities/paiement/paiement-session.entity';

@Injectable()
export class PaymentProviderFactory {

  private readonly logger = new Logger(PaymentProviderFactory.name);

  /** Liste ordonnée de tous les providers disponibles */
  private readonly providers: IPaymentProvider[];

  /** Provider configuré par PAYMENT_PROVIDER env var */
  private readonly defaultProviderName: string;

  constructor(
    private readonly config:           ConfigService,
    private readonly internalProvider: InternalProvider,
    private readonly fedaPayProvider:  FedaPayProvider,
  ) {
    this.defaultProviderName = config.get<string>('PAYMENT_PROVIDER') ?? 'internal';

    /* Ordre des providers : plus prioritaire en premier */
    this.providers = [
      this.fedaPayProvider,
      this.internalProvider,
    ];

    this.logger.log(`[PaymentFactory] Provider par défaut: ${this.defaultProviderName}`);
  }

  /* ── Résolution du provider ─────────────────────────────── */

  /**
   * Retourne le provider approprié pour une méthode de paiement.
   *
   * Règles :
   *   - Si PAYMENT_PROVIDER=internal → toujours Internal (mode dev)
   *   - Sinon cherche le 1er provider qui supporte la méthode
   *   - Fallback sur Internal si aucun provider externe ne supporte
   */
  resolve(methode: MethodePaiementSession): IPaymentProvider {
    /* Mode développement forcé */
    if (this.defaultProviderName === 'internal') {
      this.logger.debug(`[PaymentFactory] Mode interne — provider: internal`);
      return this.internalProvider;
    }

    /* Cherche le provider configuré explicitement */
    if (this.defaultProviderName !== 'auto') {
      const named = this.providers.find(p => p.name === this.defaultProviderName);
      if (named && named.supportedMethods.includes(methode)) {
        this.logger.debug(`[PaymentFactory] Provider: ${named.name} — méthode: ${methode}`);
        return named;
      }
    }

    /* Auto-routing : premier provider qui supporte la méthode */
    const auto = this.providers.find(
      p => p.name !== 'internal' && p.supportedMethods.includes(methode),
    );

    if (auto) {
      this.logger.debug(`[PaymentFactory] Auto-routing → ${auto.name} — méthode: ${methode}`);
      return auto;
    }

    /* Fallback ultime : internal (ne devrait pas arriver en prod) */
    this.logger.warn(
      `[PaymentFactory] Aucun provider externe pour la méthode "${methode}" — fallback internal`,
    );
    return this.internalProvider;
  }

  /**
   * Retourne le provider par son nom exact.
   * Utilisé pour le traitement des webhooks entrants.
   */
  resolveByName(name: string): IPaymentProvider {
    const found = this.providers.find(p => p.name === name);
    if (!found) {
      throw new Error(`[PaymentFactory] Provider inconnu: "${name}"`);
    }
    return found;
  }
}
