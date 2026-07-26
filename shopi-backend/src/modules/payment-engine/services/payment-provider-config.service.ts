/* ============================================================
 * FICHIER : src/modules/payment-engine/services/payment-provider-config.service.ts
 *
 * RÔLE
 * ------------------------------------------------------------
 * Gère la configuration dynamique des providers de paiement.
 * Permet au Super Admin d'activer/désactiver un provider,
 * de configurer les clés API et de définir les limites.
 * ============================================================ */

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import {
  ProviderConfig,
  ProviderEnvironment,
} from '../../../database/entities/paiement/provider-config.entity';
import { PaiementProvider } from '../../../database/entities/paiement/paiement-session.entity';
import { PaymentErreur, PaymentErreurType } from '../types/payment-engine.types';

@Injectable()
export class PaymentProviderConfigService {

  private readonly logger = new Logger(PaymentProviderConfigService.name);

  constructor(
    @InjectRepository(ProviderConfig)
    private readonly configRepo: Repository<ProviderConfig>,
  ) {}

  /* ── Lecture ─────────────────────────────────────────────── */

  async findAll(): Promise<ProviderConfig[]> {
    return this.configRepo.find({ order: { provider: 'ASC' } });
  }

  async findByProvider(provider: PaiementProvider): Promise<ProviderConfig | null> {
    return this.configRepo.findOne({ where: { provider } });
  }

  async getActiveConfig(provider: PaiementProvider): Promise<ProviderConfig> {
    const config = await this.findByProvider(provider);
    if (!config) {
      throw new PaymentErreur(
        PaymentErreurType.CONFIG_PROVIDER_MANQUANTE,
        `Aucune configuration pour le provider "${provider}"`,
        { provider },
      );
    }
    if (!config.isActive) {
      throw new PaymentErreur(
        PaymentErreurType.PROVIDER_INACTIF,
        `Le provider "${provider}" est désactivé`,
        { provider },
      );
    }
    return config;
  }

  /** Retourne la clé API effective selon l'environnement configuré */
  getEffectiveApiKey(config: ProviderConfig): string | null {
    return config.environment === ProviderEnvironment.PRODUCTION
      ? config.apiKey
      : config.testApiKey;
  }

  getEffectiveApiSecret(config: ProviderConfig): string | null {
    return config.environment === ProviderEnvironment.PRODUCTION
      ? config.apiSecret
      : config.testApiSecret;
  }

  getEffectiveWebhookSecret(config: ProviderConfig): string | null {
    return config.environment === ProviderEnvironment.PRODUCTION
      ? config.webhookSecret
      : config.testWebhookSecret;
  }

  /* ── Création / initialisation ───────────────────────────── */

  async upsert(
    provider: PaiementProvider,
    data: Partial<Omit<ProviderConfig, 'id' | 'provider' | 'createdAt' | 'updatedAt'>>,
    adminUserId?: string,
  ): Promise<ProviderConfig> {
    let config = await this.findByProvider(provider);

    if (!config) {
      config = this.configRepo.create({ provider, ...data });
      this.logger.log(`[ProviderConfig] Création config provider ${provider}`);
    } else {
      Object.assign(config, data);
    }

    if (adminUserId) {
      config.activatedByUserId = adminUserId;
    }

    return this.configRepo.save(config);
  }

  /* ── Activation / désactivation ──────────────────────────── */

  async activer(provider: PaiementProvider, adminUserId: string): Promise<ProviderConfig> {
    const config = await this.findByProvider(provider);
    if (!config) {
      throw new NotFoundException(`Aucune configuration pour le provider "${provider}". Créez-la d'abord.`);
    }

    config.isActive            = true;
    config.activatedAt         = new Date();
    config.activatedByUserId   = adminUserId;
    config.deactivatedAt       = null;
    config.deactivatedByUserId = null;

    this.logger.log(`[ProviderConfig] Provider ${provider} ACTIVÉ par ${adminUserId}`);
    return this.configRepo.save(config);
  }

  async desactiver(provider: PaiementProvider, adminUserId: string): Promise<ProviderConfig> {
    const config = await this.findByProvider(provider);
    if (!config) {
      throw new NotFoundException(`Aucune configuration pour le provider "${provider}"`);
    }

    config.isActive            = false;
    config.deactivatedAt       = new Date();
    config.deactivatedByUserId = adminUserId;

    this.logger.log(`[ProviderConfig] Provider ${provider} DÉSACTIVÉ par ${adminUserId}`);
    return this.configRepo.save(config);
  }

  /* ── Validation de montant ───────────────────────────────── */

  validerMontant(config: ProviderConfig, montant: number): void {
    if (montant < Number(config.minAmount)) {
      throw new PaymentErreur(
        PaymentErreurType.MONTANT_INVALIDE,
        `Montant ${montant} inférieur au minimum ${config.minAmount} pour ${config.provider}`,
        { montant, minAmount: config.minAmount, provider: config.provider },
      );
    }
    if (montant > Number(config.maxAmount)) {
      throw new PaymentErreur(
        PaymentErreurType.MONTANT_INVALIDE,
        `Montant ${montant} supérieur au maximum ${config.maxAmount} pour ${config.provider}`,
        { montant, maxAmount: config.maxAmount, provider: config.provider },
      );
    }
  }

  /* ── Statistiques provider ───────────────────────────────── */

  isProviderActive(provider: PaiementProvider, configs: ProviderConfig[]): boolean {
    const config = configs.find(c => c.provider === provider);
    return config?.isActive ?? false;
  }
}
