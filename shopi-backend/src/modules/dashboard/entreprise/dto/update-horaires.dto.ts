/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-horaires.dto.ts
 * Section 3 — Horaires d'ouverture
 * ============================================================ */

import {
  IsEnum, IsBoolean, IsOptional, IsString,
  Matches, ValidateNested, IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JourSemaine } from 'src/database/entities/entreprise.table/company-horaire.entity';

/* ── Un seul jour ── */
export class HoraireJourDto {

  @IsEnum(JourSemaine)
  jour!: JourSemaine;

  @IsOptional()
  @IsString()
  /* BUG CORRIGÉ — la regex exigeait "HH:MM" strictement, mais la colonne
   * Postgres `time` renvoie "HH:MM:SS" (ex: "08:00:00") côté GET : un jour
   * renvoyé tel quel (jamais retouché dans <input type="time">, qui lui
   * produit "HH:MM" nativement) faisait rejeter la requête. Secondes
   * maintenant optionnelles pour accepter les deux formats en entrée. */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'Format HH:MM requis (ex: 08:00)',
  })
  ouverture?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
    message: 'Format HH:MM requis (ex: 20:00)',
  })
  fermeture?: string | null;

  @IsBoolean()
  actif!: boolean;
}

/* ── Mise à jour des 7 jours d'un coup ── */
export class UpdateHorairesDto {

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HoraireJourDto)
  horaires!: HoraireJourDto[];
}
