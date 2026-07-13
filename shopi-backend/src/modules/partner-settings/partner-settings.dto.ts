/* ============================================================
 * FICHIER : src/modules/partner-settings/partner-settings.dto.ts
 * ============================================================ */

import {
  IsOptional, IsString, IsInt, IsNumber, IsBoolean,
  IsIn, IsArray, IsObject, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePartnerSettingsDto {

  /* ── Tiers ───────────────────────────────────────────────── */

  @IsOptional() @IsArray()
  tiers?: unknown[];

  /* ── Commissions ─────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  @IsIn(['tier', 'fixed', 'progressive'])
  commissionMode?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(50) @Type(() => Number)
  defaultCommissionRate?: number;

  /* ── Validation ──────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'manuel', 'hybride'])
  validationMode?: string;

  @IsOptional() @IsInt() @Min(1) @Max(720) @Type(() => Number)
  validationDelayH?: number;

  @IsOptional() @IsBoolean()
  autoRejectExpired?: boolean;

  @IsOptional() @IsArray()
  requiredDocuments?: unknown[];

  /* ── Bonus ───────────────────────────────────────────────── */

  @IsOptional() @IsBoolean()
  bonusProgramEnabled?: boolean;

  @IsOptional() @IsArray()
  bonusRules?: unknown[];

  /* ── Objectifs ───────────────────────────────────────────── */

  @IsOptional() @IsArray()
  objectives?: unknown[];

  /* ── Récompenses ─────────────────────────────────────────── */

  @IsOptional() @IsBoolean()
  rewardProgramEnabled?: boolean;

  @IsOptional() @IsArray()
  rewardRules?: unknown[];

  /* ── Paiement ────────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly'])
  paymentFrequency?: string;

  /* ── Tier management ─────────────────────────────────────── */

  @IsOptional() @IsBoolean()
  autoTierUpgrade?: boolean;

  @IsOptional() @IsBoolean()
  autoTierDowngrade?: boolean;

  /* ── Notifications ───────────────────────────────────────── */

  @IsOptional() @IsObject()
  notifEventsConfig?: Record<string, boolean>;
}
