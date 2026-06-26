/* ================================================================
 * FICHIER : src/modules/dashboard/client/livreurs/dto/query-livreurs.dto.ts
 * ================================================================ */

import { IsOptional, IsString, IsIn, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryLivreursDto {

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  zone?: string;

  @IsOptional() @IsIn(['moto', 'voiture', 'pickup', 'camion'])
  vehicule?: string;

  @IsOptional() @IsIn(['note', 'livraisons', 'disponible', 'recent'])
  sortBy?: 'note' | 'livraisons' | 'disponible' | 'recent' = 'note';

  @IsOptional() @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  disponibleOnly?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  minRating?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}