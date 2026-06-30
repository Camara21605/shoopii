/* ============================================================
 * FICHIER : returns/dto/returns.dto.ts
 * RÔLE    : DTOs pour le module Retours — validation des entrées
 * ============================================================ */

import {
  IsEnum, IsInt, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnReason, ReturnStatus, ReturnType, ReturnPriority } from 'src/database/entities/returns/return-request.entity';

/* ── Créer une demande de retour (côté client) ── */
export class CreateReturnDto {
  @IsUUID()
  commandeId: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsString() @MinLength(2) @MaxLength(255)
  productName: string;

  @IsString() @IsOptional() @MaxLength(255)
  productVariant?: string;

  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @IsString() @MinLength(10) @MaxLength(2000)
  description: string;

  @IsEnum(ReturnType) @IsOptional()
  returnType?: ReturnType;

  @IsInt() @Min(1) @Max(100)
  @Type(() => Number)
  quantity: number;

  @IsInt() @Min(0)
  @Type(() => Number)
  montantDemande: number;
}

/* ── Accepter un retour ── */
export class AcceptReturnDto {
  @IsInt() @Min(0)
  @Type(() => Number)
  montantAccorde: number;

  @IsString() @IsOptional() @MaxLength(1000)
  noteClient?: string;

  @IsString() @IsOptional() @MaxLength(2000)
  noteInterne?: string;
}

/* ── Refuser un retour ── */
export class RefuseReturnDto {
  @IsString() @IsOptional() @MaxLength(1000)
  noteClient?: string;

  @IsString() @IsOptional() @MaxLength(2000)
  noteInterne?: string;
}

/* ── Rembourser un retour ── */
export class RefundReturnDto {
  @IsInt() @Min(0) @IsOptional()
  @Type(() => Number)
  montantAccorde?: number;

  @IsString() @IsOptional() @MaxLength(2000)
  noteInterne?: string;
}

/* ── Ajouter une note interne ── */
export class AddReturnNoteDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  content: string;
}

/* ── Mettre à jour la priorité ── */
export class UpdateReturnPriorityDto {
  @IsEnum(ReturnPriority)
  priority: ReturnPriority;
}

/* ── Filtres de liste ── */
export class FilterReturnsDto {
  @IsOptional() @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional() @IsEnum(ReturnReason)
  reason?: ReturnReason;

  @IsOptional() @IsEnum(ReturnPriority)
  priority?: ReturnPriority;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  dateFrom?: string;

  @IsOptional() @IsString()
  dateTo?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;

  @IsOptional() @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'montantDemande' = 'createdAt';

  @IsOptional() @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
