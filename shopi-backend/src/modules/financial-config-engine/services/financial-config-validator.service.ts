/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/services/financial-config-validator.service.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Validation des DTO avant application sur PlatformSettings.
 *                Garantit la cohérence des règles métier financières.
 * RESPONSABILITES :
 *   - Valider chaque section selon ses invariants métier
 *   - Lever ConfigErreur.VALIDATION_ECHOUEE avec message détaillé
 *   - Vérifier les invariants cross-champs (ex. ratios = 100)
 * DEPENDANCES  :
 *   ConfigSection, ConfigErreur, UpdateCommissionDto, etc.
 * UTILISE PAR  :
 *   FinancialConfigWriterService → appelle validateSection() avant toute écriture
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { ConfigSection } from '../../../database/entities/paiement/configuration-snapshot.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import {
  ConfigErreur,
  ConfigErreurType,
  UpdateCommissionDto,
  UpdatePaymentDto,
  UpdateWalletDto,
  UpdateEscrowDto,
  UpdateDisputeDto,
  UpdateSettlementDto,
  UpdateGeneralDto,
  AnyUpdateDto,
} from '../types/financial-config.types';

@Injectable()
export class FinancialConfigValidatorService {

  /* ----------------------------------------------------------
   * validateSection()
   *
   * Point d'entrée principal. Délègue à la méthode spécialisée
   * selon la section concernée.
   * Lance ConfigErreur si la validation échoue.
   * ---------------------------------------------------------- */
  validateSection(section: ConfigSection, dto: AnyUpdateDto, current: PlatformSettings): void {
    switch (section) {
      case ConfigSection.COMMISSION:
        this._validateCommission(dto as UpdateCommissionDto, current);
        break;
      case ConfigSection.PAYMENT:
        this._validatePayment(dto as UpdatePaymentDto, current);
        break;
      case ConfigSection.WALLET:
        this._validateWallet(dto as UpdateWalletDto, current);
        break;
      case ConfigSection.ESCROW:
        this._validateEscrow(dto as UpdateEscrowDto);
        break;
      case ConfigSection.DISPUTE:
        this._validateDispute(dto as UpdateDisputeDto);
        break;
      case ConfigSection.SETTLEMENT:
        this._validateSettlement(dto as UpdateSettlementDto, current);
        break;
      case ConfigSection.GENERAL:
        this._validateGeneral(dto as UpdateGeneralDto);
        break;
    }
  }

  /* ----------------------------------------------------------
   * SECTION COMMISSION
   * ---------------------------------------------------------- */
  private _validateCommission(dto: UpdateCommissionDto, current: PlatformSettings): void {
    const errors: string[] = [];

    /* Taux produit */
    if (dto.tauxCommissionProduit !== undefined) {
      if (dto.tauxCommissionProduit < 0 || dto.tauxCommissionProduit > 50) {
        errors.push('tauxCommissionProduit doit être entre 0 et 50 %');
      }
    }

    /* Taux livraison */
    if (dto.tauxCommissionLivraison !== undefined) {
      if (dto.tauxCommissionLivraison < 0 || dto.tauxCommissionLivraison > 50) {
        errors.push('tauxCommissionLivraison doit être entre 0 et 50 %');
      }
    }

    /* Multiplicateurs plan (entre 0.01 et 1.0) */
    if (dto.planMultiplierPro !== undefined) {
      if (dto.planMultiplierPro <= 0 || dto.planMultiplierPro > 1) {
        errors.push('planMultiplierPro doit être entre 0.01 et 1.0');
      }
    }
    if (dto.planMultiplierPremium !== undefined) {
      if (dto.planMultiplierPremium <= 0 || dto.planMultiplierPremium > 1) {
        errors.push('planMultiplierPremium doit être entre 0.01 et 1.0');
      }
    }
    /* planMultiplierPremium doit être <= planMultiplierPro (PREMIUM est plus avantageux) */
    const effectivePro     = dto.planMultiplierPro     ?? +current.planMultiplierPro;
    const effectivePremium = dto.planMultiplierPremium ?? +current.planMultiplierPremium;
    if (effectivePremium > effectivePro) {
      errors.push(
        `planMultiplierPremium (${effectivePremium}) doit être ≤ planMultiplierPro (${effectivePro})`,
      );
    }

    /* Invariant ratios PRODUIT : somme = 100 */
    const shopi     = dto.ratioShopiProduit      ?? +current.ratioShopiProduit;
    const partenaire= dto.ratioPartenaireProduit  ?? +current.ratioPartenaireProduit;
    const admin     = dto.ratioAdminProduit       ?? +current.ratioAdminProduit;
    const sumProduit= shopi + partenaire + admin;
    if (Math.abs(sumProduit - 100) > 0.01) {
      errors.push(
        `Les ratios produit (Shopi ${shopi} + Partenaire ${partenaire} + Admin ${admin}) ` +
        `doivent sommer à 100, obtenu ${sumProduit}`,
      );
    }

    /* Invariant ratios LIVRAISON : somme = 100 */
    const shopiL     = dto.ratioShopiLivraison      ?? +current.ratioShopiLivraison;
    const partenaireL= dto.ratioPartenaireLivraison  ?? +current.ratioPartenaireLivraison;
    const adminL     = dto.ratioAdminLivraison       ?? +current.ratioAdminLivraison;
    const sumLivraison = shopiL + partenaireL + adminL;
    if (Math.abs(sumLivraison - 100) > 0.01) {
      errors.push(
        `Les ratios livraison (Shopi ${shopiL} + Partenaire ${partenaireL} + Admin ${adminL}) ` +
        `doivent sommer à 100, obtenu ${sumLivraison}`,
      );
    }

    /* Ratios individuels : 0-100 */
    for (const [key, val] of Object.entries({
      ratioShopiProduit: shopi, ratioPartenaireProduit: partenaire, ratioAdminProduit: admin,
      ratioShopiLivraison: shopiL, ratioPartenaireLivraison: partenaireL, ratioAdminLivraison: adminL,
    })) {
      if (val < 0 || val > 100) errors.push(`${key} doit être entre 0 et 100`);
    }

    this._throwIfErrors(errors, ConfigSection.COMMISSION);
  }

  /* ----------------------------------------------------------
   * SECTION PAYMENT
   * ---------------------------------------------------------- */
  private _validatePayment(dto: UpdatePaymentDto, current: PlatformSettings): void {
    const errors: string[] = [];

    if (dto.maxTransactionAmount !== undefined && dto.maxTransactionAmount <= 0) {
      errors.push('maxTransactionAmount doit être > 0');
    }
    if (dto.maxDailyPaymentAttempts !== undefined) {
      if (dto.maxDailyPaymentAttempts < 1 || dto.maxDailyPaymentAttempts > 50) {
        errors.push('maxDailyPaymentAttempts doit être entre 1 et 50');
      }
    }
    if (dto.sessionTtlMinutes !== undefined) {
      if (dto.sessionTtlMinutes < 5 || dto.sessionTtlMinutes > 1440) {
        errors.push('sessionTtlMinutes doit être entre 5 et 1440 (24h)');
      }
    }
    if (dto.maxPaymentDelayHours !== undefined) {
      if (dto.maxPaymentDelayHours < 1 || dto.maxPaymentDelayHours > 168) {
        errors.push('maxPaymentDelayHours doit être entre 1 et 168 heures (7 jours)');
      }
    }

    /* Au moins un provider actif après la modification */
    const providers = {
      orangeMoney: dto.orangeMoneyEnabled ?? current.orangeMoneyEnabled,
      mtnMoney:    dto.mtnMoneyEnabled    ?? current.mtnMoneyEnabled,
      wave:        dto.waveEnabled        ?? current.waveEnabled,
      moovMoney:   dto.moovMoneyEnabled   ?? current.moovMoneyEnabled,
      djomy:       dto.djomyEnabled       ?? current.djomyEnabled,
    };
    if (!Object.values(providers).some(Boolean)) {
      errors.push('Au moins un provider de paiement doit rester activé');
    }

    this._throwIfErrors(errors, ConfigSection.PAYMENT);
  }

  /* ----------------------------------------------------------
   * SECTION WALLET
   * ---------------------------------------------------------- */
  private _validateWallet(dto: UpdateWalletDto, current: PlatformSettings): void {
    const errors: string[] = [];

    if (dto.dailyWithdrawalLimit !== undefined && dto.dailyWithdrawalLimit < 0) {
      errors.push('dailyWithdrawalLimit doit être ≥ 0 (0 = aucune limite)');
    }
    if (dto.walletInactivityDays !== undefined) {
      if (dto.walletInactivityDays < 30) {
        errors.push('walletInactivityDays doit être ≥ 30 jours');
      }
    }
    if (dto.settlementDelayDays !== undefined) {
      if (dto.settlementDelayDays < 0 || dto.settlementDelayDays > 30) {
        errors.push('settlementDelayDays doit être entre 0 et 30 jours ouvrés');
      }
    }
    /* dailyWithdrawalLimit >= minWithdrawalAmount (si les deux sont spécifiés ou existants) */
    const effectiveLimit = dto.dailyWithdrawalLimit ?? +current.dailyWithdrawalLimit;
    const minWithdrawal  = +current.minWithdrawalAmount;
    if (effectiveLimit > 0 && effectiveLimit < minWithdrawal) {
      errors.push(
        `dailyWithdrawalLimit (${effectiveLimit}) doit être ≥ minWithdrawalAmount (${minWithdrawal})`,
      );
    }

    this._throwIfErrors(errors, ConfigSection.WALLET);
  }

  /* ----------------------------------------------------------
   * SECTION ESCROW
   * ---------------------------------------------------------- */
  private _validateEscrow(dto: UpdateEscrowDto): void {
    const errors: string[] = [];

    if (dto.maxEnterpriseValidationHours !== undefined) {
      if (dto.maxEnterpriseValidationHours < 1 || dto.maxEnterpriseValidationHours > 720) {
        errors.push('maxEnterpriseValidationHours doit être entre 1 et 720 heures (30 jours)');
      }
    }
    if (dto.refundProcessingDays !== undefined) {
      if (dto.refundProcessingDays < 1 || dto.refundProcessingDays > 30) {
        errors.push('refundProcessingDays doit être entre 1 et 30 jours');
      }
    }

    this._throwIfErrors(errors, ConfigSection.ESCROW);
  }

  /* ----------------------------------------------------------
   * SECTION DISPUTE
   * ---------------------------------------------------------- */
  private _validateDispute(dto: UpdateDisputeDto): void {
    const errors: string[] = [];

    if (dto.disputeWindowDays !== undefined) {
      if (dto.disputeWindowDays < 1 || dto.disputeWindowDays > 90) {
        errors.push('disputeWindowDays doit être entre 1 et 90 jours');
      }
    }
    if (dto.disputeResolutionHours !== undefined) {
      if (dto.disputeResolutionHours < 1 || dto.disputeResolutionHours > 720) {
        errors.push('disputeResolutionHours doit être entre 1 et 720 heures');
      }
    }
    if (dto.maxEvidencesPerDispute !== undefined) {
      if (dto.maxEvidencesPerDispute < 1 || dto.maxEvidencesPerDispute > 50) {
        errors.push('maxEvidencesPerDispute doit être entre 1 et 50');
      }
    }
    if (dto.disputeInstructionSlaHours !== undefined) {
      if (dto.disputeInstructionSlaHours < 1 || dto.disputeInstructionSlaHours > 720) {
        errors.push('disputeInstructionSlaHours doit être entre 1 et 720 heures');
      }
    }

    this._throwIfErrors(errors, ConfigSection.DISPUTE);
  }

  /* ----------------------------------------------------------
   * SECTION SETTLEMENT
   * ---------------------------------------------------------- */
  private _validateSettlement(dto: UpdateSettlementDto, current: PlatformSettings): void {
    const errors: string[] = [];

    const minWithdrawal        = dto.minWithdrawalAmount      ?? +current.minWithdrawalAmount;
    const maxTx                = dto.maxTransactionAmount     ?? +current.maxTransactionAmount;
    const autoThreshold        = dto.autoValidationThreshold  ?? +current.autoValidationThreshold;
    const maxAttempts          = dto.maxWithdrawalAttempts    ?? current.maxWithdrawalAttempts;

    if (minWithdrawal <= 0) errors.push('minWithdrawalAmount doit être > 0');
    if (maxTx <= 0)         errors.push('maxTransactionAmount doit être > 0');

    if (minWithdrawal > maxTx) {
      errors.push(
        `minWithdrawalAmount (${minWithdrawal}) doit être ≤ maxTransactionAmount (${maxTx})`,
      );
    }
    if (autoThreshold < minWithdrawal) {
      errors.push(
        `autoValidationThreshold (${autoThreshold}) doit être ≥ minWithdrawalAmount (${minWithdrawal})`,
      );
    }
    if (maxAttempts < 1 || maxAttempts > 10) {
      errors.push('maxWithdrawalAttempts doit être entre 1 et 10');
    }
    if (dto.withdrawalProcessingHours !== undefined) {
      if (dto.withdrawalProcessingHours < 1 || dto.withdrawalProcessingHours > 720) {
        errors.push('withdrawalProcessingHours doit être entre 1 et 720 heures');
      }
    }

    this._throwIfErrors(errors, ConfigSection.SETTLEMENT);
  }

  /* ----------------------------------------------------------
   * SECTION GENERAL
   * ---------------------------------------------------------- */
  private _validateGeneral(dto: UpdateGeneralDto): void {
    const errors: string[] = [];

    if (dto.platformName !== undefined) {
      if (!dto.platformName.trim()) errors.push('platformName ne peut pas être vide');
      if (dto.platformName.length > 100) errors.push('platformName doit faire ≤ 100 caractères');
    }
    if (dto.defaultCurrency !== undefined) {
      const allowed = ['GNF', 'XOF', 'EUR', 'USD', 'MAD', 'NGN', 'KES'];
      if (!allowed.includes(dto.defaultCurrency)) {
        errors.push(`defaultCurrency doit être parmi : ${allowed.join(', ')}`);
      }
    }
    if (dto.defaultLanguage !== undefined) {
      if (!['fr', 'en', 'ar'].includes(dto.defaultLanguage)) {
        errors.push('defaultLanguage doit être fr, en ou ar');
      }
    }
    if (dto.platformCommission !== undefined) {
      if (dto.platformCommission < 0 || dto.platformCommission > 50) {
        errors.push('platformCommission doit être entre 0 et 50 %');
      }
    }

    this._throwIfErrors(errors, ConfigSection.GENERAL);
  }

  /* ----------------------------------------------------------
   * _throwIfErrors()
   *
   * Lève ConfigErreur.VALIDATION_ECHOUEE si des erreurs ont été collectées.
   * Regroupe toutes les erreurs dans un seul message pour faciliter le debug.
   * ---------------------------------------------------------- */
  private _throwIfErrors(errors: string[], section: ConfigSection): void {
    if (errors.length === 0) return;
    throw new ConfigErreur(
      ConfigErreurType.VALIDATION_ECHOUEE,
      `Validation échouée pour la section ${section} : ${errors.join(' | ')}`,
      { section, errors },
    );
  }
}
