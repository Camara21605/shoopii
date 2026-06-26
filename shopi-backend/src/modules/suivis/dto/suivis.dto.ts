/* ============================================================
 * FICHIER : src/modules/suivis/dto/suivis.dto.ts
 *
 * DTOs de validation pour tous les endpoints de suivi.
 * ============================================================ */

import { IsBoolean, IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO pour activer/désactiver les notifications d'un suivi.
 * PATCH /suivis/correspondants/:id/notifications
 */
export class UpdateFollowNotifDto {
  @IsBoolean()
  notificationsEnabled: boolean;
}

/**
 * DTO de pagination pour les listes (followers, suivis).
 */
export class PaginationDto {

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

/**
 * Réponse standard d'une action de suivi/désabonnement.
 * Retournée immédiatement par l'API.
 */
export interface FollowResponse {
  /** true = suivi, false = désabonné */
  isSuivi:        boolean;
  /** Nouveau total de followers de la cible */
  followersCount: number;
  /** Message lisible par le frontend pour le toast */
  message:        string;
}

/**
 * Payload émis via WebSocket lors d'un nouveau suivi.
 * Reçu par la cible en temps réel.
 */
export interface WsNewFollowerPayload {
  event:          'new-follower';
  followerId:     string;
  followerType:   string;
  followerName:   string;
  followerPhoto:  string | null;
  followersCount: number;
  timestamp:      string;
}

/**
 * Payload émis via WebSocket lors d'un désabonnement.
 */
export interface WsUnfollowedPayload {
  event:          'unfollowed';
  followerId:     string;
  followerType:   string;
  followerName:   string;
  followersCount: number;
  timestamp:      string;
}