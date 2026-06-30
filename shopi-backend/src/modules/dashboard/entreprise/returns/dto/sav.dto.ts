/* ============================================================
 * FICHIER : returns/dto/sav.dto.ts
 * RÔLE    : DTOs pour le module SAV
 * ============================================================ */

import {
  IsEnum, IsInt, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SavStatus }      from 'src/database/entities/returns/sav-ticket.entity';
import { ReturnPriority } from 'src/database/entities/returns/return-request.entity';

/* ── Créer un ticket SAV (côté client) ── */
export class CreateSavTicketDto {
  @IsString() @MinLength(5) @MaxLength(255)
  subject: string;

  @IsString() @MinLength(10) @MaxLength(3000)
  firstMessage: string;

  @IsUUID() @IsOptional()
  commandeId?: string;

  @IsUUID() @IsOptional()
  productId?: string;

  @IsString() @IsOptional() @MaxLength(255)
  productName?: string;

  @IsEnum(ReturnPriority) @IsOptional()
  priority?: ReturnPriority;
}

/* ── Répondre à un ticket ── */
export class ReplySavDto {
  @IsString() @MinLength(1) @MaxLength(5000)
  content: string;
}

/* ── Assigner un ticket ── */
export class AssignSavDto {
  @IsUUID()
  assigneeId: string;
}

/* ── Changer la priorité ── */
export class UpdateSavPriorityDto {
  @IsEnum(ReturnPriority)
  priority: ReturnPriority;
}

/* ── Filtres liste SAV ── */
export class FilterSavDto {
  @IsOptional() @IsEnum(SavStatus)
  status?: SavStatus;

  @IsOptional() @IsEnum(ReturnPriority)
  priority?: ReturnPriority;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}
