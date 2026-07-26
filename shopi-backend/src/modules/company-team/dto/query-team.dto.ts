/* ============================================================
 * FICHIER      : src/modules/company-team/dto/query-team.dto.ts
 * MODULE       : Company Team
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  IsOptional, IsString, IsEnum, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TeamMemberStatus } from '../../../database/entities/company-team/company-team-member.entity';

export class QueryTeamDto {
  /** Filtrer par statut */
  @IsOptional()
  @IsEnum(TeamMemberStatus)
  status?: TeamMemberStatus;

  /** Recherche par nom, email, poste */
  @IsOptional()
  @IsString()
  search?: string;

  /** Numéro de page (défaut : 1) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Éléments par page (défaut : 20, max : 100) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class QueryActivityDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
