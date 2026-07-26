/* ============================================================
 * FICHIER      : src/modules/company-team/dto/permission-template.dto.ts
 * MODULE       : Company Team
 * ROLE         : DTOs pour la gestion des modèles de permissions.
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  IsString, IsOptional, IsObject, MaxLength,
} from 'class-validator';

/** Créer un modèle de permissions personnalisé */
export class CreatePermissionTemplateDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  permissions!: Record<string, Record<string, boolean>>;
}

/** Mettre à jour un modèle de permissions */
export class UpdatePermissionTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, Record<string, boolean>>;
}
