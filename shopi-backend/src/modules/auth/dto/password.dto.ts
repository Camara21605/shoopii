/* ============================================================
 * FICHIER : src/modules/auth/dto/password.dto.ts
 * RÔLE    : DTOs liés à la gestion du mot de passe.
 *
 *  ├── ForgotPasswordDto  → POST /auth/forgot-password
 *  └── ResetPasswordDto   → POST /auth/reset-password
 *
 * AuthService.forgotPassword() utilise ForgotPasswordDto.
 * ResetPasswordDto est préparé pour l'implémentation future
 * de la vérification et consommation du reset token
 * (voir le TODO dans AuthService.forgotPassword()).
 * ============================================================ */

import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// ─────────────────────────────────────────────────────────────────────────────
// 1. FORGOT PASSWORD
//    POST /auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────

export class ForgotPasswordDto {

  /**
   * Identifiant de l'utilisateur : email ou numéro de téléphone.
   * La logique de distinction se fait dans AuthService.findByIdentifier()
   * en vérifiant la présence du caractère '@'.
   */
  @IsString()
  @IsNotEmpty({ message: "L'identifiant (email ou téléphone) est obligatoire." })
  @MaxLength(255, { message: "L'identifiant ne peut pas dépasser 255 caractères." })
  @Transform(({ value }) => (value as string).trim().toLowerCase())
  identifier: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RESET PASSWORD
//    POST /auth/reset-password
//    (prévu pour la suite – voir TODO dans AuthService.forgotPassword())
// ─────────────────────────────────────────────────────────────────────────────

export class ResetPasswordDto {

  /**
   * Token de réinitialisation reçu par email.
   * Correspond au "resetToken" généré dans forgotPassword()
   * (deux UUID v4 concaténés sans tirets = 64 caractères hex).
   */
  @IsString()
  @IsNotEmpty({ message: 'Le token de réinitialisation est obligatoire.' })
  @MinLength(32, { message: 'Token invalide.' })
  @MaxLength(128, { message: 'Token invalide.' })
  token: string;

  /**
   * Nouveau mot de passe respectant la même politique que RegisterDto :
   *  - 8 caractères minimum
   *  - Au moins une majuscule, une minuscule, un chiffre et un caractère spécial
   */
  @IsString()
  @IsNotEmpty({ message: 'Le nouveau mot de passe est obligatoire.' })
  @MinLength(8,   { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères.' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    {
      message:
        'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.',
    },
  )
  newPassword: string;
}