/* ============================================================
 * FICHIER : src/modules/commande/dto/create-commande.dto.ts
 * RÔLE    : Création d'une commande depuis le panier du client.
 * ============================================================ */

import { Type } from 'class-transformer';
import {
  IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested,
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
}
