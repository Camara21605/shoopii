/* ============================================================
 * FICHIER : src/modules/notifications/dto/update-preferences.dto.ts
 *
 * RÔLE : Body PATCH /notifications/preferences
 *
 * MERGE PARTIEL :
 *   Tous les champs sont optionnels (PATCH sémantique).
 *   NotificationPreferenceService fait un merge profond :
 *   seuls les champs envoyés sont modifiés.
 * ============================================================ */

import {
  IsBoolean, IsObject, IsOptional,
  IsString, Matches,
} from 'class-validator';
import type { NotificationChannelPreference } from 'src/database/entities/notification/notification-preference.entity';

/**
 * Préférence par canal pour un type de notification.
 * Identique à NotificationChannelPreference de l'entité.
 */
export class ChannelPreferenceDto {
  @IsBoolean() @IsOptional() in_app?: boolean;
  @IsBoolean() @IsOptional() push?:   boolean;
  @IsBoolean() @IsOptional() email?:  boolean;
  @IsBoolean() @IsOptional() sms?:    boolean;
}

export class UpdatePreferencesDto {

  // ── Switches globaux ──────────────────────────────────────

  @IsBoolean()
  @IsOptional()
  globalPushEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  globalEmailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  globalSmsEnabled?: boolean;

  // ── Mode Ne Pas Déranger ──────────────────────────────────

  @IsBoolean()
  @IsOptional()
  dndEnabled?: boolean;

  /**
   * Heure locale de début DND. Format "HH:MM".
   * Ex: "22:00"
   */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'dndStartTime doit être au format HH:MM' })
  @IsOptional()
  dndStartTime?: string;

  /**
   * Heure locale de fin DND. Format "HH:MM".
   * Ex: "08:00"
   */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'dndEndTime doit être au format HH:MM' })
  @IsOptional()
  dndEndTime?: string;

  /**
   * Fuseau horaire IANA.
   * Ex: "Africa/Conakry", "Europe/Paris", "America/New_York"
   */
  @IsString()
  @IsOptional()
  timezone?: string;

  // ── Préférences granulaires par type ─────────────────────

  /**
   * Carte des préférences par type de notification.
   *
   * Clé = valeur de NotificationType (ex: "order.confirmed")
   * Valeur = { in_app, push, email, sms }
   *
   * Seules les entrées envoyées sont mergées.
   * Les autres restent inchangées.
   */
  @IsObject()
  @IsOptional()
  preferences?: Record<string, Partial<NotificationChannelPreference>>;

  // ── Coordonnées alternatives ──────────────────────────────

  @IsString()
  @IsOptional()
  notificationEmail?: string;

  /**
   * Format E.164 : "+224622345678"
   */
  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'phoneUsed doit être au format E.164 (+XXXXXXXXXX)' })
  @IsOptional()
  notificationPhone?: string;
}
