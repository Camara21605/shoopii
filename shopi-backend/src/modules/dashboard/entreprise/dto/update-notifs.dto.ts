/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-notifs.dto.ts
 * Section 10 — Notifications (14 toggles)
 * ============================================================ */

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotifsDto {

  @IsOptional() @IsBoolean() newOrder?: boolean;
  @IsOptional() @IsBoolean() orderCancelled?: boolean;
  @IsOptional() @IsBoolean() orderDelivered?: boolean;
  @IsOptional() @IsBoolean() paymentReceived?: boolean;
  @IsOptional() @IsBoolean() outOfStock?: boolean;
  @IsOptional() @IsBoolean() nearThreshold?: boolean;
  @IsOptional() @IsBoolean() productPublished?: boolean;
  @IsOptional() @IsBoolean() catalogRequest?: boolean;
  @IsOptional() @IsBoolean() newReview?: boolean;
  @IsOptional() @IsBoolean() negativeReview?: boolean;
  @IsOptional() @IsBoolean() weeklyReport?: boolean;
  @IsOptional() @IsBoolean() promoInvitations?: boolean;
  @IsOptional() @IsBoolean() monthlyReport?: boolean;
  @IsOptional() @IsBoolean() shopNews?: boolean;
}
