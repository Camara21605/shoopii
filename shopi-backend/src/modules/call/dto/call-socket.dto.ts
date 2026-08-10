/* ============================================================
 * FICHIER : src/modules/call/dto/call-socket.dto.ts
 *
 * RÔLE : DTOs de validation pour les événements Socket.IO du module call
 * (`call:*`). Avant ce fichier, les payloads socket n'étaient typés
 * qu'en interfaces TypeScript inline dans call.gateway.ts — le
 * ValidationPipe global déclaré dans main.ts n'a AUCUN effet sur les
 * `@MessageBody()` tant qu'ils ne portent pas un metatype de classe
 * reconnu par class-validator (une interface n'existe plus à l'exécution).
 * Voir call.gateway.ts pour le @UsePipes qui active ces DTOs.
 *
 * Limites de taille sur sdp.sdp / candidate.candidate : un client
 * (légitime ou malveillant) qui construit un payload SDP/ICE anormalement
 * volumineux serait sinon relayé tel quel au correspondant sans aucun
 * contrôle — 256 Ko/8 Ko sont largement au-dessus de ce qu'un SDP/ICE
 * candidate réel atteint jamais (quelques Ko / quelques centaines
 * d'octets), donc sans impact sur l'usage normal.
 * ============================================================ */

import { Type } from 'class-transformer';
import {
  IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID,
  MaxLength, ValidateNested,
} from 'class-validator';
import { CallType } from 'src/database/entities/call/call.entity';

const MAX_SDP_LENGTH       = 256_000; // ~256 Ko
const MAX_CANDIDATE_LENGTH = 8_192;   // 8 Ko

export class CallInitiateDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  calleeUserId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  callerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  callerAvatar?: string;

  @IsOptional()
  @IsEnum(CallType)
  callType?: CallType;
}

export class CallAcceptDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  callerUserId: string;
}

export class CallRejectDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  callerUserId: string;
}

export class CallEndDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  targetUserId: string;
}

export class CallBusyDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  callerUserId: string;
}

/** Sous-forme de RTCSessionDescriptionInit — validée avec limite de taille. */
export class SdpDto {
  @IsIn(['offer', 'answer', 'pranswer', 'rollback'])
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';

  @IsString()
  @MaxLength(MAX_SDP_LENGTH)
  sdp: string;
}

export class CallOfferDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  targetUserId: string;

  @ValidateNested()
  @Type(() => SdpDto)
  sdp: SdpDto;
}

export class CallAnswerDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  targetUserId: string;

  @ValidateNested()
  @Type(() => SdpDto)
  sdp: SdpDto;
}

/** Sous-forme de RTCIceCandidateInit — validée avec limite de taille. */
export class IceCandidateDto {
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

export class CallIceCandidateDto {
  @IsUUID()
  conversationId: string;

  @IsUUID()
  targetUserId: string;

  @ValidateNested()
  @Type(() => IceCandidateDto)
  candidate: IceCandidateDto;
}
