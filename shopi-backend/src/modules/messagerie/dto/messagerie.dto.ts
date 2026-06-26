import {
  IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min,
} from 'class-validator';
import { ConversationActorType } from 'src/database/entities/messaging/conversation.entity';
import { MessageContentType }    from 'src/database/entities/messaging/message.entity';

export class StartConversationDto {
  @IsEnum(ConversationActorType)
  targetType: ConversationActorType;

  @IsUUID()
  targetId: string;
}

export class SendMessageDto {
  /** Texte du message (obligatoire pour TEXT, optionnel pour médias) */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsEnum(MessageContentType)
  contentType?: MessageContentType;

  /** URL Cloudinary du média uploadé (IMAGE / VIDEO / FILE) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mediaUrl?: string;

  /** Nom original du fichier (pour les documents) */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mediaName?: string;

  /** Taille en octets */
  @IsOptional()
  @IsNumber()
  @Min(0)
  mediaSize?: number;

  /** Type MIME (image/jpeg, video/mp4, application/pdf…) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mediaMimeType?: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
