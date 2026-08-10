/* ============================================================
 * FICHIER : src/modules/messagerie/dto/group-call-socket.dto.ts
 *
 * RÔLE : DTOs de validation pour les événements Socket.IO d'appel de
 * groupe (`group_call:*`). Voir call-socket.dto.ts (module call) pour
 * le raisonnement complet — même problème corrigé ici : les payloads
 * n'étaient typés qu'en interfaces TypeScript, invisibles pour le
 * ValidationPipe une fois compilées (aucune métadonnée à l'exécution).
 * ============================================================ */

import { Type } from 'class-transformer';
import {
  IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, ValidateNested,
} from 'class-validator';
import { CallType } from 'src/database/entities/call/call.entity';

const MAX_SDP_LENGTH       = 256_000; // ~256 Ko
const MAX_CANDIDATE_LENGTH = 8_192;   // 8 Ko

export class GroupCallInitiateDto {
  @IsUUID()
  groupId: string;

  @IsOptional()
  @IsEnum(CallType)
  callType?: CallType;
}

export class GroupCallRefDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  callId: string;
}

export class GroupSdpDto {
  @IsIn(['offer', 'answer', 'pranswer', 'rollback'])
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';

  @IsString()
  @MaxLength(MAX_SDP_LENGTH)
  sdp: string;
}

export class GroupIceCandidateDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CANDIDATE_LENGTH)
  candidate?: string;

  @IsOptional()
  @IsString()
  sdpMid?: string | null;

  @IsOptional()
  @IsInt()
  sdpMLineIndex?: number | null;

  @IsOptional()
  @IsString()
  usernameFragment?: string | null;
}

export class GroupCallOfferDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  callId: string;

  @IsUUID()
  targetUserId: string;

  @ValidateNested()
  @Type(() => GroupSdpDto)
  sdp: GroupSdpDto;
}

export class GroupCallAnswerDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  callId: string;

  @IsUUID()
  targetUserId: string;

  @ValidateNested()
  @Type(() => GroupSdpDto)
  sdp: GroupSdpDto;
}

export class GroupCallIceCandidateDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  callId: string;

  @IsUUID()
  targetUserId: string;

  @ValidateNested()
  @Type(() => GroupIceCandidateDto)
  candidate: GroupIceCandidateDto;
}

export class GroupCallToggleMediaDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  callId: string;

  @IsOptional()
  @IsBoolean()
  audioEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  videoEnabled?: boolean;
}
