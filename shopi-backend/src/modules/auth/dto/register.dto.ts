/* ============================================================
 * FICHIER : src/modules/auth/dto/register.dto.ts
 * ============================================================ */

import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsUUID,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserRole }  from '../../../common/enums/user-role.enum';

export class RegisterDto {

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  @MinLength(2,  { message: 'Le prénom doit contenir au moins 2 caractères.' })
  @MaxLength(50, { message: 'Le prénom ne peut pas dépasser 50 caractères.' })
  @Transform(({ value }) => (value as string).trim())
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MinLength(2,  { message: 'Le nom doit contenir au moins 2 caractères.' })
  @MaxLength(50, { message: 'Le nom ne peut pas dépasser 50 caractères.' })
  @Transform(({ value }) => (value as string).trim())
  lastName: string;

  @IsEmail({}, { message: 'Adresse email invalide.' })
  @IsNotEmpty({ message: "L'email est obligatoire." })
  @MaxLength(255)
  @Transform(({ value }) => (value as string).trim().toLowerCase())
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => (value as string | undefined)?.replace(/\s/g, ''))
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(8,   { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    { message: 'Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.' },
  )
  password: string;

  @IsEnum(UserRole, {
    message: `Le rôle doit être l'une des valeurs suivantes : ${Object.values(UserRole).join(', ')}.`,
  })
  @IsNotEmpty({ message: 'Le rôle est obligatoire.' })
  role: UserRole;

  @IsOptional()
  @IsString()
  @MinLength(6,  { message: "Le code d'activation doit contenir au moins 6 caractères." })
  @MaxLength(64)
  @Transform(({ value }) => (value as string | undefined)?.trim().toUpperCase())
  activationCode?: string;

  // Nom de la boutique — accepté sous les deux clés (shopName = clé frontend)
  @IsOptional()
  @IsString()
  @MinLength(2,   { message: 'Le nom de la boutique doit contenir au moins 2 caractères.' })
  @MaxLength(100, { message: 'Le nom de la boutique ne peut pas dépasser 100 caractères.' })
  @Transform(({ value }) => (value as string | undefined)?.trim())
  companyName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2,   { message: 'Le nom de la boutique doit contenir au moins 2 caractères.' })
  @MaxLength(100, { message: 'Le nom de la boutique ne peut pas dépasser 100 caractères.' })
  @Transform(({ value }) => (value as string | undefined)?.trim())
  shopName?: string;

  // Date de naissance (format YYYY-MM-DD)
  @IsOptional()
  @IsDateString({}, { message: 'La date de naissance doit être au format YYYY-MM-DD.' })
  birthDate?: string;

  // Genre
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'other', 'prefer_not'], {
    message: "Le genre doit être 'male', 'female', 'other' ou 'prefer_not'.",
  })
  gender?: string;

  @IsOptional()
  @IsString()
  @IsUUID('all', { message: 'companyTypeId doit être un UUID valide.' })
  companyTypeId?: string;

  // ── Informations pays (détectées via indicatif téléphonique) ──────────────

  /** Code pays ISO-2 détecté via l'indicatif (ex : "GN") */
  @IsOptional()
  @IsString()
  @MaxLength(3)
  countryCode?: string;

  /** Nom du pays (ex : "Guinée") */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryName?: string;

  /** Indicatif international (ex : "+224") */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dialCode?: string;

  // ── Localisation GPS (optionnelle à l'inscription) ────────────────────────

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  /** Précision GPS en mètres */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  locationAccuracy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  /** Indique si l'utilisateur a accordé la permission GPS */
  @IsOptional()
  @IsBoolean()
  gpsEnabled?: boolean;
}