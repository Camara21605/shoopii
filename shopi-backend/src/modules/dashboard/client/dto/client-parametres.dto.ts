/* ============================================================
 * src/modules/dashboard/client/dto/client-parametres.dto.ts
 * Tous les DTOs pour les 14 sections des paramètres client
 * ============================================================ */

import {
  IsBoolean, IsEmail, IsEnum, IsIn, IsNumber, IsObject, IsOptional,
  IsString, MaxLength, MinLength, Min, ValidateNested, IsArray, Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ── Section 1 — Profil personnel ── */
/* Les règles de fond (format du nom d'utilisateur, date réelle, valeurs autorisées…) sont
 * appliquées par ProfilService : elles ne s'appliquent qu'aux champs réellement MODIFIÉS. */
export class UpdateProfilDto {
  @IsOptional() @IsString() @MaxLength(50)  firstName?:     string;
  @IsOptional() @IsString() @MaxLength(50)  lastName?:      string;
  @IsOptional() @IsString() @MaxLength(31)  username?:      string;   // « @ » éventuel + 30
  @IsOptional() @IsString() @MaxLength(10)  dateNaissance?: string; // 'YYYY-MM-DD' ou ''
  @IsOptional() @IsString() @MaxLength(20)  genre?:         string; // 'homme'|'femme'|'autre'|'non_precise' ou ''
  @IsOptional() @IsString() @MaxLength(5)   langue?:        string; // fr | en | ar | pt | zh
  @IsOptional() @IsString() @MaxLength(200) bio?:           string;
}

/* ── Section 1b — Coordonnées ── */
export class UpdateCoordonneesDto {
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;

  /** Mot de passe actuel — exigé dès que l'e-mail ou le téléphone change réellement. */
  @IsOptional() @IsString() @MaxLength(128) currentPassword?: string;
}

/** POST /client/parametres/coordonnees/email/verifier */
export class ConfirmEmailCodeDto {
  @IsString() @MinLength(6) @MaxLength(6) @Matches(/^\d{6}$/, { message: 'Le code doit contenir 6 chiffres.' })
  code: string;
}

/* ── Section 9 — Sécurité ── */
export class ChangePasswordDto {
  @IsString()  currentPassword: string;
  @IsString()  newPassword:     string;
}

export class UpdateSecuriteDto {
  @IsOptional() @IsBoolean() twoFaEnabled?: boolean;
  @IsOptional() @IsString()  twoFaMethod?:  string; // 'sms'|'totp'|'fido2'

  /* Requis pour désactiver la 2FA — voir SecuriteService.update2fa().
   * Optionnels dans le DTO (validés à la main dans le service) pour ne
   * pas casser un futur appel qui ne concernerait que twoFaMethod seul. */
  @IsOptional() @IsString() currentPassword?: string;
  @IsOptional() @IsString() code?:            string;
}


/** Type d'alerte de sécurité — voir SecuriteService.DEFAULT_ALERT_SETTINGS */
export const ALERT_TYPES = ['connex', 'mdp', 'tentatives', 'transaction', 'pays'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export class UpdateAlertSettingDto {
  @IsIn(ALERT_TYPES) type: AlertType;
  @IsBoolean()        email: boolean;
}

/* ── Section 10 — Notifications ── */
export class UpdateNotifsDto {
  /** Interrupteurs globaux par canal */
  @IsOptional() @IsObject() global?: { push?: boolean; email?: boolean };
  /** Mode « Ne pas déranger » (heures locales HH:MM) */
  @IsOptional() @IsObject() dnd?: { enabled?: boolean; start?: string; end?: string; timezone?: string };
  /** Catégories : commandes | promos | messages | social → { push?, email? } */
  @IsOptional() @IsObject() groups?: Record<string, { push?: boolean; email?: boolean }>;
}

/* ── Section 11 — Confidentialité ── */
export class UpdatePrivacyDto {
  /**
   * JSON : { visibilite:'public', historiqueCommandes:false, wishlist:true, ... }
   */
  @IsOptional() @IsString() privacySettings?: string;
}

/* ── Section 12 — Apparence ── */
export class UpdateApparenceDto {
  @IsOptional() @IsString() theme?:         string; // 'clair'|'sombre'|'auto'
  @IsOptional() @IsString() textSize?:      string; // 'normal'|'grand'|'tres_grand'
  @IsOptional() @IsString() imageQuality?:  string; // 'haute'|'economique'
}

/* ── Section 13 — Langue & région ── */
export class UpdateLangueDto {
  @IsOptional() @IsString()  langue?:       string; // 'fr'|'en'|'ar'|'pt'
  @IsOptional() @IsString()  devise?:       string; // 'GNF'|'USD'|'EUR'|'XOF'
  @IsOptional() @IsString()  timezone?:     string; // 'GMT+0'|'GMT+1'|...
}

/* ── Section 14 — Zone de danger ── mot de passe requis pour toute action
 * irréversible ou à fort impact (désactivation, suppression du compte). */
export class DangerConfirmDto {
  @IsString() password: string;
}