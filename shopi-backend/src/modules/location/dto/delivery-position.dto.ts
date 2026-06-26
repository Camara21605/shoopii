/* ============================================================
 * FICHIER : src/modules/location/dto/delivery-position.dto.ts
 * RÔLE    : DTOs pour la gestion de la position livreur
 * ============================================================ */

import {
  IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateDeliveryPositionDto {

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  /** Précision GPS en mètres */
  @IsOptional()
  @IsNumber()
  @Min(0)
  precisionM?: number;

  /** Cap en degrés (0–360) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  cap?: number;

  /** Vitesse en km/h */
  @IsOptional()
  @IsNumber()
  @Min(0)
  vitesseKmh?: number;

  /** ID de session de partage */
  @IsOptional()
  @IsString()
  @MaxLength(36)
  sessionId?: string;
}

export class UpdateDeliveryZoneDto {

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  zone?: string;

  /** Communes actives (JSON array) */
  @IsOptional()
  communesActives?: string[];

  /** Rayon de livraison en km */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  /** Distance maximale acceptée en km */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  distanceMax?: number;
}
