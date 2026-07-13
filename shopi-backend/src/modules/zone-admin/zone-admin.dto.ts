/* ================================================================
 * FICHIER : src/modules/zone-admin/zone-admin.dto.ts
 * RÔLE    : DTOs du module Zone Admin (préférences d'alertes).
 * ================================================================ */

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAlertPreferencesDto {
  @IsOptional() @IsBoolean() grave?: boolean;
  @IsOptional() @IsBoolean() validation?: boolean;
  @IsOptional() @IsBoolean() litige?: boolean;
  @IsOptional() @IsBoolean() nouvelleEntreprise?: boolean;
  @IsOptional() @IsBoolean() nouveauPartenaire?: boolean;
  @IsOptional() @IsBoolean() nouveauLivreur?: boolean;
  @IsOptional() @IsBoolean() commandeImportante?: boolean;
  @IsOptional() @IsBoolean() hausseInhabituelle?: boolean;
  @IsOptional() @IsBoolean() baisseVentes?: boolean;
  @IsOptional() @IsBoolean() signalementCritique?: boolean;
  @IsOptional() @IsBoolean() paiementEchoue?: boolean;
  @IsOptional() @IsBoolean() livreurInactif?: boolean;
  @IsOptional() @IsBoolean() tentativeFraude?: boolean;
}
