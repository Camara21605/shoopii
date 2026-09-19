/* ============================================================
 * FICHIER : dashboard/super-admin/dto/update-my-profil.dto.ts
 *
 * RÔLE : validation de PATCH /dashboard/super-admin/my-profil (profil de
 * l'administrateur connecté, page Paramètres → Profil). Tous les champs
 * sont optionnels ; les textes sont nettoyés (espaces) avant contrôle.
 * ============================================================ */

import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

export class UpdateMyProfilDto {
  @IsOptional() @Transform(trim) @IsString()
  @MinLength(1, { message: 'Le prénom ne peut pas être vide.' })
  @MaxLength(100)
  firstName?: string;

  @IsOptional() @Transform(trim) @IsString()
  @MinLength(1, { message: 'Le nom de famille ne peut pas être vide.' })
  @MaxLength(100)
  lastName?: string;

  /* Chiffres, espaces, +, tirets, points, parenthèses — 6 à 20 caractères
   * (colonne admins.phone = varchar(20)). Vide = effacer le numéro. */
  @IsOptional() @Transform(trim) @IsString()
  @Matches(/^$|^\+?[0-9 ().-]{6,20}$/, { message: 'Numéro de téléphone invalide.' })
  phone?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  jobTitle?: string;

  /* Biographie : les retours à la ligne sont conservés (simple trim) */
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MaxLength(200)
  bio?: string;
}
