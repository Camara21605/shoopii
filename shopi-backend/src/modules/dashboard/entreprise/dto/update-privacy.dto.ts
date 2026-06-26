/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-privacy.dto.ts
 * Section 11 — Confidentialité (7 toggles)
 * ============================================================ */

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePrivacyDto {

  @IsOptional() @IsBoolean() showInSearch?: boolean;
  @IsOptional() @IsBoolean() showSalesStats?: boolean;
  @IsOptional() @IsBoolean() allowFollow?: boolean;
  @IsOptional() @IsBoolean() shareExactLocation?: boolean;
  @IsOptional() @IsBoolean() improveAlgorithm?: boolean;
  @IsOptional() @IsBoolean() anonymizedStats?: boolean;
  @IsOptional() @IsBoolean() advancedReports?: boolean;
}
