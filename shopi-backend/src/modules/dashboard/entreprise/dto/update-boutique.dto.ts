/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-boutique.dto.ts
 *
 * ✅ CORRECTIONS vs version précédente :
 *   - @IsUrl() et @IsEmail() rejetaient les chaînes vides "" → 400
 *   - Solution : Transform "" → null + ValidateIf(valeur !== null)
 *   - class-transformer requis dans main.ts : useGlobalPipes(new ValidationPipe({ transform: true }))
 * ============================================================ */

import {
  ArrayMaxSize, IsArray,
  IsString, IsOptional, IsEmail, IsUrl, IsUUID,
  IsEnum, MaxLength, ValidateIf,
  IsNotEmpty, IsNumber, Min, Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CompanyStatus } from 'src/database/entities/profiles/entreprise-profile.entity';

/* Transforme une chaîne vide en null avant validation */
const emptyStringToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

/* ── Section 1 : Boutique & Identité ── */
export class UpdateBoutiqueDto {

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slogan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tags?: string;

  /* ✅ website : "" → null, null ignoré par @IsUrl() */
  @IsOptional()
  @Transform(emptyStringToNull)
  @ValidateIf(o => o.website !== null && o.website !== undefined)
  @IsUrl({}, { message: 'URL invalide (ex: https://monsite.com)' })
  @MaxLength(255)
  website?: string | null;

  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  /* BUG CORRIGÉ — @IsString() seul acceptait n'importe quelle chaîne (pas
   * forcément un UUID valide) ; @IsUUID ici, l'EXISTENCE réelle dans
   * company_types est vérifiée côté service (voir
   * BoutiqueParametresService.updateBoutique). */
  @IsOptional()
  @IsUUID()
  companyTypeId?: string;
}

/* ── Section 2 : Contact & Localisation ── */
export class UpdateContactDto {

  @IsOptional()
  @IsString()
  @MaxLength(20)
  businessPhone?: string;

  /* ✅ businessEmail : "" → null, null ignoré par @IsEmail() */
  @IsOptional()
  @Transform(emptyStringToNull)
  @ValidateIf(o => o.businessEmail !== null && o.businessEmail !== undefined)
  @IsEmail({}, { message: 'Email invalide' })
  @MaxLength(255)
  businessEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adresse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  commune?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quartier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pays?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  repere?: string;
}

/* ── Localisation de la boutique ("Voir ma boutique" → onglet Localisation) ──
 * Un SEUL appel enregistre l'adresse ET la position GPS — voir
 * BoutiqueParametresService.updateLocalisation() pour la raison. */
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

export class UpdateLocalisationDto {
  @Transform(trimOrNull)
  @IsString()
  @IsNotEmpty({ message: 'Le pays est obligatoire.' })
  @MaxLength(100)
  pays!: string;

  @Transform(trimOrNull)
  @IsString({ message: 'La ville est obligatoire.' })
  @IsNotEmpty({ message: 'La ville est obligatoire.' })
  @MaxLength(100)
  ville!: string;

  @IsOptional() @Transform(trimOrNull) @IsString() @MaxLength(100)
  commune?: string | null;

  @IsOptional() @Transform(trimOrNull) @IsString() @MaxLength(100)
  quartier?: string | null;

  @IsOptional() @Transform(trimOrNull) @IsString() @MaxLength(500)
  adresse?: string | null;

  @IsOptional() @Transform(trimOrNull) @IsString() @MaxLength(500)
  repere?: string | null;

  @IsNumber({}, { message: 'Latitude invalide.' })
  @Min(-90) @Max(90)
  latitude!: number;

  @IsNumber({}, { message: 'Longitude invalide.' })
  @Min(-180) @Max(180)
  longitude!: number;
}

/** PUT /dashboard/entreprise/parametres/boutique/categories */
export class UpdateBoutiqueCategoriesDto {
  @IsArray({ message: 'categoryIds doit être une liste.' })
  @ArrayMaxSize(200, { message: 'Trop de catégories sélectionnées.' })
  @IsUUID('all', { each: true, message: 'Chaque catégorie doit être un UUID valide.' })
  categoryIds!: string[];
}
