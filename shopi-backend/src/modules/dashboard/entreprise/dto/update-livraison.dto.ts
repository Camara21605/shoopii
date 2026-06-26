/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-livraison.dto.ts
 * Section 5 — Livraison (méthodes + zones)
 * ============================================================ */

import { IsBoolean, IsOptional, IsArray, IsString } from 'class-validator';

export class UpdateLivraisonDto {

  @IsOptional()
  @IsBoolean()
  livraisonStandard?: boolean;

  @IsOptional()
  @IsBoolean()
  livraisonShopi?: boolean;

  @IsOptional()
  @IsBoolean()
  livraisonCorresp?: boolean;

  @IsOptional()
  @IsBoolean()
  clickCollect?: boolean;

  @IsOptional()
  @IsBoolean()
  livraisonExpress?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  zonesLivraison?: string[];
}
