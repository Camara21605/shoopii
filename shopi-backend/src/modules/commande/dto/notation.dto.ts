/* ============================================================
 * FICHIER : src/modules/commande/dto/notation.dto.ts
 * RÔLE    : Notation des acteurs en fin de commande + litige.
 * ============================================================ */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class NotationDto {
  @IsIn(['entreprise', 'livreur', 'correspondant', 'client'])
  role: 'entreprise' | 'livreur' | 'correspondant' | 'client';

  @IsInt()
  @Min(1)
  @Max(5)
  note: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500, { message: 'Le commentaire ne peut pas dépasser 500 caractères.' })
  commentaire?: string;
}

export class EnvoyerNotationsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Donnez au moins une note.' })
  @ArrayMaxSize(4)
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

  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'La description ne peut pas dépasser 1000 caractères.' })
  description: string;
}
