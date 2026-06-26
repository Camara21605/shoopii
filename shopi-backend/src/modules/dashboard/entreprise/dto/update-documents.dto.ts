/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/dto/update-documents.dto.ts
 * Section 8 — Documents & Vérification
 * (les uploads passent par MultipartFormData + UploadService)
 * ============================================================ */

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDocumentsDto {

  /** URL Cloudinary après upload — renseignée par le service */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ownerIdDocument?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentRccm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentBancaire?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentPhoto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  documentNif?: string;
}
