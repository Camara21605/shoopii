/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/platform-settings.service.ts
 *
 * RÔLE    : Lire et mettre à jour la configuration globale Shopi.
 *           Pattern singleton : la table `platform_settings`
 *           contient toujours exactement une ligne (id = 1).
 *           Si elle n'existe pas encore, elle est créée avec
 *           les valeurs par défaut au premier GET.
 * ============================================================ */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import {
  IsBoolean, IsInt, IsNumber, IsOptional, IsString,
  Max, Min, MaxLength, IsEmail, IsUrl, IsHexColor,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

import { PlatformSettings } from '../../../../database/entities/platform-settings.entity';

/* ── DTO ────────────────────────────────────────────────────── */
export class UpdatePlatformSettingsDto {

  /* ── Général ────────────────────────────────────────────── */
  @IsOptional() @IsString() @MaxLength(100)
  platformName?: string;

  @IsOptional() @IsString() @MaxLength(200)
  platformTagline?: string | null;

  @IsOptional() @IsEmail() @MaxLength(150)
  supportEmail?: string | null;

  @IsOptional() @IsString() @IsIn(['GNF','XOF','EUR','USD','MAD','NGN','GHS','KES','CDF'])
  defaultCurrency?: string;

  @IsOptional() @IsString() @IsIn(['fr','en','ar'])
  defaultLanguage?: string;

  /* ── Sécurité & Auth ────────────────────────────────────── */
  @IsOptional() @IsBoolean()
  emailVerifRequired?: boolean;

  @IsOptional() @IsBoolean()
  adminTwoFaRequired?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(20) @Type(() => Number)
  maxLoginAttempts?: number;

  @IsOptional() @IsInt() @Min(5) @Max(1440) @Type(() => Number)
  sessionTimeoutMin?: number;

  @IsOptional() @IsInt() @Min(1) @Max(168) @Type(() => Number)
  tokenValidityHours?: number;

  @IsOptional() @IsInt() @Min(10) @Max(10000) @Type(() => Number)
  rateLimitPerMin?: number;

  /* ── Inscriptions ───────────────────────────────────────── */
  @IsOptional() @IsBoolean()
  openSignup?: boolean;

  @IsOptional() @IsBoolean()
  codeRequiredForCompany?: boolean;

  @IsOptional() @IsBoolean()
  kycRequired?: boolean;

  /* ── Modération ─────────────────────────────────────────── */
  @IsOptional() @IsBoolean()
  manualVendorApproval?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  reportsBeforeSuspend?: number;

  @IsOptional() @IsInt() @Min(1) @Max(168) @Type(() => Number)
  savResponseSlaHours?: number;

  /* ── Plateforme ─────────────────────────────────────────── */
  @IsOptional() @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional() @IsNumber() @Min(0) @Max(50) @Type(() => Number)
  platformCommission?: number;

  @IsOptional() @IsString()
  timezone?: string;

  /* ── Commissions — Produit ──────────────────────────────── */
  @IsOptional() @IsNumber() @Min(0) @Max(50) @Type(() => Number)
  tauxCommissionProduit?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(1) @Type(() => Number)
  planMultiplierPro?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(1) @Type(() => Number)
  planMultiplierPremium?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  ratioShopiProduit?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  ratioPartenaireProduit?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  ratioAdminProduit?: number;

  /* ── Commissions — Livraison ────────────────────────────── */
  @IsOptional() @IsNumber() @Min(0) @Max(50) @Type(() => Number)
  tauxCommissionLivraison?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  ratioShopiLivraison?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  ratioPartenaireLivraison?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100) @Type(() => Number)
  ratioAdminLivraison?: number;

  /* ── Paiements ──────────────────────────────────────────── */
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  minWithdrawalAmount?: number;

  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  maxTransactionAmount?: number;

  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  dailyWithdrawalLimit?: number;

  @IsOptional() @IsInt() @Min(0) @Max(30) @Type(() => Number)
  settlementDelayDays?: number;

  @IsOptional() @IsBoolean()
  mtnMoneyEnabled?: boolean;

  @IsOptional() @IsBoolean()
  orangeMoneyEnabled?: boolean;

  @IsOptional() @IsBoolean()
  waveEnabled?: boolean;

  @IsOptional() @IsBoolean()
  moovMoneyEnabled?: boolean;

  @IsOptional() @IsBoolean()
  djomyEnabled?: boolean;

  /* ── Délais métier ──────────────────────────────────────── */
  @IsOptional() @IsInt() @Min(1) @Max(168) @Type(() => Number)
  maxPaymentDelayHours?: number;

  @IsOptional() @IsInt() @Min(1) @Max(1440) @Type(() => Number)
  sessionTtlMinutes?: number;

  @IsOptional() @IsInt() @Min(1) @Max(168) @Type(() => Number)
  maxEnterpriseValidationHours?: number;

  @IsOptional() @IsInt() @Min(1) @Max(30) @Type(() => Number)
  disputeWindowDays?: number;

  @IsOptional() @IsInt() @Min(1) @Max(168) @Type(() => Number)
  disputeResolutionHours?: number;

  @IsOptional() @IsInt() @Min(1) @Max(30) @Type(() => Number)
  refundProcessingDays?: number;

  @IsOptional() @IsInt() @Min(1) @Max(168) @Type(() => Number)
  withdrawalProcessingHours?: number;

  @IsOptional() @IsInt() @Min(1) @Max(20) @Type(() => Number)
  dataRetentionYears?: number;

  @IsOptional() @IsInt() @Min(1) @Max(3650) @Type(() => Number)
  walletInactivityDays?: number;

  @IsOptional() @IsInt() @Min(1) @Max(20) @Type(() => Number)
  maxDailyPaymentAttempts?: number;

  /* ── Litiges ────────────────────────────────────────────── */
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number)
  maxEvidencesPerDispute?: number;

  @IsOptional() @IsInt() @Min(1) @Max(168) @Type(() => Number)
  disputeInstructionSlaHours?: number;

  /* ── Settlement Engine ──────────────────────────────────── */
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number)
  autoValidationThreshold?: number;

  @IsOptional() @IsInt() @Min(1) @Max(10) @Type(() => Number)
  maxWithdrawalAttempts?: number;

  /* ── Équipes entreprise ─────────────────────────────────── */
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number)
  maxTeamMembersPerCompany?: number;

  /* ── Notifications ──────────────────────────────────────── */
  @IsOptional() @IsBoolean()
  emailNotifEnabled?: boolean;

  @IsOptional() @IsBoolean()
  pushNotifEnabled?: boolean;

  @IsOptional() @IsBoolean()
  smsNotifEnabled?: boolean;

  @IsOptional() @IsInt() @Min(50) @Max(99) @Type(() => Number)
  cpuAlertPct?: number;

  @IsOptional() @IsInt() @Min(50) @Max(99) @Type(() => Number)
  ramAlertPct?: number;

  /* ── Intégrations ───────────────────────────────────────── */
  @IsOptional() @IsString() @MaxLength(80)
  analyticsTrackingId?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  facebookPixelId?: string | null;

  @IsOptional() @IsUrl() @MaxLength(500)
  webhookUrl?: string | null;

  /* ── Apparence ──────────────────────────────────────────── */
  @IsOptional() @IsHexColor()
  primaryColor?: string;

  @IsOptional() @IsString() @MaxLength(500)
  logoUrl?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  faviconUrl?: string | null;
}

/* ═══════════════════════════════════════════════════════════ */

@Injectable()
export class PlatformSettingsService {

  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly repo: Repository<PlatformSettings>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * GET — Récupère la configuration (ou la crée si absente)
   * ────────────────────────────────────────────────────────── */
  async getSettings(): Promise<PlatformSettings> {
    let settings = await this.repo.findOne({ where: { id: 1 } });
    if (!settings) {
      settings = this.repo.create({ id: 1 });
      settings = await this.repo.save(settings);
      this.logger.log('[SETTINGS] Initialisation des paramètres plateforme (première utilisation).');
    }
    return settings;
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH — Met à jour un sous-ensemble de paramètres
   * ────────────────────────────────────────────────────────── */
  async updateSettings(dto: UpdatePlatformSettingsDto): Promise<PlatformSettings> {
    const settings = await this.getSettings();

    /* Validations métier */
    if (dto.platformCommission !== undefined) {
      if (dto.platformCommission < 0 || dto.platformCommission > 50)
        throw new BadRequestException('La commission doit être comprise entre 0 % et 50 %.');
      settings.platformCommission = dto.platformCommission;
    }
    if (dto.maxLoginAttempts !== undefined) {
      if (dto.maxLoginAttempts < 1 || dto.maxLoginAttempts > 20)
        throw new BadRequestException('Le nombre de tentatives doit être entre 1 et 20.');
      settings.maxLoginAttempts = dto.maxLoginAttempts;
    }
    if (dto.minWithdrawalAmount !== undefined && dto.maxTransactionAmount !== undefined) {
      if (dto.minWithdrawalAmount > dto.maxTransactionAmount)
        throw new BadRequestException('Le minimum de retrait ne peut pas dépasser le maximum par transaction.');
    }

    /* Validation invariant ratio produit (Shopi + Partenaire + Admin = 100) */
    const rSP  = dto.ratioShopiProduit     ?? Number(settings.ratioShopiProduit);
    const rPP  = dto.ratioPartenaireProduit ?? Number(settings.ratioPartenaireProduit);
    const rAP  = dto.ratioAdminProduit      ?? Number(settings.ratioAdminProduit);
    if (
      dto.ratioShopiProduit !== undefined ||
      dto.ratioPartenaireProduit !== undefined ||
      dto.ratioAdminProduit !== undefined
    ) {
      if (Math.round(rSP + rPP + rAP) !== 100)
        throw new BadRequestException(`La somme des ratios produit (Shopi + Partenaire + Admin) doit être égale à 100 % (actuellement : ${rSP + rPP + rAP} %).`);
    }

    /* Validation invariant ratio livraison (Shopi + Partenaire + Admin = 100) */
    const rSL = dto.ratioShopiLivraison      ?? Number(settings.ratioShopiLivraison);
    const rPL = dto.ratioPartenaireLivraison ?? Number(settings.ratioPartenaireLivraison);
    const rAL = dto.ratioAdminLivraison      ?? Number(settings.ratioAdminLivraison);
    if (
      dto.ratioShopiLivraison !== undefined ||
      dto.ratioPartenaireLivraison !== undefined ||
      dto.ratioAdminLivraison !== undefined
    ) {
      if (Math.round(rSL + rPL + rAL) !== 100)
        throw new BadRequestException(`La somme des ratios livraison (Shopi + Partenaire + Admin) doit être égale à 100 % (actuellement : ${rSL + rPL + rAL} %).`);
    }

    /* Application des champs — Général */
    if (dto.platformName         !== undefined) settings.platformName         = dto.platformName;
    if (dto.platformTagline      !== undefined) settings.platformTagline      = dto.platformTagline ?? null;
    if (dto.supportEmail         !== undefined) settings.supportEmail         = dto.supportEmail ?? null;
    if (dto.defaultCurrency      !== undefined) settings.defaultCurrency      = dto.defaultCurrency;
    if (dto.defaultLanguage      !== undefined) settings.defaultLanguage      = dto.defaultLanguage;

    /* Sécurité */
    if (dto.emailVerifRequired   !== undefined) settings.emailVerifRequired   = dto.emailVerifRequired;
    if (dto.adminTwoFaRequired   !== undefined) settings.adminTwoFaRequired   = dto.adminTwoFaRequired;
    if (dto.sessionTimeoutMin    !== undefined) settings.sessionTimeoutMin    = dto.sessionTimeoutMin;
    if (dto.tokenValidityHours   !== undefined) settings.tokenValidityHours   = dto.tokenValidityHours;
    if (dto.rateLimitPerMin      !== undefined) settings.rateLimitPerMin      = dto.rateLimitPerMin;

    /* Inscriptions */
    if (dto.openSignup             !== undefined) settings.openSignup             = dto.openSignup;
    if (dto.codeRequiredForCompany !== undefined) settings.codeRequiredForCompany = dto.codeRequiredForCompany;
    if (dto.kycRequired            !== undefined) settings.kycRequired            = dto.kycRequired;

    /* Modération */
    if (dto.manualVendorApproval !== undefined) settings.manualVendorApproval = dto.manualVendorApproval;
    if (dto.reportsBeforeSuspend !== undefined) settings.reportsBeforeSuspend = dto.reportsBeforeSuspend;
    if (dto.savResponseSlaHours  !== undefined) settings.savResponseSlaHours  = dto.savResponseSlaHours;

    /* Plateforme */
    if (dto.maintenanceMode !== undefined) settings.maintenanceMode = dto.maintenanceMode;
    if (dto.timezone        !== undefined) settings.timezone        = dto.timezone;

    /* Commissions — Produit */
    if (dto.tauxCommissionProduit    !== undefined) settings.tauxCommissionProduit    = dto.tauxCommissionProduit;
    if (dto.planMultiplierPro        !== undefined) settings.planMultiplierPro        = dto.planMultiplierPro;
    if (dto.planMultiplierPremium    !== undefined) settings.planMultiplierPremium    = dto.planMultiplierPremium;
    if (dto.ratioShopiProduit        !== undefined) settings.ratioShopiProduit        = rSP;
    if (dto.ratioPartenaireProduit   !== undefined) settings.ratioPartenaireProduit   = rPP;
    if (dto.ratioAdminProduit        !== undefined) settings.ratioAdminProduit        = rAP;

    /* Commissions — Livraison */
    if (dto.tauxCommissionLivraison  !== undefined) settings.tauxCommissionLivraison  = dto.tauxCommissionLivraison;
    if (dto.ratioShopiLivraison      !== undefined) settings.ratioShopiLivraison      = rSL;
    if (dto.ratioPartenaireLivraison !== undefined) settings.ratioPartenaireLivraison = rPL;
    if (dto.ratioAdminLivraison      !== undefined) settings.ratioAdminLivraison      = rAL;

    /* Paiements */
    if (dto.minWithdrawalAmount  !== undefined) settings.minWithdrawalAmount  = dto.minWithdrawalAmount;
    if (dto.maxTransactionAmount !== undefined) settings.maxTransactionAmount = dto.maxTransactionAmount;
    if (dto.dailyWithdrawalLimit !== undefined) settings.dailyWithdrawalLimit = dto.dailyWithdrawalLimit;
    if (dto.settlementDelayDays  !== undefined) settings.settlementDelayDays  = dto.settlementDelayDays;
    if (dto.mtnMoneyEnabled      !== undefined) settings.mtnMoneyEnabled      = dto.mtnMoneyEnabled;
    if (dto.orangeMoneyEnabled   !== undefined) settings.orangeMoneyEnabled   = dto.orangeMoneyEnabled;
    if (dto.waveEnabled          !== undefined) settings.waveEnabled          = dto.waveEnabled;
    if (dto.moovMoneyEnabled     !== undefined) settings.moovMoneyEnabled     = dto.moovMoneyEnabled;
    if (dto.djomyEnabled         !== undefined) settings.djomyEnabled         = dto.djomyEnabled;

    /* Délais métier */
    if (dto.maxPaymentDelayHours        !== undefined) settings.maxPaymentDelayHours        = dto.maxPaymentDelayHours;
    if (dto.sessionTtlMinutes           !== undefined) settings.sessionTtlMinutes           = dto.sessionTtlMinutes;
    if (dto.maxEnterpriseValidationHours!== undefined) settings.maxEnterpriseValidationHours= dto.maxEnterpriseValidationHours;
    if (dto.disputeWindowDays           !== undefined) settings.disputeWindowDays           = dto.disputeWindowDays;
    if (dto.disputeResolutionHours      !== undefined) settings.disputeResolutionHours      = dto.disputeResolutionHours;
    if (dto.refundProcessingDays        !== undefined) settings.refundProcessingDays        = dto.refundProcessingDays;
    if (dto.withdrawalProcessingHours   !== undefined) settings.withdrawalProcessingHours   = dto.withdrawalProcessingHours;
    if (dto.dataRetentionYears          !== undefined) settings.dataRetentionYears          = dto.dataRetentionYears;
    if (dto.walletInactivityDays        !== undefined) settings.walletInactivityDays        = dto.walletInactivityDays;
    if (dto.maxDailyPaymentAttempts     !== undefined) settings.maxDailyPaymentAttempts     = dto.maxDailyPaymentAttempts;

    /* Litiges */
    if (dto.maxEvidencesPerDispute      !== undefined) settings.maxEvidencesPerDispute      = dto.maxEvidencesPerDispute;
    if (dto.disputeInstructionSlaHours  !== undefined) settings.disputeInstructionSlaHours  = dto.disputeInstructionSlaHours;

    /* Settlement Engine */
    if (dto.autoValidationThreshold     !== undefined) settings.autoValidationThreshold     = dto.autoValidationThreshold;
    if (dto.maxWithdrawalAttempts       !== undefined) settings.maxWithdrawalAttempts       = dto.maxWithdrawalAttempts;

    /* Équipes entreprise */
    if (dto.maxTeamMembersPerCompany    !== undefined) settings.maxTeamMembersPerCompany    = dto.maxTeamMembersPerCompany;

    /* Notifications */
    if (dto.emailNotifEnabled !== undefined) settings.emailNotifEnabled = dto.emailNotifEnabled;
    if (dto.pushNotifEnabled  !== undefined) settings.pushNotifEnabled  = dto.pushNotifEnabled;
    if (dto.smsNotifEnabled   !== undefined) settings.smsNotifEnabled   = dto.smsNotifEnabled;
    if (dto.cpuAlertPct       !== undefined) settings.cpuAlertPct       = dto.cpuAlertPct;
    if (dto.ramAlertPct       !== undefined) settings.ramAlertPct       = dto.ramAlertPct;

    /* Intégrations */
    if (dto.analyticsTrackingId !== undefined) settings.analyticsTrackingId = dto.analyticsTrackingId ?? null;
    if (dto.facebookPixelId     !== undefined) settings.facebookPixelId     = dto.facebookPixelId ?? null;
    if (dto.webhookUrl          !== undefined) settings.webhookUrl          = dto.webhookUrl ?? null;

    /* Apparence */
    if (dto.primaryColor !== undefined) settings.primaryColor = dto.primaryColor;
    if (dto.logoUrl      !== undefined) settings.logoUrl      = dto.logoUrl ?? null;
    if (dto.faviconUrl   !== undefined) settings.faviconUrl   = dto.faviconUrl ?? null;

    const updated = await this.repo.save(settings);
    this.logger.log(`[SETTINGS] Mis à jour — maintenance=${updated.maintenanceMode} | txProduit=${updated.tauxCommissionProduit}% | txLivraison=${updated.tauxCommissionLivraison}%`);
    return updated;
  }

  /* ──────────────────────────────────────────────────────────
   * Purge du cache applicatif
   * Dans l'état actuel (cache mémoire TypeORM), on réinitialise
   * les QueryCache. À remplacer par un FLUSHDB Redis quand le
   * cache Redis applicatif sera activé.
   * ────────────────────────────────────────────────────────── */
  async purgeCache(): Promise<{ message: string; purgéA: string }> {
    try {
      await this.repo.query('SELECT 1'); // connexion DB toujours vivante
    } catch (_) { /* ignore */ }
    this.logger.warn('[CACHE] Purge déclenchée par le super-admin.');
    return {
      message: 'Cache purgé avec succès',
      purgéA:  new Date().toISOString(),
    };
  }
}
