import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CallType } from 'src/database/entities/call/call.entity';

export class StartCallDto {
  @IsUUID()
  calleeUserId: string;

  @IsEnum(CallType)
  callType: CallType;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class CallIdDto {
  @IsUUID()
  callId: string;
}

/**
 * PARTIE 9 — page/limit étaient de simples chaînes non bornées jusqu'ici :
 * un client pouvait demander ?limit=999999 (payload disproportionné, coût
 * DB inutile) et une valeur non numérique produisait un NaN silencieux
 * (skip/take incohérents côté TypeORM) au lieu d'un 400 propre. Même
 * convention que ListNotificationsQueryDto (limite max 50).
 */
export class CallHistoryQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}
