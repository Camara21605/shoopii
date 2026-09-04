/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/avis/dto/repondre-avis.dto.ts
 * ============================================================ */

import { IsString, MinLength, MaxLength } from 'class-validator';

export class RepondreAvisDto {
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reponse: string;
}
