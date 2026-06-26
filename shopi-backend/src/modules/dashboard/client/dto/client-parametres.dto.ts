/* ============================================================
 * src/modules/dashboard/client/dto/client-parametres.dto.ts
 * Tous les DTOs pour les 14 sections des paramètres client
 * ============================================================ */

import {
  IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional,
  IsString, MaxLength, Min, ValidateNested, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ── Section 1 — Profil personnel ── */
export class UpdateProfilDto {
  @IsOptional() @IsString() @MaxLength(50)  firstName?:     string;
  @IsOptional() @IsString() @MaxLength(50)  lastName?:      string;
  @IsOptional() @IsString() @MaxLength(30)  username?:      string;
  @IsOptional() @IsString()                 dateNaissance?: string; // 'YYYY-MM-DD'
  @IsOptional() @IsString()                 genre?:         string; // 'homme'|'femme'|'autre'|'non_precise'
  @IsOptional() @IsString()                 langue?:        string;
  @IsOptional() @IsString() @MaxLength(200) bio?:           string;
}

/* ── Section 1b — Coordonnées ── */
export class UpdateCoordonneesDto {
  @IsOptional() @IsEmail()   email?: string;
  @IsOptional() @IsString()  phone?: string;
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