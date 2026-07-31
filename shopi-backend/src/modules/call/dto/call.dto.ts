import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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

export class CallHistoryQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
