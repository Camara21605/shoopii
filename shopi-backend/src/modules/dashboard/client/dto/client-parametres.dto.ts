/* ============================================================
 * src/modules/dashboard/client/dto/client-parametres.dto.ts
 * Tous les DTOs pour les 14 sections des paramètres client
 * ============================================================ */

import {
  IsBoolean, IsEmail, IsEnum, IsIn, IsNumber, IsOptional,
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

/* ── Section 2 — Adresses ── */
export class CreateAdresseDto {
  @IsString()            nom:       string;  // 'Domicile' | 'Bureau' | autre
  @IsString()            fullName:  string;
  @IsString()            adresse:   string;
  @IsOptional() @IsString() commune?: string;
  @IsString()            ville:     string;
  @IsOptional() @IsString() phone?:   string;
  @IsBoolean()           isDefault: boolean;
}

export class UpdateAdresseDto {
  @IsOptional() @IsString()   nom?:       string;
  @IsOptional() @IsString()   fullName?:  string;
  @IsOptional() @IsString()   adresse?:   string;
  @IsOptional() @IsString()   commune?:   string;
  @IsOptional() @IsString()   ville?:     string;
  @IsOptional() @IsString()   phone?:     string;
  @IsOptional() @IsBoolean()  isDefault?: boolean;
}

/* ── Section 3 — Moyens de paiement ── */
export enum PaymentMethodType {
  ORANGE = 'orange', MTN = 'mtn', CARTE = 'carte',
  ESPECES = 'especes', VIREMENT = 'virement', WALLET = 'wallet',
}

export class AddPaiementDto {
  @IsEnum(PaymentMethodType) type:      PaymentMethodType;
  @IsString()                numero:    string;   // numéro de téléphone ou carte masquée
  @IsOptional() @IsBoolean() isDefault?: boolean;
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

export class QuestionSecuriteItemDto {
  @IsString()  question: string;
  @IsString()  reponse:  string;
}

export class UpdateQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionSecuriteItemDto)
  questions: QuestionSecuriteItemDto[];
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
  /**
   * JSON : { commandes:{sms:true,email:true,push:true}, promos:{...}, ... }
   */
  @IsOptional() @IsString() notifSettings?: string;
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