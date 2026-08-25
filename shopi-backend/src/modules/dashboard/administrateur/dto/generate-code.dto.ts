/* ============================================================
 * DTO : generate-code.dto.ts
 * Corps de la requête POST /dashboard/admin/codes
 * ============================================================ */

import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { UserRole } from '../../../../common/enums/user-role.enum';

/** Paramètres de génération d'un code de création d'acteur. */
export class GenerateCodeDto {
  /** Rôle cible du futur acteur qui utilisera ce code. */
  @IsEnum(UserRole)
  targetRole: UserRole;

  /** Email de destination — obligatoire : seul canal d'envoi opérationnel
   * actuellement (SMS/WhatsApp pas encore branchés), un code sans email
   * ne pourrait jamais être transmis au destinataire. */
  @IsEmail()
  targetEmail: string;

  /** Nom du destinataire (optionnel — utilisé pour personnaliser l'email). */
  @IsOptional()
  @IsString()
  targetName?: string | null;

  /** Durée de validité en jours (défaut : 30). */
  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;
}
