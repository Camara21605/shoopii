/* ============================================================
 * FICHIER : src/modules/auth/dto/password.dto.ts
 *
 *  ├── ForgotPasswordDto   → POST /auth/forgot-password
 *  ├── VerifyOtpDto        → POST /auth/verify-otp
 *  └── ResetPasswordDto    → POST /auth/reset-password
 * ============================================================ */

import {
  IsJWT,
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// ─────────────────────────────────────────────────────────────────────────────
// 1. FORGOT PASSWORD — POST /auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────

export class ForgotPasswordDto {

  @ApiProperty({ example: 'user@shopi.gn', description: 'Email ou numéro de téléphone' })
  @IsString()
  @IsNotEmpty({ message: "L'identifiant (email ou téléphone) est obligatoire." })
  @MaxLength(255, { message: "L'identifiant ne peut pas dépasser 255 caractères." })
  @Transform(({ value }) => (value as string).trim().toLowerCase())
  identifier: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERIFY OTP — POST /auth/verify-otp
//    Étape 2 du flux "mot de passe oublié"
// ─────────────────────────────────────────────────────────────────────────────

export class VerifyOtpDto {

  @ApiProperty({ example: 'user@shopi.gn', description: 'Email ou téléphone envoyé à l\'étape 1' })
  @IsString()
  @IsNotEmpty({ message: "L'identifiant est obligatoire." })
  @MaxLength(255)
  @Transform(({ value }) => (value as string).trim().toLowerCase())
  identifier: string;

  @ApiProperty({ example: '482931', description: 'Code OTP à 6 chiffres reçu par email' })
  @IsString()
  @IsNotEmpty({ message: 'Le code OTP est obligatoire.' })
  @Length(6, 6, { message: 'Le code OTP doit contenir exactement 6 chiffres.' })
  @Matches(/^\d{6}$/, { message: 'Le code OTP doit être composé uniquement de chiffres.' })
  @Transform(({ value }) => (value as string).trim())
  code: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RESET PASSWORD — POST /auth/reset-password
//    Étape 3 du flux "mot de passe oublié"
//    Utilise le resetToken JWT retourné par /auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 4. GOOGLE OAUTH EXCHANGE — POST /auth/google/exchange
//    Échange le code one-time (UUID v4, 60s TTL) contre un AuthResponse
// ─────────────────────────────────────────────────────────────────────────────

export class ExchangeOAuthCodeDto {

  @ApiProperty({ description: 'Code UUID v4 one-time reçu en query-param après le callback Google' })
  @IsString()
  @IsNotEmpty({ message: 'Le code OAuth est obligatoire.' })
  @IsUUID(4, { message: 'Code OAuth invalide.' })
  code: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RESET PASSWORD — POST /auth/reset-password
//    Étape 3 du flux "mot de passe oublié"
//    Utilise le resetToken JWT retourné par /auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────

export class ResetPasswordDto {

  @ApiProperty({ description: 'Token JWT retourné par POST /auth/verify-otp (valable 15 min)' })
  @IsString()
  @IsNotEmpty({ message: 'Le token de réinitialisation est obligatoire.' })
  @IsJWT({ message: 'Token de réinitialisation invalide.' })
  resetToken: string;

  @ApiProperty({ example: 'NouveauMdp2025!', description: 'Nouveau mot de passe (min 8 car.)' })
  @IsString()
  @IsNotEmpty({ message: 'Le nouveau mot de passe est obligatoire.' })
  @MinLength(8,   { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères.' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    { message: 'Le mot de passe doit contenir au moins : 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.' },
  )
  newPassword: string;
}
