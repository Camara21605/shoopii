/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-securite.dto.ts
 * Section 9 — Sécurité (2FA + changement mot de passe)
 * ============================================================ */

import {
  IsOptional, IsBoolean, IsString,
  IsIn, MinLength, MaxLength,
} from 'class-validator';

/* ── Activation / changement de méthode 2FA ── */
export class UpdateTwoFaDto {

  @IsBoolean()
  twoFaEnabled!: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['app', 'sms', 'email'])
  twoFaMethod?: string;
}

/* ── Changement de mot de passe ── */
export class UpdatePasswordDto {

  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
