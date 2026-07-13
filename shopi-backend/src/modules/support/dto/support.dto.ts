/* ============================================================
 * FICHIER            : src/modules/support/dto/support.dto.ts
 * RÔLE               : Data Transfer Objects du module support.
 * RESPONSABILITES    : Valider et contraindre toutes les entrées
 *                      des endpoints support (création, réponse,
 *                      changement de statut, filtres, notation).
 *                      Utiliser @IsEnum sur tous les champs d'énumération
 *                      afin de rejeter toute valeur hors liste blanche.
 * DEPENDANCES        : class-validator, entités support
 * AUTEUR             : Shopi03
 * DERNIERE MISE A JOUR: 2026-07-03
 *
 * SECURITE :
 *   @IsEnum sur status / type / priority → rejet des valeurs inconnues
 *   (protège contre l'injection de valeurs arbitraires en base).
 * ============================================================ */
import {
  IsString, IsEnum, IsOptional, IsUUID, MinLength, MaxLength,
  IsInt, Min, Max,
} from 'class-validator';
import {
  SupportTicketType,
  SupportTicketStatus,
  SupportTicketPriority,
} from '../../../database/entities/support/support-ticket.entity';

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketType)
  type!: SupportTicketType;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  subject!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  firstMessage!: string;

  @IsOptional()
  @IsUUID()
  relatedOrderId?: string;
}

export class ReplySupportTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class AssignTicketDto {
  @IsUUID()
  agentId!: string;
}

export class RateSupportTicketDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class FilterSupportTicketsDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportTicketType)
  type?: SupportTicketType;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
