/* ============================================================
 * FICHIER : messagerie.dto.ts
 * DTOs complets — version étendue avec edit, delete, reactions.
 * ============================================================ */

import {
  IsEnum, IsNumber, IsOptional, IsString,
  IsUUID, MaxLength, Min, IsBoolean, IsNotEmpty,
  Length,
} from 'class-validator';
import { ConversationActorType } from 'src/database/entities/messaging/conversation.entity';
import { MessageContentType }    from 'src/database/entities/messaging/message.entity';

// ── Créer/récupérer une conversation ─────────────────────────

export class StartConversationDto {
  @IsEnum(ConversationActorType)
  targetType: ConversationActorType;

  @IsUUID()
  targetId: string;
}

// ── Envoyer un message ────────────────────────────────────────

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsEnum(MessageContentType)
  contentType?: MessageContentType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mediaName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mediaSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mediaMimeType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mediaDuration?: number;

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

// ── Modifier un message ───────────────────────────────────────

export class EditMessageDto {
  /** Nouveau contenu (texte uniquement — les médias ne peuvent pas être modifiés) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}

// ── Supprimer un message ──────────────────────────────────────

export class DeleteMessageDto {
  /**
   * true  → supprime pour tout le monde (seulement si l'expéditeur supprime)
   * false → supprime uniquement pour soi (soft hide côté client)
   */
  @IsOptional()
  @IsBoolean()
  forEveryone?: boolean;
}

// ── Réaction emoji ────────────────────────────────────────────

export class ToggleReactionDto {
  /**
   * L'emoji de réaction.
   * Limité à 1-2 caractères (emoji unicode, pas de séquences longues).
   * Exemples valides : "❤️", "👍", "😂", "🔥"
   */
  @IsString()
  @IsNotEmpty()
  @Length(1, 8)  // Les emojis composites (families) peuvent faire > 2 chars
  emoji: string;
}

// ── Épingler un message ───────────────────────────────────────

export class PinMessageDto {
  @IsBoolean()
  pinned: boolean;
}

// ── Marquer lu ────────────────────────────────────────────────

export class MarkReadDto {
  /** Si fourni, marque uniquement jusqu'à ce messageId */
  @IsOptional()
  @IsUUID()
  upToMessageId?: string;
}

// ── Archiver une conversation ─────────────────────────────────

export class ArchiveConversationDto {
  @IsBoolean()
  archived: boolean;
}
