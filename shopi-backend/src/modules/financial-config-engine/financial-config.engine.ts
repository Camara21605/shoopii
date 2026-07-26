/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/financial-config.engine.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Orchestrateur principal du moteur de configuration
 *                financière. Point d'entrée unique pour tous les modules.
 * RESPONSABILITES :
 *   - Exposer l'API publique (lecture + écriture + historique)
 *   - Déléguer à Reader, Writer, History sans logique métier propre
 *   - Fournir les méthodes spécialisées par section pour ergonomie
 * DEPENDANCES  :
 *   FinancialConfigReaderService
 *   FinancialConfigWriterService
 *   FinancialConfigHistoryService
 *   FinancialConfigCacheService
 * EXPORTE PAR  : FinancialConfigModule
 * UTILISE PAR  :
 *   CommissionEngine, WalletEngine, SettlementEngine → lecture config
 *   API Super Admin → écriture config
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import { ConfigSection } from '../../database/entities/paiement/configuration-snapshot.entity';

import { FinancialConfigReaderService }  from './services/financial-config-reader.service';
import { FinancialConfigWriterService }  from './services/financial-config-writer.service';
import { FinancialConfigHistoryService, HistoryFilter } from './services/financial-config-history.service';
import { FinancialConfigCacheService }   from './services/financial-config-cache.service';

import {
  ConfigUpdateContext,
  ConfigRollbackContext,
  ConfigUpdateResult,
  ConfigHistoryEntry,
  CommissionConfig,
  PaymentConfig,
  WalletConfig,
  EscrowConfig,
  DisputeConfig,
  SettlementConfig,
  UpdateCommissionDto,
  UpdatePaymentDto,
  UpdateWalletDto,
  UpdateEscrowDto,
  UpdateDisputeDto,
  UpdateSettlementDto,
  UpdateGeneralDto,
} from './types/financial-config.types';

@Injectable()
export class FinancialConfigEngine {

  constructor(
    private readonly reader:  FinancialConfigReaderService,
    private readonly writer:  FinancialConfigWriterService,
    private readonly history: FinancialConfigHistoryService,
    private readonly cache:   FinancialConfigCacheService,
  ) {}

  /* ══════════════════════════════════════════════════════════
   * LECTURE — CONFIG GLOBALE
   * ══════════════════════════════════════════════════════════ */

  /**
   * Retourne l'intégralité de PlatformSettings (cache-aside).
   * Préférer les méthodes spécialisées par section pour réduire le couplage.
   */
  getSettings(): Promise<PlatformSettings> {
    return this.reader.getSettings();
  }

  /* ══════════════════════════════════════════════════════════
   * LECTURE — SECTIONS SPÉCIALISÉES
   * ══════════════════════════════════════════════════════════ */

  /** Vue typée de la section COMMISSION */
  getCommissionConfig(): Promise<CommissionConfig> {
    return this.reader.getCommissionConfig();
  }

  /** Vue typée de la section PAYMENT */
  getPaymentConfig(): Promise<PaymentConfig> {
    return this.reader.getPaymentConfig();
  }

  /** Vue typée de la section WALLET */
  getWalletConfig(): Promise<WalletConfig> {
    return this.reader.getWalletConfig();
  }

  /** Vue typée de la section ESCROW */
  getEscrowConfig(): Promise<EscrowConfig> {
    return this.reader.getEscrowConfig();
  }

  /** Vue typée de la section DISPUTE */
  getDisputeConfig(): Promise<DisputeConfig> {
    return this.reader.getDisputeConfig();
  }

  /** Vue typée de la section SETTLEMENT */
  getSettlementConfig(): Promise<SettlementConfig> {
    return this.reader.getSettlementConfig();
  }

  /* ══════════════════════════════════════════════════════════
   * ÉCRITURE — API GÉNÉRIQUE
   * ══════════════════════════════════════════════════════════ */

  /**
   * Met à jour une section de la configuration financière.
   * Valide, diff, sauvegarde, snapshot, invalide le cache, émet les événements.
   */
  updateConfig(ctx: ConfigUpdateContext): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate(ctx);
  }

  /* ══════════════════════════════════════════════════════════
   * ÉCRITURE — MÉTHODES SPÉCIALISÉES PAR SECTION
   *
   * Chaque méthode construit un ConfigUpdateContext pour la section
   * appropriée, offrant une API plus concise aux appelants.
   * ══════════════════════════════════════════════════════════ */

  /** Met à jour les règles de commission (crée aussi un nouveau CommissionRule) */
  updateCommission(
    dto:               UpdateCommissionDto,
    justification:     string,
    performedByUserId: string | null,
    performedByRole:   string | null,
    ipAddress?:        string | null,
  ): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate({
      section: ConfigSection.COMMISSION, data: dto,
      justification, performedByUserId, performedByRole, ipAddress,
      label: dto.label,
    });
  }

  /** Met à jour les paramètres de paiement */
  updatePayment(
    dto:               UpdatePaymentDto,
    justification:     string,
    performedByUserId: string | null,
    performedByRole:   string | null,
    ipAddress?:        string | null,
  ): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate({
      section: ConfigSection.PAYMENT, data: dto,
      justification, performedByUserId, performedByRole, ipAddress,
    });
  }

  /** Met à jour les limites de wallet */
  updateWallet(
    dto:               UpdateWalletDto,
    justification:     string,
    performedByUserId: string | null,
    performedByRole:   string | null,
    ipAddress?:        string | null,
  ): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate({
      section: ConfigSection.WALLET, data: dto,
      justification, performedByUserId, performedByRole, ipAddress,
    });
  }

  /** Met à jour les paramètres d'escrow */
  updateEscrow(
    dto:               UpdateEscrowDto,
    justification:     string,
    performedByUserId: string | null,
    performedByRole:   string | null,
    ipAddress?:        string | null,
  ): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate({
      section: ConfigSection.ESCROW, data: dto,
      justification, performedByUserId, performedByRole, ipAddress,
    });
  }

  /** Met à jour les paramètres de litiges */
  updateDispute(
    dto:               UpdateDisputeDto,
    justification:     string,
    performedByUserId: string | null,
    performedByRole:   string | null,
    ipAddress?:        string | null,
  ): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate({
      section: ConfigSection.DISPUTE, data: dto,
      justification, performedByUserId, performedByRole, ipAddress,
    });
  }

  /** Met à jour les paramètres de settlement/retrait */
  updateSettlement(
    dto:               UpdateSettlementDto,
    justification:     string,
    performedByUserId: string | null,
    performedByRole:   string | null,
    ipAddress?:        string | null,
  ): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate({
      section: ConfigSection.SETTLEMENT, data: dto,
      justification, performedByUserId, performedByRole, ipAddress,
    });
  }

  /** Met à jour les paramètres généraux */
  updateGeneral(
    dto:               UpdateGeneralDto,
    justification:     string,
    performedByUserId: string | null,
    performedByRole:   string | null,
    ipAddress?:        string | null,
  ): Promise<ConfigUpdateResult> {
    return this.writer.applyUpdate({
      section: ConfigSection.GENERAL, data: dto,
      justification, performedByUserId, performedByRole, ipAddress,
    });
  }

  /* ══════════════════════════════════════════════════════════
   * ROLLBACK
   * ══════════════════════════════════════════════════════════ */

  /**
   * Restaure une section à l'état d'une version précédente.
   * Crée un nouveau snapshot marqué isRollback = true.
   * L'historique n'est jamais altéré.
   */
  rollbackToVersion(ctx: ConfigRollbackContext): Promise<ConfigUpdateResult> {
    return this.writer.applyRollback(ctx);
  }

  /* ══════════════════════════════════════════════════════════
   * HISTORIQUE
   * ══════════════════════════════════════════════════════════ */

  /**
   * Retourne l'historique paginé des modifications.
   * Filtrable par section, auteur, dates.
   */
  getHistory(filter?: HistoryFilter): Promise<{ items: ConfigHistoryEntry[]; total: number }> {
    return this.history.getHistory(filter);
  }

  /** Récupère un snapshot précis par section et numéro de version */
  getSnapshot(section: ConfigSection, version: number): Promise<ConfigHistoryEntry | null> {
    return this.history.getSnapshot(section, version);
  }

  /** Retourne le numéro de version courant pour une section */
  getLatestVersion(section: ConfigSection): Promise<number> {
    return this.history.getLatestVersion(section);
  }

  /* ══════════════════════════════════════════════════════════
   * CACHE UTILITIES
   * ══════════════════════════════════════════════════════════ */

  /** Retourne true si le cache est frais */
  isCacheValid(): boolean {
    return this.cache.isValid();
  }

  /** Retourne le TTL restant du cache en millisecondes */
  cacheTtlMs(): number {
    return this.cache.ttlMs();
  }

  /** Force l'invalidation du cache (opération admin) */
  invalidateCache(): void {
    this.cache.invalidateAll();
  }
}
