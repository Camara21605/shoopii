/* ============================================================
 * FICHIER : src/modules/notifications/dto/mark-read-by-types.dto.ts
 * RÔLE    : Body PATCH /notifications/read-by-types — voir
 *           NotificationService.markAsReadByTypes().
 * ============================================================ */

import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';
import { NotificationType } from 'src/database/entities/notification/notification.entitiy';

export class MarkReadByTypesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationType, { each: true })
  types: NotificationType[];
}
