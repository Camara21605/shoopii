/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-notifs.dto.ts
 * Section 10 — Notifications de l'entreprise (préférences RÉELLES,
 * voir NotifsParametresService).
 *   global : interrupteurs push / e-mail
 *   items  : { cléFamille: boolean } — clés validées côté service (NOTIF_ITEMS)
 * ============================================================ */

import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NotifsGlobalDto {
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
}

export class UpdateNotifsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotifsGlobalDto)
  global?: NotifsGlobalDto;

  @IsOptional()
  @IsObject()
  items?: Record<string, boolean>;
}
