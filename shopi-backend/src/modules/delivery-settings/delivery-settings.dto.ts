/* ============================================================
 * FICHIER : src/modules/delivery-settings/delivery-settings.dto.ts
 * ============================================================ */

import {
  IsOptional, IsString, IsInt, IsNumber, IsBoolean,
  IsIn, IsArray, IsObject, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDeliverySettingsDto {

  /* ── Assignation ─────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  @IsIn(['nearest', 'best_score', 'best_availability', 'best_rating'])
  assignmentStrategy?: string;

  @IsOptional() @IsBoolean()
  autoAssignEnabled?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(30) @Type(() => Number)
  acceptDeadlineMin?: number;

  @IsOptional() @IsInt() @Min(1) @Max(20) @Type(() => Number)
  maxSimultaneousOrders?: number;

  @IsOptional() @IsInt() @Min(1) @Max(60) @Type(() => Number)
  reassignTimeoutMin?: number;

  /* ── Zones ───────────────────────────────────────────────── */

  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number)
  maxRadiusKm?: number;

  @IsOptional() @IsInt() @Min(1) @Max(500) @Type(() => Number)
  maxDeliveryDistanceKm?: number;

  /* ── Score ───────────────────────────────────────────────── */

  @IsOptional() @IsInt() @Min(0) @Max(100) @Type(() => Number)
  minScore?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100) @Type(() => Number)
  suspensionScoreThreshold?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100) @Type(() => Number)
  reactivationScoreThreshold?: number;

  @IsOptional() @IsObject()
  scoreWeights?: Record<string, number>;

  /* ── Bonus ───────────────────────────────────────────────── */

  @IsOptional() @IsBoolean()
  bonusProgramEnabled?: boolean;

  @IsOptional() @IsArray()
  bonusRules?: unknown[];

  /* ── Pénalités ───────────────────────────────────────────── */

  @IsOptional() @IsBoolean()
  autoPenaltyEnabled?: boolean;

  @IsOptional() @IsArray()
  penaltyRules?: unknown[];

  /* ── Véhicules ───────────────────────────────────────────── */

  @IsOptional() @IsArray()
  vehicleRules?: unknown[];

  /* ── Paiement ────────────────────────────────────────────── */

  @IsOptional()
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly'])
  paymentFrequency?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(50) @Type(() => Number)
  platformCommissionRate?: number;

  /* ── Notifications ───────────────────────────────────────── */

  @IsOptional() @IsObject()
  notifEventsConfig?: Record<string, boolean>;
}
