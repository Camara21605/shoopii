/* ============================================================
 * FICHIER : src/modules/location/dto/correspondant-location.dto.ts
 * RÔLE    : DTOs pour la géolocalisation du correspondant
 * ============================================================ */

import {
  IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';

export class UpdateCorrespondantLocationDto {

  @IsOptional()
  @IsString()
  @MaxLength(255)
  depotNom?: string;

  @IsOptional()
  @IsString()
  depotAdresse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  depotCommune?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  depotVille?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  depotRegion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  depotCodePostal?: string;

  @IsOptional()
  @IsString()
  depotRepere?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  depotLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  depotLongitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  depotPhone?: string;

  /** Zones actives (array de noms de zones) */
  @IsOptional()
  zonesActives?: string[];
}
