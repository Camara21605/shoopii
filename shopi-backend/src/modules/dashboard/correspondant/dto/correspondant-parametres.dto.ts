/* ============================================================
 * FICHIER : src/modules/dashboard/correspondant/dto/correspondant-parametres.dto.ts
 *
 * Tous les champs sont optionnels (PATCH partiel).
 *
 * §1 UpdateProfilDto :
 *   - firstName, lastName, email, phone → envoyés par le frontend,
 *     traités par le SERVICE qui les écrit dans USER.
 *     Ces champs ne sont PAS dans l'entité Correspondent.
 *   - bio, langues, typeCorrespondant   → écrits dans Correspondent.
 * ============================================================ */

import {
  IsOptional, IsString, MaxLength, IsEnum,
  IsBoolean, IsInt, IsArray, IsObject,
  Min, Max, IsPositive, ValidateIf,
  Matches, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  CorrespondantType,
  VirementFrequence,
  TwoFaMethod,
} from '../../../../database/entities/profiles/correspondant-profile.entity';

const notEmpty = (o: any, k: string) =>
  o[k] !== null && o[k] !== undefined && o[k] !== '';

// ─────────────────────────────────────────────────────────────
// §1 — PROFIL & IDENTITÉ
// ─────────────────────────────────────────────────────────────

export class UpdateProfilDto {

  /**
   * Prénom → stocké dans User.firstName
   * Le service recalcule Correspondent.fullName après la mise à jour.
   */
  @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  /**
   * Nom → stocké dans User.lastName
   */
  @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  /**
   * Email → stocké dans User.email (unique)
   * Validé uniquement si non vide (évite les 400 avec email:"")
   */
  @IsOptional()
  @ValidateIf(o => notEmpty(o, 'email'))
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Format email invalide' })
  @MaxLength(255)
  email?: string;

  /**
   * Téléphone principal → stocké dans User.phone (unique)
   * Numéro Orange Money personnel du correspondant.
   * ≠ depotPhone (numéro public du relais)
   */
  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  /**
   * Biographie → stockée dans Correspondent.bio
   * Propre au rôle, pas dans User.
   */
  @IsOptional() @IsString() @MaxLength(500)
  bio?: string;

  /**
   * Langues parlées → stockées dans Correspondent.langues
   */
  @IsOptional() @IsString() @MaxLength(255)
  langues?: string;

  /**
   * Portée géographique → Correspondent.typeCorrespondant
   */
  @IsOptional() @IsEnum(CorrespondantType)
  typeCorrespondant?: CorrespondantType;
}

// ─────────────────────────────────────────────────────────────
// §2 — POINT DE DÉPÔT
// ─────────────────────────────────────────────────────────────

export class UpdateDepotDto {

  @IsOptional() @IsString() @MaxLength(255)
  depotNom?: string;

  @IsOptional() @IsString()
  depotAdresse?: string;

  @IsOptional() @IsString() @MaxLength(100)
  depotCommune?: string;

  @IsOptional() @IsString() @MaxLength(100)
  depotVille?: string;

  @IsOptional() @IsString()
  depotRepere?: string;

  /**
   * Numéro public du relais affiché aux clients.
   * Différent de User.phone (numéro personnel / Orange Money).
   */
  @IsOptional() @IsString() @MaxLength(20)
  depotPhone?: string;

  @IsOptional() @IsString() @MaxLength(50)
  depotCapacite?: string;

  @IsOptional() @IsString() @MaxLength(100)
  depotTypeLocal?: string;

  @IsOptional() @IsString() @MaxLength(100)
  depotAcces?: string;

  /** ex : { "pmr": false, "parking": true, "videosurveillance": true } */
  @IsOptional() @IsObject()
  depotAccessOptions?: Record<string, boolean>;
}

// ─────────────────────────────────────────────────────────────
// §3 — ZONE & HORAIRES
// ─────────────────────────────────────────────────────────────

export class UpdateZoneDto {

  /** ex : ["kaloum", "dixinn", "matam"] */
  @IsOptional() @IsArray() @IsString({ each: true })
  zonesActives?: string[];

  /** ex : { "refusAutoCap": true, "alerteRetard48h": true } */
  @IsOptional() @IsObject()
  zoneAutoRules?: Record<string, boolean>;
}

export class UpdateHoraireItemDto {

  @IsString()
  jour: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:MM requis' })
  ouverture: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:MM requis' })
  fermeture: string;

  @IsBoolean()
  actif: boolean;
}

export class UpdateHorairesDto {

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateHoraireItemDto)
  horaires: UpdateHoraireItemDto[];
}

// ─────────────────────────────────────────────────────────────
// §4 — ENTITÉS PARTENAIRES
// ─────────────────────────────────────────────────────────────

export class UpdateEntitesDto {

  /** ex : { "autoAssigner": true, "notifierBoutique": true } */
  @IsOptional() @IsObject()
  colabSettings?: Record<string, boolean>;
}

// ─────────────────────────────────────────────────────────────
// §5 — GESTION DES COLIS
// ─────────────────────────────────────────────────────────────

export class UpdateColisDto {

  @IsOptional() @IsInt() @Min(1) @Max(30)
  colisDelaiMax?: number;

  @IsOptional() @IsInt() @IsPositive()
  colisCapaciteMax?: number;

  @IsOptional() @IsInt() @IsPositive()
  colisValeurMax?: number;

  @IsOptional() @IsString() @MaxLength(50)
  colisPoids?: string;

  @IsOptional() @IsArray() @IsInt({ each: true })
  colisTypesAcceptes?: number[];

  @IsOptional() @IsObject()
  colisIncidentRules?: Record<string, boolean>;
}

// ─────────────────────────────────────────────────────────────
// §6 — PAIEMENT
// ─────────────────────────────────────────────────────────────

export class UpdatePaiementDto {

  @IsOptional() @IsArray()
  paiementMethodes?: Record<string, unknown>[];

  @IsOptional() @IsEnum(VirementFrequence)
  virementFrequence?: VirementFrequence;

  @IsOptional() @IsInt() @Min(0)
  virementSeuil?: number;
}

// ─────────────────────────────────────────────────────────────
// §8 — SÉCURITÉ (2FA)
// Le mot de passe est dans User → ChangePasswordDto ci-dessous
// ─────────────────────────────────────────────────────────────

export class UpdateSecuriteDto {

  @IsOptional() @IsBoolean()
  twoFaEnabled?: boolean;

  @IsOptional() @IsEnum(TwoFaMethod)
  twoFaMethod?: TwoFaMethod;
}

export class ChangePasswordDto {

  /** Vérifié contre User.password (bcrypt) côté service */
  @IsString()
  currentPassword: string;

  @IsString() @MaxLength(255)
  newPassword: string;
}

// ─────────────────────────────────────────────────────────────
// §9 — NOTIFICATIONS
// ─────────────────────────────────────────────────────────────

export class UpdateNotificationsDto {

  @IsOptional() @IsObject()
  notifSettings?: Record<string, Record<string, boolean>>;
}

// ─────────────────────────────────────────────────────────────
// §10 — CONFIDENTIALITÉ
// ─────────────────────────────────────────────────────────────

export class UpdateConfidentialiteDto {

  @IsOptional() @IsObject()
  privacySettings?: Record<string, Record<string, boolean>>;
}