/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/livreurs/dto/mission.dto.ts
 *
 * RÔLE : Validation POST /dashboard/entreprise/livreurs/missions —
 * correspond au formulaire "Diffuser une mission" (actions rapides
 * de LivreursPage.tsx).
 * ============================================================ */

import {
  IsString, IsNotEmpty, IsOptional, IsBoolean,
  IsNumber, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMissionDto {

  @IsString()
  @IsNotEmpty({ message: 'Le titre de la mission est obligatoire.' })
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  zone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reward?: number;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean;
}
