/* ============================================================
 * FICHIER : src/modules/location/dto/proximity.dto.ts
 * RÔLE    : DTOs pour les recherches de proximité
 * ============================================================ */

import {
  IsEnum, IsNumber, IsOptional, Max, Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ProximityQueryDto {

  @IsNumber()
  @Min(-90)
  @Max(90)
  @Transform(({ value }) => parseFloat(value))
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Transform(({ value }) => parseFloat(value))
  longitude: number;

  /** Rayon de recherche en km (défaut : 10, max : 100) */
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  @Transform(({ value }) => parseFloat(value))
  rayonKm?: number = 10;

  /** Nombre maximum de résultats (défaut : 20) */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  /** Filtrer par ville */
  @IsOptional()
  ville?: string;
}
