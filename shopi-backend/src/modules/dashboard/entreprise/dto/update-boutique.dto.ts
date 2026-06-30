/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-boutique.dto.ts
 *
 * ✅ CORRECTIONS vs version précédente :
 *   - @IsUrl() et @IsEmail() rejetaient les chaînes vides "" → 400
 *   - Solution : Transform "" → null + ValidateIf(valeur !== null)
 *   - class-transformer requis dans main.ts : useGlobalPipes(new ValidationPipe({ transform: true }))
 * ============================================================ */

import {
  IsString, IsOptional, IsEmail, IsUrl,
  IsEnum, MaxLength, ValidateIf,
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

  @IsOptional()
  @IsString()
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