/* ============================================================
 * FICHIER : dashboard/super-admin/dto/my-securite.dto.ts
 *
 * RÔLE : validation des routes de sécurité du compte administrateur
 * connecté (Paramètres → Sécurité) :
 *   PATCH /dashboard/super-admin/my-securite/password
 *   PATCH /dashboard/super-admin/my-securite/2fa   (désactivation)
 * Ces routes recevaient jusqu'ici un simple type TypeScript en ligne :
 * aucune validation à l'exécution (types, longueurs).
 * ============================================================ */

import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangeMyPasswordDto {
  @IsString() @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire.' }) @MaxLength(128)
  currentPassword: string;

  /* 72 = limite réelle de bcrypt (au-delà, le hash ignore silencieusement la fin). */
  @IsString()
  @MinLength(8,  { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(72, { message: 'Le mot de passe ne peut pas dépasser 72 caractères.' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir une majuscule, une minuscule et un chiffre.',
  })
  newPassword: string;

  @IsString() @IsNotEmpty({ message: 'Confirmez le nouveau mot de passe.' }) @MaxLength(72)
  confirmPassword: string;
}

export class UpdateMyTwoFaDto {
  @IsBoolean()
  twoFaEnabled: boolean;

  @IsOptional() @IsString() @MaxLength(20)
  twoFaMethod?: string;

  @IsOptional() @IsString() @MaxLength(128)
  currentPassword?: string;

  @IsOptional() @IsString() @MaxLength(20)
  code?: string;
}
