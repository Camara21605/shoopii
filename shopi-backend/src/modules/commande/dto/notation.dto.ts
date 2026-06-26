/* ============================================================
 * FICHIER : src/modules/commande/dto/notation.dto.ts
 * RÔLE    : Notation des acteurs en fin de commande + litige.
 * ============================================================ */

import { Type } from 'class-transformer';
import {
  IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested,
} from 'class-validator';

export class NotationDto {
  @IsIn(['entreprise', 'livreur', 'correspondant', 'client'])
  role: 'entreprise' | 'livreur' | 'correspondant' | 'client';

  @IsInt()
  @Min(1)
  @Max(5)
  note: number;

  @IsOptional()
  @IsString()
  commentaire?: string;
}

export class EnvoyerNotationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotationDto)
  notes: NotationDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  pourboire?: number;
}

export class LitigeDto {
  @IsIn(['endommage', 'manquant', 'errone', 'retard', 'autre'])
  type: 'endommage' | 'manquant' | 'errone' | 'retard' | 'autre';

  @IsString()
  description: string;
}
