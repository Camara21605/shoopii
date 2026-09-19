/* ============================================================
 * FICHIER : src/modules/location/dto/actor-map.dto.ts
 * RÔLE    : paramètres de GET /location/map/search (carte de recherche
 *           des entreprises, livreurs et correspondants).
 * ============================================================ */

import { Type } from 'class-transformer';
import { IsInt, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

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

/** GET /location/map/places?q= — suggestions de lieux (villes, communes, quartiers). */
export class PlacesQueryDto {
  @IsString() @MinLength(2) @MaxLength(60)
  q: string;
}

/** GET /location/map/locate — coordonnées d'un lieu choisi. */
export class LocateQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  nom: string;

  @IsIn(['ville', 'commune', 'quartier', 'libre'])
  type: 'ville' | 'commune' | 'quartier' | 'libre';

  @IsOptional() @IsString() @MaxLength(80)
  commune?: string;

  @IsOptional() @IsString() @MaxLength(80)
  ville?: string;
}

/** GET /location/map/roads?x=&y= — tuile z14 (x, y de la grille XYZ). */
export class RoadsQueryDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(16383)
  x: number;

  @Type(() => Number) @IsInt() @Min(0) @Max(16383)
  y: number;
}
