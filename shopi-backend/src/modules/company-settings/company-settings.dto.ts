/* ============================================================
 * FICHIER : src/modules/company-settings/company-settings.dto.ts
 * ============================================================ */

import {
  IsOptional, IsString, IsInt, IsNumber, IsBoolean,
  IsIn, IsArray, IsObject, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCompanySettingsDto {

  /* ── Commission ─────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  @IsIn(['percentage', 'fixed', 'progressive'])
  commissionType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  commissionValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionMax?: number;

  @IsOptional()
  @IsArray()
  commissionBrackets?: unknown[];

  /* ── Validation ─────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'manuel', 'hybride'])
  validationMode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  @Type(() => Number)
  validationDelayH?: number;

  /* ── Documents ──────────────────────────────────────────── */

  @IsOptional()
  @IsArray()
  requiredDocuments?: unknown[];

  /* ── Catégories ─────────────────────────────────────────── */

  @IsOptional()
  @IsArray()
  categoryRules?: unknown[];

  /* ── Limites ────────────────────────────────────────────── */

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  @Type(() => Number)
  monthlyOrderLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  dailyOrderLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  @Type(() => Number)
  maxProducts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  maxActivePromotions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  maxBranches?: number;

  /* ── Permissions ────────────────────────────────────────── */

  @IsOptional() @IsBoolean() allowPhysical?: boolean;
  @IsOptional() @IsBoolean() allowDigital?: boolean;
  @IsOptional() @IsBoolean() allowServices?: boolean;
  @IsOptional() @IsBoolean() allowInternational?: boolean;

  /* ── Suspension ─────────────────────────────────────────── */

  @IsOptional() @IsBoolean()
  autoSuspensionEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  suspensionSignalThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  suspensionLitigeThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  @Type(() => Number)
  inactivityDays?: number;

  /* ── Notifications ──────────────────────────────────────────── */

  @IsOptional()
  @IsObject()
  notifEventsConfig?: Record<string, boolean>;
}
