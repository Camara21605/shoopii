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

/* ── Journal d'audit ─────────────────────────────────────────── */

export interface GeoAuditListParams {
  action?: string;
  niveau?: string;
  search?: string;
}

export interface GeoAuditEntryResponse {
  id:       string;
  action:   string;
  niveau:   string;
  itemNom:  string;
  itemCode: string;
  auteur:   string;
  quand:    string;
  details:  string;
}

/* ── Import massif ───────────────────────────────────────────── */

export class GeoImportRowDto {
  @IsString() code: string;
  @IsString() nom: string;
  @IsOptional() @IsString() description?: string;

  /* Codes parent selon le niveau ciblé (voir IMPORT_PARENT_COLUMNS) */
  @IsOptional() @IsString() paysCode?: string;
  @IsOptional() @IsString() regionCode?: string;
  @IsOptional() @IsString() prefectureCode?: string;
  @IsOptional() @IsString() communeCode?: string;

  @IsOptional() @IsString() iso2?: string;
  @IsOptional() @IsString() iso3?: string;
  @IsOptional() @IsString() indicatif?: string;
  @IsOptional() @IsString() devise?: string;
  @IsOptional() @IsString() chef_lieu?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsNumber() population?: number;
  @IsOptional() @IsNumber() rayonKm?: number;
  @IsOptional() @IsNumber() fraisLivraison?: number;
  @IsOptional() @IsNumber() tempsEstime?: number;
}

export class GeoImportDto {
  @IsArray()
  rows: GeoImportRowDto[];
}

export interface GeoImportResultResponse {
  total:   number;
  created: number;
  updated: number;
  skipped: number;
  errors:  { ligne: number; message: string }[];
}
