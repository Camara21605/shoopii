/* ============================================================
 * FICHIER : src/modules/location/dto/company-location.dto.ts
 * RÔLE    : DTOs pour la géolocalisation d'une entreprise
 * ============================================================ */

import {
  IsEnum, IsNotEmpty, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateCompanyLocationDto {

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adresse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  commune?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pays?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codePostal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  repere?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class CreateCompanyBranchDto {

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  nom: string;

  @IsEnum(['siege', 'magasin', 'entrepot', 'point_relais', 'autre'])
  type: 'siege' | 'magasin' | 'entrepot' | 'point_relais' | 'autre';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adresse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quartier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  commune?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  ville: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pays?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  codePostal?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  rayonLivraisonKm?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telephone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  repere?: string;

  @IsOptional()
  estPrincipal?: boolean;
}

export class UpdateCompanyBranchDto extends PartialType(CreateCompanyBranchDto) {}
