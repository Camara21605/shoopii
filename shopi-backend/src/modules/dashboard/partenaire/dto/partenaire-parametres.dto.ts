/* ============================================================
 * FICHIER : dto/partenaire-parametres.dto.ts
 *
 * DTOs de validation pour tous les endpoints du dashboard
 * partenaire — paramètres (profil, localisation, sécurité,
 * notifications, confidentialité, préférences, zone danger).
 *
 * Pattern : class-validator + ApiProperty (Swagger).
 * ============================================================ */

import {
  IsBoolean, IsIn, IsLatitude, IsLongitude, IsNotEmpty,
  IsNumber, IsOptional, IsString, MaxLength, Min, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/* ──────────────────────────────────────────────────────────────
 * 1. PROFIL — PATCH /dashboard/partenaire/parametres/profil
 * Modifie les champs de profil (User.firstName/lastName/email +
 * Partner.name/phone/bio).
 * ────────────────────────────────────────────────────────────── */
export class UpdatePartenaireProfilDto {
  @ApiPropertyOptional({ example: 'Mohamed' })
  @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Soumah' })
  @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  /** Nom commercial / enseigne du partenaire */
  @ApiPropertyOptional({ example: 'Partenaire Kaloum Express' })
  @IsOptional() @IsString() @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: '+224 622 00 00 01' })
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  /** Bio / Présentation publique */
  @ApiPropertyOptional({ example: 'Partenaire Shopi à Conakry, spécialisé recrutement.' })
  @IsOptional() @IsString()
  bio?: string;
}

/* ──────────────────────────────────────────────────────────────
 * 2. LOCALISATION — PATCH /dashboard/partenaire/parametres/zone
 * Met à jour la localisation et la zone d'activité.
 * ────────────────────────────────────────────────────────────── */
export class UpdatePartenaireZoneDto {
  @ApiPropertyOptional({ example: 'Kaloum / Réseau Conakry' })
  @IsOptional() @IsString() @MaxLength(255)
  zone?: string;

  @ApiPropertyOptional({ example: 'Avenue de la République, bâtiment B' })
  @IsOptional() @IsString() @MaxLength(500)
  adresse?: string;

  @ApiPropertyOptional({ example: 'Kaloum' })
  @IsOptional() @IsString() @MaxLength(100)
  commune?: string;

  @ApiPropertyOptional({ example: 'Conakry' })
  @IsOptional() @IsString() @MaxLength(100)
  ville?: string;

  @ApiPropertyOptional({ example: 'Conakry' })
  @IsOptional() @IsString() @MaxLength(100)
  region?: string;

  @ApiPropertyOptional({ example: 'GN', description: 'Code ISO du pays (ex: GN, SN, CI)' })
  @IsOptional() @IsString() @MaxLength(10)
  pays?: string;

  @ApiPropertyOptional({ example: '001' })
  @IsOptional() @IsString() @MaxLength(20)
  codePostal?: string;

  @ApiPropertyOptional({ example: 9.5370 })
  @IsOptional() @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -13.6785 })
  @IsOptional() @IsLongitude()
  longitude?: number;
}

/* ──────────────────────────────────────────────────────────────
 * 3. SÉCURITÉ — PATCH /parametres/securite/password
 * Changement de mot de passe avec confirmation.
 * ────────────────────────────────────────────────────────────── */
export class UpdatePartenairePasswordDto {
  @ApiProperty({ example: 'AncienMotDePasse1!' })
  @IsString() @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'NouveauMotDePasse1!', minLength: 8 })
  @IsString() @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  newPassword!: string;

  @ApiProperty({ example: 'NouveauMotDePasse1!' })
  @IsString() @IsNotEmpty()
  confirmPassword!: string;
}

/* ──────────────────────────────────────────────────────────────
 * 4. 2FA — PATCH /parametres/securite/2fa
 * ────────────────────────────────────────────────────────────── */
export class UpdatePartenaireTwoFaDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  twoFaEnabled!: boolean;

  @ApiPropertyOptional({ example: 'sms', enum: ['sms', 'app', 'email'] })
  @IsOptional() @IsString() @IsIn(['sms', 'app', 'email'])
  twoFaMethod?: string;
}

/* ──────────────────────────────────────────────────────────────
 * 5. NOTIFICATIONS — PATCH /parametres/notifications
 * Préférences de notifications et canaux.
 * ────────────────────────────────────────────────────────────── */
export class UpdatePartenaireNotifsDto {
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() notifActeurActive?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() notifCommission?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() notifSignalement?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() notifPalier?: boolean;
  @ApiPropertyOptional({ default: false })@IsOptional() @IsBoolean() notifNews?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() canalEmail?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() canalSms?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() canalWhatsapp?: boolean;
  @ApiPropertyOptional({ default: false })@IsOptional() @IsBoolean() canalPush?: boolean;
}

/* ──────────────────────────────────────────────────────────────
 * 6. CONFIDENTIALITÉ — PATCH /parametres/confidentialite
 * ────────────────────────────────────────────────────────────── */
export class UpdatePartenairePrivacyDto {
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() profilPublic?: boolean;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() afficherTelephone?: boolean;
  @ApiPropertyOptional({ default: false })@IsOptional() @IsBoolean() apparaitreClassement?: boolean;
}

/* ──────────────────────────────────────────────────────────────
 * 7. PRÉFÉRENCES — PATCH /parametres/preferences
 * ────────────────────────────────────────────────────────────── */
export class UpdatePartenairePreferencesDto {
  @ApiPropertyOptional({ example: 'fr', enum: ['fr', 'pular', 'malinke', 'soussou'] })
  @IsOptional() @IsString() @IsIn(['fr', 'pular', 'malinke', 'soussou'])
  langue?: string;

  @ApiPropertyOptional({ example: 'light', enum: ['light', 'dark'] })
  @IsOptional() @IsString() @IsIn(['light', 'dark'])
  apparence?: string;
}

/* ──────────────────────────────────────────────────────────────
 * 8. ZONE DANGER — Toutes les actions de la zone danger
 * Le mot de passe est obligatoire pour confirmer les actions
 * irréversibles (pause, désactivation, suppression).
 * ────────────────────────────────────────────────────────────── */
export class PartenaireDangerConfirmDto {
  @ApiProperty({ example: 'MonMotDePasse1!', description: 'Mot de passe de confirmation' })
  @IsString() @IsNotEmpty({ message: 'Le mot de passe de confirmation est obligatoire.' })
  password!: string;
}
