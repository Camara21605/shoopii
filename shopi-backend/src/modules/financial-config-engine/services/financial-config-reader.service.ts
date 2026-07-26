/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/services/financial-config-reader.service.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Lecture des paramètres financiers via cache puis base.
 *                Source unique de vérité pour toutes les lectures
 *                de configuration des moteurs financiers.
 * RESPONSABILITES :
 *   - Lire PlatformSettings depuis le cache ou la base de données
 *   - Retourner des vues typées par section (CommissionConfig, etc.)
 *   - Initialiser la ligne singleton si la table est vide
 * DEPENDANCES  :
 *   PlatformSettings (TypeORM)
 *   FinancialConfigCacheService
 * UTILISE PAR  :
 *   FinancialConfigEngine → getSettings, getCommissionConfig, etc.
 *   FinancialConfigWriterService → charge les valeurs actuelles pour diff
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { FinancialConfigCacheService } from './financial-config-cache.service';
import {
  ConfigErreur,
  ConfigErreurType,
  CommissionConfig,
  PaymentConfig,
  WalletConfig,
  EscrowConfig,
  DisputeConfig,
  SettlementConfig,
} from '../types/financial-config.types';

@Injectable()
export class FinancialConfigReaderService {

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly settingsRepo: Repository<PlatformSettings>,
    private readonly cache:        FinancialConfigCacheService,
  ) {}

  /* ----------------------------------------------------------
   * getSettings()
   *
   * Retourne l'intégralité de PlatformSettings.
   * Stratégie cache-aside :
   *   1. Cache frais → retour immédiat
   *   2. Cache expiré / absent → lecture DB + mise en cache
   *
   * Lève ConfigErreur.SETTINGS_INTROUVABLE si la table est vide.
   * En production cette situation ne devrait pas arriver car
   * la table est initialisée au démarrage de la plateforme.
   * ---------------------------------------------------------- */
  async getSettings(): Promise<PlatformSettings> {
    const cached = this.cache.get();
    if (cached) return cached;

    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (!settings) {
      throw new ConfigErreur(
        ConfigErreurType.SETTINGS_INTROUVABLE,
        'PlatformSettings introuvable. La plateforme doit être initialisée.',
      );
    }

    this.cache.set(settings);
    return settings;
  }

  /* ----------------------------------------------------------
   * getCommissionConfig()
   *
   * Vue typée de la section COMMISSION.
   * Utilisée par CommissionEngine pour calculer les taux.
   * ---------------------------------------------------------- */
  async getCommissionConfig(): Promise<CommissionConfig> {
    const s = await this.getSettings();
    return {
      tauxCommissionProduit:    +s.tauxCommissionProduit,
      planMultiplierStandard:   1.0,
      planMultiplierPro:        +s.planMultiplierPro,
      planMultiplierPremium:    +s.planMultiplierPremium,
      ratioShopiProduit:        +s.ratioShopiProduit,
      ratioPartenaireProduit:   +s.ratioPartenaireProduit,
      ratioAdminProduit:        +s.ratioAdminProduit,
      tauxCommissionLivraison:  +s.tauxCommissionLivraison,
      ratioShopiLivraison:      +s.ratioShopiLivraison,
      ratioPartenaireLivraison: +s.ratioPartenaireLivraison,
      ratioAdminLivraison:      +s.ratioAdminLivraison,
    };
  }

  /* ----------------------------------------------------------
   * getPaymentConfig()
   *
   * Vue typée de la section PAYMENT.
   * Utilisée par PaymentEngine pour connaître les providers actifs.
   * ---------------------------------------------------------- */
  async getPaymentConfig(): Promise<PaymentConfig> {
    const s = await this.getSettings();
    return {
      orangeMoneyEnabled:      s.orangeMoneyEnabled,
      mtnMoneyEnabled:         s.mtnMoneyEnabled,
      waveEnabled:             s.waveEnabled,
      moovMoneyEnabled:        s.moovMoneyEnabled,
      djomyEnabled:            s.djomyEnabled,
      maxTransactionAmount:    +s.maxTransactionAmount,
      maxDailyPaymentAttempts: s.maxDailyPaymentAttempts,
      sessionTtlMinutes:       s.sessionTtlMinutes,
      maxPaymentDelayHours:    s.maxPaymentDelayHours,
    };
  }

  /* ----------------------------------------------------------
   * getWalletConfig()
   * ---------------------------------------------------------- */
  async getWalletConfig(): Promise<WalletConfig> {
    const s = await this.getSettings();
    return {
      dailyWithdrawalLimit:  +s.dailyWithdrawalLimit,
      walletInactivityDays:  s.walletInactivityDays,
      settlementDelayDays:   s.settlementDelayDays,
    };
  }

  /* ----------------------------------------------------------
   * getEscrowConfig()
   * ---------------------------------------------------------- */
  async getEscrowConfig(): Promise<EscrowConfig> {
    const s = await this.getSettings();
    return {
      maxEnterpriseValidationHours: s.maxEnterpriseValidationHours,
      refundProcessingDays:         s.refundProcessingDays,
    };
  }

  /* ----------------------------------------------------------
   * getDisputeConfig()
   * ---------------------------------------------------------- */
  async getDisputeConfig(): Promise<DisputeConfig> {
    const s = await this.getSettings();
    return {
      disputeWindowDays:          s.disputeWindowDays,
      disputeResolutionHours:     s.disputeResolutionHours,
      maxEvidencesPerDispute:     s.maxEvidencesPerDispute,
      disputeInstructionSlaHours: s.disputeInstructionSlaHours,
    };
  }

  /* ----------------------------------------------------------
   * getSettlementConfig()
   * ---------------------------------------------------------- */
  async getSettlementConfig(): Promise<SettlementConfig> {
    const s = await this.getSettings();
    return {
      minWithdrawalAmount:       +s.minWithdrawalAmount,
      maxTransactionAmount:      +s.maxTransactionAmount,
      autoValidationThreshold:   +s.autoValidationThreshold,
      maxWithdrawalAttempts:     s.maxWithdrawalAttempts,
      withdrawalProcessingHours: s.withdrawalProcessingHours,
    };
  }
}
