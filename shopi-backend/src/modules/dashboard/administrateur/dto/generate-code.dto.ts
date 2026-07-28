/* ============================================================
 * DTO : generate-code.dto.ts
 * Corps de la requête POST /dashboard/admin/codes
 * ============================================================ */

import { UserRole } from '../../../../common/enums/user-role.enum';

/** Paramètres de génération d'un code de création d'acteur. */
export class GenerateCodeDto {
  /** Rôle cible du futur acteur qui utilisera ce code. */
  targetRole: UserRole;

  /** Email de destination (optionnel — envoi par mail si fourni). */
  targetEmail?: string | null;

  /** Durée de validité en jours (défaut : 30). */
  validityDays?: number;
}
