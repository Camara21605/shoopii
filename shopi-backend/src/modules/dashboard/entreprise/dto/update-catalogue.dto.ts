/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-catalogue.dto.ts
 * ✅ @IsIn(['GNF','EUR','USD']) rejetait "" → corrigé
 * ============================================================ */

import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

const emptyStringToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

export class UpdateCatalogueDto {

  @IsOptional()
  @IsBoolean()
  showOutOfStock?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @IsOptional()
  @IsBoolean()
  showStrikePrice?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReviews?: boolean;

  /* ✅ devise : "" → null, null ignoré */
  @IsOptional()
  @Transform(emptyStringToNull)
  @ValidateIf(o => o.devise !== null && o.devise !== undefined)
  @IsString()
  devise?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  returnPolicy?: string;
}