import {
  ArrayMaxSize, ArrayMinSize, IsBoolean, IsEnum, IsIn, IsOptional,
  IsString, IsUUID, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroupMessageContentType } from '../../../database/entities/delivery-group/group-message.entity';
import { ConversationActorType } from '../../../database/entities/messaging/conversation.entity';

// ── Créer un groupe libre (⋮ > Paramètres > Ajouter un groupe) ───

export class CustomGroupMemberRefDto {
  @IsEnum(ConversationActorType)
  type: ConversationActorType;

  @IsUUID()
  id: string;
}

export class CreateCustomGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /* Au moins 1 autre membre en plus du créateur (un "groupe" à 2
   * personnes reste un groupe), max 49 + le créateur = 50. */
  @ValidateNested({ each: true })
  @Type(() => CustomGroupMemberRefDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(49)
  members: CustomGroupMemberRefDto[];
}

export class SendGroupMessageDto {
  @IsEnum(GroupMessageContentType)
  contentType: GroupMessageContentType;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mediaName?: string;

  @IsOptional()
  mediaSize?: number;

  @IsOptional()
  @IsString()
  mediaMimeType?: string;

  @IsOptional()
  mediaDuration?: number;

  @IsOptional()
  @IsString()
  replyToId?: string;
}

export class EditGroupMessageDto {
  @IsString()
  @MaxLength(5000)
  content: string;
}

export class DeleteGroupMessageDto {
  @IsIn(['me', 'everyone'])
  mode: 'me' | 'everyone';
}

export class ToggleGroupReactionDto {
  @IsString()
  @MaxLength(10)
  emoji: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** URL Cloudinary (dossier avatars, voir POST /upload/avatar) — chaîne
   *  vide acceptée pour retirer la photo (voir DeliveryGroupService.updateGroupInfo). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}

// ── Gestion des administrateurs (groupe libre uniquement) ───────

export class SetMemberAdminDto {
  @IsBoolean()
  isAdmin: boolean;
}
