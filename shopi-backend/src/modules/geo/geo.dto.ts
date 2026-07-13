/* ================================================================
 * FICHIER : src/modules/geo/geo.dto.ts
 *
 * DTO unique pour créer / modifier n'importe quel niveau géo.
 * Les champs sont optionnels ; le service prend ce qu'il faut
 * selon le niveau visé.
 * ================================================================ */

import { IsString, IsOptional, IsEnum, IsArray, IsNumber, MinLength } from 'class-validator';

export class CreateGeoItemDto {
  @IsString()
  @MinLength(1)
  nom: string;

  @IsString()
  @MinLength(1)
  code: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['actif', 'inactif'])
  statut?: 'actif' | 'inactif';

  @IsOptional() @IsString()
  parentId?: string;

  @IsOptional() @IsString()
  auteur?: string;

  /* Pays */
  @IsOptional() @IsString() iso2?: string;      /* alias de code pour les pays — accepté mais code fait autorité */
  @IsOptional() @IsString() iso3?: string;
  @IsOptional() @IsString() indicatif?: string;
  @IsOptional() @IsString() devise?: string;

  /* Region / Prefecture */
  @IsOptional() @IsString() chef_lieu?: string;

  /* Commune */
  @IsOptional()
  @IsEnum(['urbaine', 'semi-urbaine', 'rurale'])
  type?: 'urbaine' | 'semi-urbaine' | 'rurale';

  /* Quartier */
  @IsOptional() @IsNumber() population?: number;

  /* Zone */
  @IsOptional()
  @IsEnum(['pays', 'region', 'prefecture', 'commune', 'quartier'])
  couvertureType?: 'pays' | 'region' | 'prefecture' | 'commune' | 'quartier';

  @IsOptional()
  @IsArray()
  couvertureIds?: string[];

  @IsOptional() @IsNumber() rayonKm?: number;
  @IsOptional() @IsNumber() fraisLivraison?: number;
  @IsOptional() @IsNumber() tempsEstime?: number;
  @IsOptional() @IsNumber() acteursCover?: number;
}

export class UpdateGeoItemDto extends CreateGeoItemDto {}

/* Forme de la réponse renvoyée au frontend */
export interface GeoItemResponse {
  id:          string;
  code:        string;
  nom:         string;
  description: string;
  statut:      'actif' | 'inactif';
  parentId:    string | null;
  auteur:      string;
  createdAt:   string;
  updatedAt:   string;
  enfants:     number;
  /* Champs extra selon le niveau */
  [key: string]: unknown;
}

export interface GeoAllResponse {
  pays:        GeoItemResponse[];
  regions:     GeoItemResponse[];
  prefectures: GeoItemResponse[];
  communes:    GeoItemResponse[];
  quartiers:   GeoItemResponse[];
  zones:       GeoItemResponse[];
}

export interface GeoListParams {
  search?: string;
  statut?: 'actif' | 'inactif';
}
