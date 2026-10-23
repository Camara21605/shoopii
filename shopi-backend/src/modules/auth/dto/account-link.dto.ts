/* ============================================================
 * FICHIER : src/modules/auth/dto/account-link.dto.ts
 * DTOs pour le flux "Mon espace" (compte pro ↔ compte client lié).
 * ============================================================ */

import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Lettres (accents compris), espaces, tirets, apostrophes — pas de chiffres ni de symboles. */
const PERSON_NAME = /^[\p{L}][\p{L}\p{M} '’.-]*$/u;
import { ApiProperty } from '@nestjs/swagger';

export class CreateLinkedClientDto {
  @ApiProperty({ example: 'NouveauMdp2025!', description: 'Mot de passe du nouveau compte client (indépendant du compte pro)' })
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MinLength(8,   { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères.' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
    { message: 'Le mot de passe doit contenir au moins : 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial.' },
  )
  password: string;

  /** Prénom de la PERSONNE (pas le nom de la boutique) — obligatoire pour un
   *  compte entreprise, dont le compte pro ne contient que le nom de la boutique. */
  @ApiProperty({ required: false, example: 'Mamadou' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @MinLength(2,  { message: 'Le prénom doit contenir au moins 2 caractères.' })
  @MaxLength(50, { message: 'Le prénom ne peut pas dépasser 50 caractères.' })
  @Matches(PERSON_NAME, { message: 'Le prénom ne doit contenir que des lettres.' })
  firstName?: string;

  @ApiProperty({ required: false, example: 'Camara' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @MinLength(2,  { message: 'Le nom doit contenir au moins 2 caractères.' })
  @MaxLength(50, { message: 'Le nom ne peut pas dépasser 50 caractères.' })
  @Matches(PERSON_NAME, { message: 'Le nom ne doit contenir que des lettres.' })
  lastName?: string;
}

/**
 * Preuve de possession d'un compte client PRÉEXISTANT — exactement l'un des
 * deux champs, jamais les deux, jamais aucun (la liaison n'est JAMAIS
 * automatique sur simple correspondance d'email/téléphone).
 */
export class LinkExistingClientDto {
  @ApiProperty({ required: false, description: 'Mot de passe du compte client à lier' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ required: false, description: 'resetToken obtenu via /auth/forgot-password + /auth/verify-otp sur ce compte client' })
  @IsOptional()
  @IsString()
  resetToken?: string;
}
