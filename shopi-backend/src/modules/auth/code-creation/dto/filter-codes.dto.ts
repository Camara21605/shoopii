
/* ============================================================
 * FICHIER : src/modules/codes/dto/filter-codes.dto.ts
 * RÔLE    : DTO pour filtrer et paginer la liste des codes
 *           (tableau de l'InvitationsSection.tsx)
 * ============================================================ */

import { IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { CodeStatus } from '../../../../database/entities/code-creation.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength,Max } from 'class-validator';
import { INVITABLE_ROLES } from './generate-and-send.dto';
import type { InvitableRole } from './generate-and-send.dto';

export class FilterCodesDto {

  @ApiPropertyOptional({ enum: INVITABLE_ROLES })
  @IsOptional()
  @IsEnum(INVITABLE_ROLES)
  targetRole?: InvitableRole;

  @ApiPropertyOptional({ enum: CodeStatus })
  @IsOptional()
  @IsEnum(CodeStatus)
  status?: CodeStatus;

  @ApiPropertyOptional({ description: 'Recherche sur code, email, note' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  limit?: number = 20;
}