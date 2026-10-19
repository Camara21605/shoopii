/* ============================================================
 * FICHIER : src/modules/location/dto/tracking.dto.ts
 * ============================================================ */

import { IsNumber, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, Min, Max, IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/** Coordonnées GPS pour le calcul d'itinéraire */
export class WaypointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

/** Body de POST /location/route */
export class RouteRequestDto {
  @IsArray()
  @ArrayMinSize(2, { message: 'Au moins 2 points de passage requis.' })
  @ValidateNested({ each: true })
  @ArrayMaxSize(10)
  @Type(() => WaypointDto)
  waypoints: WaypointDto[];

  /** car (défaut) · moto · foot — écran Itinéraire de l'appli. */
  @IsOptional()
  @IsIn(['car', 'moto', 'foot'])
  profile?: 'car' | 'moto' | 'foot';
}
