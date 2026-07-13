/* ============================================================
 * FICHIER            : src/modules/help/dto/help.dto.ts
 * RÔLE               : Data Transfer Objects du Centre d'aide.
 * RESPONSABILITES    : Valider toutes les entrées des endpoints help
 *                      (création/mise à jour de catégories, articles,
 *                       FAQ, feedback, recherche plein-texte).
 * DEPENDANCES        : class-validator, class-transformer, entité help-article
 * AUTEUR             : Shopi03
 * DERNIERE MISE A JOUR: 2026-07-03
 *
 * SECURITE :
 *   SearchHelpDto.q exige au minimum 2 caractères afin d'éviter
 *   les scans full-table déclenchés par une recherche vide.
 *   Les champs limit sont bornés à 50 via @Max.
 * ============================================================ */
import {
  IsString, IsOptional, IsBoolean, IsInt, IsUUID, IsEnum,
  MaxLength, MinLength, IsArray, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HelpArticleStatus } from '../../../database/entities/help/help-article.entity';

/* ── Catégories ── */

export class CreateHelpCategoryDto {
  @IsString() @MinLength(2) @MaxLength(100)
  slug: string;

  @IsString() @MinLength(2) @MaxLength(255)
  name: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  icon?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  displayOrder?: number;

  @IsOptional() @IsArray()
  audience?: string[];
}

export class UpdateHelpCategoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255)
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(100)
  icon?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  displayOrder?: number;

  @IsOptional() @IsArray()
  audience?: string[];

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

/* ── Articles ── */

export class CreateHelpArticleDto {
  @IsString() @MinLength(3) @MaxLength(200)
  slug: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsString() @MinLength(5) @MaxLength(500)
  title: string;

  @IsOptional() @IsString() @MaxLength(500)
  excerpt?: string;

  @IsString() @MinLength(10)
  content: string;

  @IsOptional() @IsArray()
  audience?: string[];
}

export class UpdateHelpArticleDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200)
  slug?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsString() @MinLength(5) @MaxLength(500)
  title?: string;

  @IsOptional() @IsString() @MaxLength(500)
  excerpt?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsArray()
  audience?: string[];
}

/* ── Feedback article ── */

export class ArticleFeedbackDto {
  @IsBoolean()
  helpful: boolean;
}

/* ── Recherche ── */

export class SearchHelpDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(300)
  q?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsString()
  audience?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number;
}

/* ── FAQ ── */

export class CreateFaqItemDto {
  @IsString() @MinLength(2) @MaxLength(100)
  categorySlug: string;

  @IsString() @MinLength(5) @MaxLength(500)
  question: string;

  @IsString() @MinLength(5)
  answer: string;

  @IsOptional() @IsArray()
  audience?: string[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  displayOrder?: number;

  @IsOptional() @IsUUID()
  relatedArticleId?: string;
}

export class UpdateFaqItemDto {
  @IsOptional() @IsString() @MaxLength(100)
  categorySlug?: string;

  @IsOptional() @IsString() @MaxLength(500)
  question?: string;

  @IsOptional() @IsString()
  answer?: string;

  @IsOptional() @IsArray()
  audience?: string[];

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  displayOrder?: number;

  @IsOptional() @IsBoolean()
  isPublished?: boolean;

  @IsOptional() @IsUUID()
  relatedArticleId?: string;
}
