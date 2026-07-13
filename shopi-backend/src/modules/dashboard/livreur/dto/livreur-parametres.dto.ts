/* ============================================================
 * FICHIER : src/modules/dashboard/livreur/dto/livreur-parametres.dto.ts
 *
 * ✅ FIX DÉFINITIF — fonctionne AVEC ou SANS transform:true
 *
 * STRATÉGIE :
 *   @ValidateIf(o => o.champ && o.champ.length > 0)
 *   → saute la validation si "" OU null OU undefined
 *   → ne dépend PAS de @Transform ni de transform:true
 * ============================================================ */

import {
  IsString, IsOptional, IsBoolean, IsNumber,
  IsArray, IsEnum, IsIn, MaxLength, Min, Max,
  Matches, ValidateNested, ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { VehicleType } from 'src/database/entities/profiles/livreur-profile.entity';
import { JourSemaine } from 'src/database/entities/livreur.table/livreur-horaire.entity';

/* ─────────────────────────────────────────────────────────────
 * HELPERS
 * ───────────────────────────────────────────────────────────── */

/** Chaîne non vide → valide, sinon skip */
const notEmpty = (o: any, key: string) =>
  o[key] !== null && o[key] !== undefined && o[key] !== '';

const toNum = ({ value }: { value: unknown }) =>
  value === '' || value == null ? undefined : Number(value);

const toBool = ({ value }: { value: unknown }) => {
  if (value === 'true'  || value === true)  return true;
  if (value === 'false' || value === false) return false;
  return value;
};

const skipEmpty = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/* Regex email permissive */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─────────────────────────────────────────────────────────────
 * SECTION 1 — PROFIL
 * ───────────────────────────────────────────────────────────── */
export class UpdateLivreurProfilDto {

  @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;

  @IsOptional() @IsString() @MaxLength(20)
  phone?: string;

  /*
   * ✅ FIX : ValidateIf vérifie "" explicitement
   * → @Matches ne s'exécute que si l'email est une vraie valeur non vide
   * → Fonctionne SANS transform:true
   */
  @IsOptional()
  @ValidateIf(o => notEmpty(o, 'email'))
  @Matches(EMAIL_RE, { message: 'Adresse email invalide (ex: nom@domaine.com)' })
  @MaxLength(255)
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @IsString() @MaxLength(255)  langues?: string;
  @IsOptional() @IsString() @MaxLength(100)  ville?: string;
  @IsOptional() @IsString() @MaxLength(10)   deliveryEmoji?: string;
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 3 — ZONES & HORAIRES
 * ───────────────────────────────────────────────────────────── */
export class UpdateZonesDto {
  @IsOptional() @IsString() @MaxLength(30) deliveryType?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) communesActives?: string[];
  @IsOptional() @Transform(toNum) @IsNumber() @Min(1) @Max(100) distanceMax?: number;
  @IsOptional() autoDispoSettings?: Record<string, boolean>;
}

export class UpdateZonesDispoDto {
  @IsArray() @IsString({ each: true }) zonesDisponibles!: string[];
}

export class HoraireJourDto {
  @IsEnum(JourSemaine) jour!: JourSemaine;

  @IsOptional()
  @ValidateIf(o => notEmpty(o, 'ouverture'))
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Format HH:MM requis (ex: 08:00)' })
  ouverture?: string | null;

  @IsOptional()
  @ValidateIf(o => notEmpty(o, 'fermeture'))
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Format HH:MM requis (ex: 20:00)' })
  fermeture?: string | null;

  @IsBoolean() actif!: boolean;
}

export class UpdateHorairesLivreurDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => HoraireJourDto)
  horaires!: HoraireJourDto[];
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 4 — VITESSES
 * ───────────────────────────────────────────────────────────── */
export class UpdateVitessesDto {
  @IsOptional() vitessesActives?: Record<string, boolean>;
  @IsOptional() @Transform(toNum) @ValidateIf(o => o.tarifBase  !== undefined) @IsNumber() @Min(0) tarifBase?: number;
  @IsOptional() @Transform(toNum) @ValidateIf(o => o.tarifParKm !== undefined) @IsNumber() @Min(0) tarifParKm?: number;
  @IsOptional() @Transform(toNum) @ValidateIf(o => o.supplementLourd !== undefined) @IsNumber() @Min(0) supplementLourd?: number;
  @IsOptional() @Transform(toNum) @ValidateIf(o => o.majorationNocturne !== undefined) @IsNumber() @Min(0) @Max(100) majorationNocturne?: number;
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 5 — VÉHICULE
 * ───────────────────────────────────────────────────────────── */
export class UpdateVehiculeDto {

  /* ✅ "" → undefined via @Transform, pas null (colonne non-nullable) */
  @IsOptional()
  @Transform(skipEmpty)
  @ValidateIf(o => notEmpty(o, 'vehicleType'))
  @IsEnum(VehicleType, {
    message: `Type invalide. Valeurs : ${Object.values(VehicleType).join(', ')}`
  })
  vehicleType?: VehicleType;

  @IsOptional() @ValidateIf(o => notEmpty(o, 'vehiculeMarque'))  @IsString() @MaxLength(100) vehiculeMarque?:  string | null;
  @IsOptional() @ValidateIf(o => notEmpty(o, 'vehiculeModele'))  @IsString() @MaxLength(100) vehiculeModele?:  string | null;
  @IsOptional() @ValidateIf(o => notEmpty(o, 'vehiculeCouleur')) @IsString() @MaxLength(50)  vehiculeCouleur?: string | null;
  @IsOptional() @ValidateIf(o => notEmpty(o, 'vehiculePlaque'))  @IsString() @MaxLength(20)  vehiculePlaque?:  string | null;

  @IsOptional()
  @Transform(toNum)
  @ValidateIf(o => o.vehiculeAnnee !== undefined)
  @IsNumber() @Min(1990) @Max(new Date().getFullYear() + 1)
  vehiculeAnnee?: number;

  /* ✅ "" → undefined (colonne non-nullable) */
  @IsOptional()
  @Transform(skipEmpty)
  @ValidateIf(o => notEmpty(o, 'vehiculeCapacite'))
  @IsIn(['10kg', '20kg', '50kg', '50kg+'])
  vehiculeCapacite?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) colisAcceptes?: string[];
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 6 — PAIEMENT
 * ───────────────────────────────────────────────────────────── */
export class UpdatePaiementLivreurDto {
  @IsOptional() @IsArray() methodesRetrait?: Record<string, unknown>[];

  /* ✅ "" → skip (colonne non-nullable) */
  @IsOptional()
  @ValidateIf(o => notEmpty(o, 'virementFrequence'))
  @IsIn(['daily', 'weekly', 'bimonthly', 'monthly'])
  virementFrequence?: string;

  @IsOptional() @Transform(toNum) @ValidateIf(o => o.virementSeuil !== undefined) @IsNumber() @Min(0) virementSeuil?: number;
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 7 — SÉCURITÉ
 * ───────────────────────────────────────────────────────────── */
export class UpdateLivreurPasswordDto {
  @IsString() @MaxLength(100) currentPassword!: string;
  @IsString() @MaxLength(100) newPassword!: string;
  @IsString() @MaxLength(100) confirmPassword!: string;
}

export class UpdateLivreurTwoFaDto {
  @Transform(toBool) @IsBoolean() twoFaEnabled!: boolean;

  @IsOptional()
  @ValidateIf(o => notEmpty(o, 'twoFaMethod'))
  @IsIn(['app', 'sms', 'email'])
  twoFaMethod?: string | null;
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 8 — NOTIFICATIONS
 * ───────────────────────────────────────────────────────────── */
export class UpdateLivreurNotifsDto {
  @IsOptional() @Transform(toBool) @IsBoolean() nouvelleMission?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() missionAnnulee?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() missionLivree?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() rappelMission?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() messageClient?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() gainRecu?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() virementEffectue?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() rapportHebdo?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() pushNotif?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() smsNotif?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() emailNotif?: boolean;
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 9 — CONFIDENTIALITÉ
 * ───────────────────────────────────────────────────────────── */
export class UpdateLivreurPrivacyDto {
  @IsOptional() @Transform(toBool) @IsBoolean() showInSearch?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() showRating?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() showDeliveryCount?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() shareLocation?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() improveAlgo?: boolean;
  @IsOptional() @Transform(toBool) @IsBoolean() anonymizedStats?: boolean;
}

/* ─────────────────────────────────────────────────────────────
 * SECTION 10 — ZONE SENSIBLE
 * ───────────────────────────────────────────────────────────── */
export class LivreurDangerConfirmDto {
  @IsString() password!: string;
}