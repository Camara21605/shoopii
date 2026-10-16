/* ============================================================
 * FICHIER : src/modules/call/dto/call-room.dto.ts
 * Payloads des événements d'appel à plusieurs (voir call-room.gateway.ts).
 * Validés avec whitelist + forbidNonWhitelisted : tout champ inattendu est refusé.
 * ============================================================ */

import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsUUID, ValidateNested } from 'class-validator';

import { IceCandidateDto, SdpDto } from './call-socket.dto';

/** Inviter une personne : depuis un appel 1:1 (peerUserId) ou une salle existante (roomId). */
export class CallRoomInviteDto {
  @IsOptional()
  @IsUUID()
  roomId?: string;

  /** L'autre personne de l'appel 1:1 en cours (création de la salle). */
  @IsOptional()
  @IsUUID()
  peerUserId?: string;

  @IsUUID()
  inviteeUserId: string;

  @IsOptional()
  @IsIn(['audio', 'video'])
  callType?: 'audio' | 'video';
}

export class CallRoomRefDto {
  @IsUUID()
  roomId: string;
}

/** Signalisation WebRTC entre deux participants d'une salle. */
export class CallRoomSignalDto {
  @IsUUID()
  roomId: string;

  @IsUUID()
  targetUserId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SdpDto)
  description?: SdpDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => IceCandidateDto)
  candidate?: IceCandidateDto;
}
