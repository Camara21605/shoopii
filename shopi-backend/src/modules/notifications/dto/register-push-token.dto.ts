/* ============================================================
 * FICHIER : src/modules/notifications/dto/register-push-token.dto.ts
 *
 * RÔLE : Body POST /notifications/push-token
 *
 * APPELÉ PAR :
 *   - L'app mobile au démarrage (FCM token refresh)
 *   - L'app web lors de l'activation des notifications browser
 *
 * COMPORTEMENT (dans NotificationPreferenceService) :
 *   - Si deviceId existe déjà → mise à jour du token
 *   - Sinon → ajout dans le tableau pushTokens
 *   - Nettoyage des tokens > 90 jours (CRON scheduler)
 * ============================================================ */

import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Plateforme de l'appareil envoyant le token */
export enum PushTokenPlatform {
  ANDROID = 'android',
  IOS     = 'ios',
  WEB     = 'web',
}

export class RegisterPushTokenDto {

  /**
   * Token FCM (Android/Web) ou APNs (iOS).
   * Généré par Firebase SDK ou Service Worker.
   */
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(PushTokenPlatform)
  @IsNotEmpty()
  platform: PushTokenPlatform;

  /**
   * Identifiant unique de l'appareil.
   * Permet de remplacer un ancien token pour le même appareil.
   * Ex: UUID généré une fois par l'app à l'installation.
   */
  @IsString()
  @IsOptional()
  deviceId?: string;
}
