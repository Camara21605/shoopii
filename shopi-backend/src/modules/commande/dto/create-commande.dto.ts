/* ============================================================
 * FICHIER : src/modules/commande/dto/create-commande.dto.ts
 * RÔLE    : Création d'une commande depuis le panier du client.
 * ============================================================ */

import { Type } from 'class-transformer';
import {
  IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CommandeItemRefDto {
  @IsUUID('all')
  panierItemId: string;
}

export class CreateCommandeDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommandeItemRefDto)
  items?: CommandeItemRefDto[];

  @IsIn(['std', 'lvr'])
  delMode: 'std' | 'lvr';

  @IsOptional()
  @IsUUID('all')
  livreurId?: string;

  @IsOptional()
  @IsUUID('all')
  correspondantId?: string;

  @IsOptional()
  @IsString()
  payMode?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  // ── Adresse de livraison complète ──────────────────────────
  @IsOptional()
  @IsString()
  prenomLivraison?: string;

  @IsOptional()
  @IsString()
  nomLivraison?: string;

  @IsOptional()
  @IsString()
  telephoneLivraison?: string;

  @IsOptional()
  @IsString()
  villeLivraison?: string;

  @IsOptional()
  @IsString()
  communeLivraison?: string;

  @IsOptional()
  @IsString()
  adressePrecise?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  quartierLivraison?: string;

  /** Adresse enregistrée choisie : le serveur en reprend lui-même ville,
   *  commune, quartier, repère et position GPS (données de confiance). */
  @IsOptional()
  @IsUUID('all')
  adresseId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90) @Max(90)
  latitudeLivraison?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180) @Max(180)
  longitudeLivraison?: number;
}
