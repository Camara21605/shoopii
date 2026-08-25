/* ============================================================
 * FICHIER : src/modules/auth/dto/login.dto.ts
 * RÔLE    : DTO de validation pour la connexion d'un utilisateur.
 *           Utilisé par AuthService.login() → POST /auth/login
 *
 * Le champ "identifier" accepte indifféremment :
 *   - une adresse email  (détecté par la présence de '@')
 *   - un numéro de téléphone au format international
 * ============================================================ */

import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {

  // ── Identifiant (email ou téléphone) ─────────────────────────────────────
  @IsString()
  @IsNotEmpty({ message: "L'identifiant (email ou téléphone) est obligatoire." })
  @MaxLength(255, { message: "L'identifiant ne peut pas dépasser 255 caractères." })
  @Transform(({ value }) => (value as string).trim().toLowerCase())
  identifier: string;

  // ── Mot de passe ──────────────────────────────────────────────────────────
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères.' })
  password: string;

  // ── Se souvenir de moi ────────────────────────────────────────────────────
  /**
   * Si true  → JWT valable 30 jours  (JWT_TTL_LONG)
   * Si false → JWT valable 24 heures (JWT_TTL_SHORT)
   */
  @IsOptional()
  @IsBoolean({ message: '"rememberMe" doit être un booléen.' })
  rememberMe?: boolean;

  /** Identifiant d'appareil généré et persisté côté client (crypto.randomUUID()).
   *  Sert à la gestion de session unique — voir SessionService. Jamais
   *  utilisé comme preuve d'identité, uniquement comme métadonnée. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}

/**
 * POST /auth/login/choose-account — 2e appel quand /auth/login a répondu
 * requiresAccountChoice (identifiant + mot de passe partagés par un compte
 * pro et son compte client lié). Le mot de passe est REVÉRIFIÉ côté serveur
 * contre le userId choisi — on ne fait jamais confiance au choix client seul.
 */
export class ChooseAccountDto {
  @IsString()
  @IsNotEmpty({ message: "L'identifiant est obligatoire." })
  @Transform(({ value }) => (value as string).trim().toLowerCase())
  identifier: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Le compte choisi est obligatoire.' })
  @IsUUID(4, { message: 'Identifiant de compte invalide.' })
  userId: string;

  @IsOptional()
  @IsBoolean({ message: '"rememberMe" doit être un booléen.' })
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceId?: string;
}