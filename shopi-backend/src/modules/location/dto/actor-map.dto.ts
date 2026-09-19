/* ============================================================
 * FICHIER : src/modules/location/dto/actor-map.dto.ts
 * RÔLE    : paramètres de GET /location/map/search (carte de recherche
 *           des entreprises, livreurs et correspondants).
 * ============================================================ */

import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class ActorMapQueryDto {
  /** Nom, quartier, commune ou ville. Vide = « autour de moi » (lat/lng requis). */
  @IsOptional() @IsString() @MaxLength(80)
  q?: string;

  /** Types voulus, séparés par des virgules : vendor,delivery,correspondent (défaut : les trois). */
  @IsOptional()
  @Matches(/^(vendor|delivery|correspondent)(,(vendor|delivery|correspondent))*$/, {
    message: 'types doit être une liste parmi vendor, delivery, correspondent.',
  })
  types?: string;

  /** Position du client — permet le tri par distance et le mode « autour de moi ». */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90)  @Max(90)
  lat?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  lng?: number;

  /** Rayon du mode « autour de moi » (km). */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(200)
  radiusKm?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(60)
  limit?: number;
}
