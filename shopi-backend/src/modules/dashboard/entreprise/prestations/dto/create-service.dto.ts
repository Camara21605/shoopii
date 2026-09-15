/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/prestations/dto/create-service.dto.ts
 *
 * RÔLE    : Valide et type les données envoyées par AjouterServicePage.tsx
 *           lors de la création ou modification d'une prestation de
 *           service. Miroir structurel de create-product.dto.ts, mais
 *           sans rien de spécifique aux biens physiques (stock,
 *           dimensions, livraison, vente en gros, variantes).
 * ============================================================ */

import {
  IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber,
  IsOptional, IsPositive, IsString, IsUUID, MaxLength, Min,
  ValidateIf, ValidateNested,
} from 'class-validator';
import { Type }                                         from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ServiceCancellationPolicy,
  ServicePricingType,
  ServiceResponseDelay,
  ServiceVisibility,
} from 'src/database/entities/entreprise.table/service.entity';

// ─────────────────────────────────────────────────────────────
// SOUS-DTOs (médias, specs)
// ─────────────────────────────────────────────────────────────

/** "Ce qui est inclus" / prérequis — ligne clé/valeur, miroir de ProductSpecDto. */
export class ServiceSpecDto {
  @ApiProperty({ example: 'Durée du rendez-vous' })
  @IsString() @IsNotEmpty() @MaxLength(150)
  cle: string;

  @ApiProperty({ example: '45 minutes' })
  @IsString() @IsNotEmpty() @MaxLength(500)
  valeur: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0)
  ordre?: number;
}

/** Média service — URL déjà uploadée vers Cloudinary, miroir de ProductImageDto. */
export class ServiceMediaDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/shopi/services/uuid/image-1.jpg' })
  @IsString() @IsNotEmpty() @MaxLength(500)
  url: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt() @Min(0)
  ordre?: number;

  @ApiPropertyOptional({ example: 'Salon de coiffure — intérieur' })
  @IsOptional() @IsString() @MaxLength(255)
  alt?: string;

  /** Max 5 images + 1 vidéo par service (voir PrestationsService). */
  @ApiPropertyOptional({ enum: ['image', 'video'], default: 'image' })
  @IsOptional() @IsIn(['image', 'video'])
  type?: 'image' | 'video';
}

// ─────────────────────────────────────────────────────────────
// DTO PRINCIPAL
// ─────────────────────────────────────────────────────────────

export class CreateServiceDto {

  // ── Informations de base ──────────────────────────────────────────────────

  @ApiProperty({ example: 'Coupe & Brushing' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la prestation est obligatoire.' })
  @MaxLength(255)
  nom: string;

  @ApiPropertyOptional({ example: 'Coupe personnalisée avec brushing inclus…' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'coiffure,coupe,brushing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;

  // ── Catégorisation ────────────────────────────────────────────────────────
  // La cohérence category.companyType.nature ∈ {services,neutral} est
  // vérifiée côté service (PrestationsService.create), pas ici.

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID('all', { message: 'categoryId doit être un UUID valide.' })
  categoryId: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID('all')
  subCategoryId?: string;

  // ── Tarification ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ServicePricingType, default: ServicePricingType.FIXE })
  @IsOptional()
  @IsEnum(ServicePricingType)
  pricingType?: ServicePricingType;

  /** Requis si pricingType ∈ {FIXE, HORAIRE} — voir PrestationsService.create
   *  pour la validation croisée exacte (class-validator seul ne peut pas
   *  exprimer "requis sauf si un autre champ vaut X" simplement ici). */
  @ApiPropertyOptional({ example: 150000, description: 'GNF — prix fixe ou tarif/heure selon pricingType' })
  @ValidateIf(o => o.pricingType !== ServicePricingType.DEVIS)
  @IsNumber()
  @IsPositive({ message: 'Le prix doit être supérieur à 0.' })
  prix?: number;

  @ApiPropertyOptional({ example: 180000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  prixAncien?: number;

  // ── Durée & capacité ───────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 30, description: 'Minutes' })
  @IsOptional() @IsInt() @Min(1)
  dureeMinMinutes?: number;

  @ApiPropertyOptional({ example: 60, description: 'Minutes' })
  @IsOptional() @IsInt() @Min(1)
  dureeMaxMinutes?: number;

  @ApiPropertyOptional({ example: 10, description: 'Nombre max de personnes par session' })
  @IsOptional() @IsInt() @Min(1)
  capaciteMax?: number;

  // ── Mode de prestation ─────────────────────────────────────────────────────

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  surPlaceEntreprise?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  aDomicile?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  aDistance?: boolean;

  @ApiPropertyOptional({ example: 'Kaloum, Dixinn, Ratoma' })
  @IsOptional() @IsString() @MaxLength(500)
  zoneCouverture?: string;

  @ApiPropertyOptional({ example: 20000, description: 'GNF (0 = gratuit)' })
  @IsOptional() @IsInt() @Min(0)
  fraisDeplacement?: number;

  // ── Réservation & annulation ───────────────────────────────────────────────

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  reservationRequise?: boolean;

  @ApiPropertyOptional({ enum: ServiceResponseDelay, default: ServiceResponseDelay.H24 })
  @IsOptional() @IsEnum(ServiceResponseDelay)
  delaiReponse?: ServiceResponseDelay;

  @ApiPropertyOptional({ enum: ServiceCancellationPolicy, default: ServiceCancellationPolicy.MODEREE })
  @IsOptional() @IsEnum(ServiceCancellationPolicy)
  politiqueAnnulation?: ServiceCancellationPolicy;

  // ── Garanties affichées sur la fiche ───────────────────────────────────────

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  garantiePaiement?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  garantieSatisfaction?: boolean;

  // ── Classification ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ServiceVisibility, default: ServiceVisibility.DRAFT })
  @IsOptional() @IsEnum(ServiceVisibility)
  visibilite?: ServiceVisibility;

  @ApiPropertyOptional({ example: 'fr', enum: ['fr', 'en', 'ar'] })
  @IsOptional() @IsString() @MaxLength(5)
  langue?: string;

  // ── SEO ────────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ maxLength: 70 })
  @IsOptional() @IsString() @MaxLength(70)
  titreSeo?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional() @IsString() @MaxLength(160)
  descriptionSeo?: string;

  @ApiPropertyOptional({ example: 'coupe-brushing-coiffeur-x' })
  @IsOptional() @IsString() @MaxLength(255)
  urlSlug?: string;

  // ── Relations (médias, specs) ───────────────────────────────────────────────

  @ApiPropertyOptional({ type: [ServiceMediaDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ServiceMediaDto)
  media?: ServiceMediaDto[];

  @ApiPropertyOptional({ type: [ServiceSpecDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ServiceSpecDto)
  specs?: ServiceSpecDto[];
}

// ─────────────────────────────────────────────────────────────
// DTO DE MISE À JOUR (tous les champs optionnels)
// ─────────────────────────────────────────────────────────────

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

// ─────────────────────────────────────────────────────────────
// DTO DE FILTRAGE (GET /prestations)
// ─────────────────────────────────────────────────────────────

export class FilterServicesDto {
  @ApiPropertyOptional({ enum: ServiceVisibility })
  @IsOptional() @IsEnum(ServiceVisibility)
  visibilite?: ServiceVisibility;

  @ApiPropertyOptional({ description: 'UUID catégorie' })
  @IsOptional() @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'UUID sous-catégorie' })
  @IsOptional() @IsUUID()
  subCategoryId?: string;

  @ApiPropertyOptional({ description: 'Recherche sur nom, tags' })
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive()
  limit?: number = 20;
}
