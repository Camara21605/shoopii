/* ============================================================
 * FICHIER : src/modules/notifications/dto/list-notifications.query.dto.ts
 *
 * RÔLE : Query params pour GET /notifications
 *
 * PAGINATION CURSOR-BASED :
 *   On utilise cursor (createdAt ISO) plutôt que page/offset.
 *   Raison : si une nouvelle notification arrive pendant la
 *   pagination, elle ne déplace pas les résultats existants.
 *
 *   Usage :
 *     GET /notifications?limit=20
 *     → retourne les 20 plus récentes + nextCursor
 *     GET /notifications?limit=20&cursor=2025-01-15T14:32:00.000Z
 *     → retourne les 20 suivantes à partir du cursor
 * ============================================================ */

import {
  IsBoolean, IsDateString, IsEnum, IsInt,
  IsOptional, IsString, Max, Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { NotificationType } from 'src/database/entities/notification/notification.entitiy';

export class ListNotificationsQueryDto {

  /**
   * Nombre de notifications par page.
   * Défaut : 20 · Max : 50 (évite les payloads trop lourds).
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;

  /**
   * Cursor de pagination (ISO 8601 de la dernière createdAt reçue).
   * Absence = première page.
   */
  @IsDateString()
  @IsOptional()
  cursor?: string;

  /**
   * Filtrer uniquement les notifications non lues.
   * Utile pour le badge "Voir tout" dans le dropdown.
   */
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;

  /**
   * Filtrer par type de notification.
   * Ex: ?type=order.confirmed pour ne voir que les commandes.
   */
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  /**
   * Terme de recherche dans title et body.
   * Recherche simple ILIKE (pas de full-text search).
   */
  @IsString()
  @IsOptional()
  search?: string;
}
