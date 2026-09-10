/* ============================================================
 * DTO : update-communication.dto.ts
 * Corps de la requête PUT /dashboard/admin/communication
 * ============================================================ */

import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AdminNotifTemplates } from '../../../../database/entities/admin-communication-settings.entity';

export class UpdateCommunicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  invitationMessage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  signature?: string | null;

  /** Clés attendues : approved, rejected, suspended, warned, reactivated. */
  @IsOptional()
  @IsObject()
  notifTemplates?: AdminNotifTemplates | null;
}
