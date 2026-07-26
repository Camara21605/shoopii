/* ============================================================
 * FICHIER      : src/modules/company-team/dto/update-permission.dto.ts
 * MODULE       : Company Team
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { IsObject } from 'class-validator';
import { TeamPermissions } from '../../../database/entities/company-team/company-team-permission.entity';

export class UpdatePermissionDto {
  /**
   * Objet de permissions partiel ou complet.
   * Les groupes non mentionnés sont conservés tels quels.
   */
  @IsObject()
  permissions!: Partial<TeamPermissions>;
}
