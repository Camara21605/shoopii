import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
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

/**
 * POST /calls/diagnostic — un appel est resté sur « Connexion… » : chemins
 * réseau vus de chaque côté (host / srflx / relay). Uniquement journalisé
 * ([CALL-DIAG]) pour voir POURQUOI les appels échouent en production.
 */
export class CallDiagnosticDto {
  @IsString() @MaxLength(30)
  platform!: string;

  @IsIn(['incoming', 'outgoing'])
  direction!: 'incoming' | 'outgoing';

  @IsBoolean()
  turnConfigured!: boolean;

  @IsArray() @ArrayMaxSize(4) @IsIn(['host', 'srflx', 'prflx', 'relay'], { each: true })
  localTypes!: string[];

  @IsArray() @ArrayMaxSize(4) @IsIn(['host', 'srflx', 'prflx', 'relay'], { each: true })
  remoteTypes!: string[];

  @IsOptional() @IsString() @MaxLength(20)
  lastState?: string;
}
