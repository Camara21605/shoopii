/* ============================================================
 * FICHIER : src/modules/validation-config/validation-config.dto.ts
 * ============================================================ */

import {
  IsOptional, IsString, IsInt, IsNumber, IsBoolean,
  IsIn, IsObject, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateValidationConfigDto {

  @IsOptional()
  @IsString()
  @IsIn(['auto', 'manuel', 'hybride', 'score'])
  modeGlobal?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  @Type(() => Number)
  delaiExpirationH?: number;

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(100)
  @Type(() => Number)
  scoreMinAuto?: number;

  @IsOptional()
  @IsBoolean()
  notifEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notifSmsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notifPushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notifAdminEnabled?: boolean;

  @IsOptional()
  @IsObject()
  reglesActeurs?: Record<string, unknown>;
}
