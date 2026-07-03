/* ============================================================
 * FICHIER : src/modules/notifications/dto/create-notification.dto.ts
 *
 * RÔLE : DTO HTTP pour l'endpoint POST /notifications (admin).
 *
 * DIFFÉRENCE AVEC ICreateNotificationPayload :
 *   → ICreateNotificationPayload = payload INTERNE (services, events)
 *   → CreateNotificationDto      = payload EXTERNE (HTTP body admin)
 *
 * Usage principal : envoi d'annonces système par l'admin.
 *   Ex: "Maintenance planifiée ce soir 22h–23h"
 *       → type: SYSTEM_ANNOUNCEMENT, recipientType: null (broadcast)
 * ============================================================ */

import {
  IsEnum, IsNotEmpty, IsOptional, IsString,
  IsUUID, MaxLength, IsDateString, IsUrl,
} from 'class-validator';
import {
  NotificationActorType,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from 'src/database/entities/notification/notification.entitiy';

export class CreateNotificationDto {

  // ── Destinataire ──────────────────────────────────────────

  @IsEnum(NotificationActorType)
  @IsNotEmpty()
  recipientType: NotificationActorType;

  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  // ── Type & priorité ───────────────────────────────────────

  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  // ── Contenu ───────────────────────────────────────────────

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  body: string;

  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  actionUrl?: string;

  // ── Agrégation & expiration ───────────────────────────────

  @IsString()
  @IsOptional()
  @MaxLength(100)
  groupKey?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  // ── Canal forcé ───────────────────────────────────────────

  @IsEnum(NotificationChannel)
  @IsOptional()
  forceChannel?: NotificationChannel;
}
