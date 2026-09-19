/* ================================================================
 * FICHIER : src/modules/zone-admin/zone-admin.dto.ts
 * RÔLE    : DTO des préférences d'alertes de l'administrateur.
 *
 * Une seule préférence est réellement appliquée : `signalement`
 * (notifications de nouveaux signalements non critiques — les
 * signalements critiques sont toujours envoyés). Les autres clés de
 * l'ancien écran n'avaient aucun effet et sont refusées (whitelist).
 * ================================================================ */

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAlertPreferencesDto {
  @IsOptional() @IsBoolean() signalement?: boolean;
}
