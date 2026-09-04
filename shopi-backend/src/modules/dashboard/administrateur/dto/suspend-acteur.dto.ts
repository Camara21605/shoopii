/* ============================================================
 * DTO : suspend-acteur.dto.ts
 * Corps de la requête PATCH /dashboard/admin/acteurs/:id/suspend
 * ============================================================ */

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendActeurDto {
  /** Raison de la suspension — consignée dans le journal d'audit et
   * transmise à l'acteur suspendu, si elle est renseignée. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motif?: string;
}
