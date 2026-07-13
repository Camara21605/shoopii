import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { GroupMessageContentType } from '../../../database/entities/delivery-group/group-message.entity';

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
}
