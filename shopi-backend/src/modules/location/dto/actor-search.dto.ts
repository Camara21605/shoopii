/* ============================================================
 * FICHIER : src/modules/location/dto/actor-search.dto.ts
 * RÔLE    : DTO de la recherche d'acteur par nom (carte client).
 * ============================================================ */

import { IsString, MinLength } from 'class-validator';

export class ActorSearchQueryDto {
  /** Nom (ou début de nom) d'une boutique, d'un livreur ou d'un correspondant. */
  @IsString()
  @MinLength(2)
  q: string;
}
