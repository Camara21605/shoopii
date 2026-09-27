/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-privacy.dto.ts
 * Section 11 — Confidentialité : les 3 réglages réellement appliqués
 * (voir PrivacyParametresService). Toute autre clé est rejetée
 * (whitelist du ValidationPipe).
 * ============================================================ */

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacyDto {
  /** Apparaître dans la recherche (recherche par nom + carte) */
  @IsOptional() @IsBoolean() showInSearch?: boolean;
  /** Afficher le nombre de ventes sur la page boutique publique */
  @IsOptional() @IsBoolean() showSalesStats?: boolean;
  /** Accepter de nouveaux abonnés */
  @IsOptional() @IsBoolean() allowFollow?: boolean;
}
