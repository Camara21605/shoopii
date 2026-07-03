/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/produits/dto/create-product.dto.ts
 *
 * RÔLE    : Valide et type les données envoyées par AjouterPage.tsx
 *           lors de la création ou modification d'un produit.
 *
 * CORRESPONDANCE AVEC LE FRONTEND (AjouterPage.tsx) :
 *   form.nom              → nom
 *   form.description      → description
 *   form.prix             → prix
 *   form.prixAncien       → prixAncien
 *   form.stock            → stock
 *   form.seuil            → seuil
 *   form.categorie        → categorieNom  (le service résout l'UUID)
 *   form.sousCat          → sousCatNom
 *   form.marque           → marque
 *   form.tags             → tags
 *   form.visibilite       → visibilite
 *   form.reference        → reference
 *   form.garantie         → garantie
 *   form.poids            → poids
 *   form.condition        → condition
 *   form.titreSeo         → titreSeo       ①
 *   form.descriptionSeo   → descriptionSeo ①
 *   form.urlSlug          → urlSlug        ①
 *   form.longueur         → longueur       ②
 *   form.largeur          → largeur        ②
 *   form.hauteur          → hauteur        ②
 *   form.paysOrigine      → paysOrigine    ③
 *   form.politiqueRetour  → politiqueRetour④
 *   form.contenuBoite     → contenuBoite   ⑤
 *   specs[]               → specs          ⑥
 *   form.livraisonXxx     → livraison…     ⑦
 *   form.garantieXxx      → garantie…      ⑧
 *   form.langue           → langue         ⑩
 *   images[]              → images
 *   variantes[]           → variantes
 * ============================================================ */

// ✅ FIX 1 & 2 — Tous les imports regroupés en haut du fichier.
//               PartialType et IsPositive ne sont plus importés
//               en double ou au milieu du fichier.
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type }                                         from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'; // ✅ FIX 1 — PartialType importé ici, plus en bas
import {
  DeliveryDelay,
  ProductCondition,
  ProductVisibility,
  RetourPolicy,
} from 'src/database/entities/entreprise.table/product.entity';

// ─────────────────────────────────────────────────────────────
// SOUS-DTOs (caractéristiques, images, variantes)
// ─────────────────────────────────────────────────────────────

/**
 * ⑥ Ligne de caractéristique technique.
 * Correspond à une ligne du tableau specs[] dans AjouterPage.tsx.
 * Ex : { cle: "Puce / Processeur", valeur: "A17 Pro 3nm" }
 */
export class ProductSpecDto {
  @ApiProperty({ example: 'Puce / Processeur' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  cle: string;

  @ApiProperty({ example: 'A17 Pro (3 nm)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  valeur: string;

  /** Ordre d'affichage dans le tableau de caractéristiques */
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordre?: number;
}

/**
 * Variante produit.
 * Correspond à un élément de variantes[] dans AjouterPage.tsx.
 * Ex : { type: "Couleur", vals: "Noir, Blanc, Bleu Titanium" }
 */
export class ProductVariantDto {
  @ApiProperty({ example: 'Couleur', enum: ['Couleur','Stockage','RAM','Taille','Résolution','Matière'] })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiProperty({ example: 'Noir, Blanc, Bleu Titanium' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  vals: string;
}

/**
 * Image produit.
 * Dans AjouterPage.tsx les images sont des URLs (après upload Cloudinary).
 * Le frontend envoie les URLs résultant de l'upload.
 */
export class ProductImageDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/shopi/products/uuid/image-1.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url: string;

  /** 0 = image principale affichée en grand */
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordre?: number;

  /** Texte alt pour l'accessibilité et le SEO */
  @ApiPropertyOptional({ example: 'iPhone 15 Pro Titanium Noir de face' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt?: string;
}

/**
 * Palier de prix dégressif pour la vente en gros.
 * Ex : { quantiteMin: 10, quantiteMax: 49, prixUnitaire: 50000 }
 * quantiteMax absent/null = dernier palier ("et plus").
 */
export class ProductWholesaleTierDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1, { message: 'La quantité minimum doit être au moins 1.' })
  quantiteMin: number;

  @ApiPropertyOptional({ example: 49, description: 'Vide = palier final ("et plus")' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantiteMax?: number;

  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive({ message: 'Le prix unitaire doit être supérieur à 0.' })
  prixUnitaire: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  ordre?: number;
}

const JOURS_VALIDES = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'] as const;

/**
 * Une story liée à ce produit.
 * mediaUrl = URL Cloudinary d'une image déjà uploadée pour le produit.
 */
export class ProductStoryDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/shopi/…/image-1.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  mediaUrl: string;

  @ApiPropertyOptional({ example: 'Découvrez notre offre !', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;

  /** Heure de début d'affichage au format HH:MM (ex: "08:00") */
  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'heureDebut doit être au format HH:MM' })
  heureDebut?: string;

  /** Heure de fin d'affichage au format HH:MM (ex: "22:00") */
  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'heureFin doit être au format HH:MM' })
  heureFin?: string;

  /** Jours d'affichage (ex: ["lun","mar","mer","jeu","ven","sam","dim"]) */
  @ApiPropertyOptional({ example: ['lun','mar','mer','jeu','ven'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsIn(JOURS_VALIDES, { each: true, message: 'Chaque jour doit être parmi : lun, mar, mer, jeu, ven, sam, dim' })
  jours?: string[];
}

// ─────────────────────────────────────────────────────────────
// DTO PRINCIPAL
// ─────────────────────────────────────────────────────────────

export class CreateProductDto {

  // ── Informations de base ──────────────────────────────────────────────────

  @ApiProperty({ example: 'iPhone 15 Pro 256GB Titanium' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire.' })
  @MaxLength(255)
  nom: string;

  @ApiPropertyOptional({ example: 'Le smartphone le plus avancé d\'Apple…' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Contenu : iPhone 15 Pro, câble USB-C, documentation.' })
  @IsOptional()
  @IsString()
  contenuBoite?: string;   // ⑤

  @ApiPropertyOptional({ example: 'Apple' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marque?: string;

  @ApiPropertyOptional({ example: 'iphone,apple,smartphone,5g' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;

  @ApiPropertyOptional({ example: 'APPL-IP15P-256-TIT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  // ── Catégorisation ────────────────────────────────────────────────────────

  /**
   * UUID de la catégorie principale.
   * ✅ FIX 4 — Le frontend doit charger les catégories via GET /categories
   * au montage du composant AjouterPage.tsx et stocker les UUIDs dans
   * form.categorieId et form.sousCatId (et non les noms affichés).
   */
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID('all', { message: 'categoryId doit être un UUID valide.' })
categoryId: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID('all')
  subCategoryId?: string;

  // ── Prix & Stock ──────────────────────────────────────────────────────────

  /**
   * Prix de vente en GNF.
   * Le frontend envoie une string (form.prix) → transformée en number
   * par formToDto() dans produitsApiService.ts avant l'envoi.
   */
  @ApiProperty({ example: 15000000 })
  @IsNumber()
  @IsPositive({ message: 'Le prix doit être supérieur à 0.' })
  prix: number;

  /** Ancien prix barré — null si pas de promotion */
  @ApiPropertyOptional({ example: 17000000 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  prixAncien?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  /** Seuil d'alerte stock bas */
  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  seuil?: number;

  // ── Vente en gros ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  venteEnGros?: boolean;

  @ApiPropertyOptional({ example: 10, description: 'Quantité minimum de commande en gros' })
  @IsOptional()
  @IsInt()
  @Min(1)
  moq?: number;

  @ApiPropertyOptional({ example: 24, description: 'Unités par carton/colis' })
  @IsOptional()
  @IsInt()
  @Min(1)
  conditionnement?: number;

  @ApiPropertyOptional({ example: '3-5 jours' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  delaiPreparationGros?: string;

  @ApiPropertyOptional({ type: [ProductWholesaleTierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductWholesaleTierDto)
  wholesaleTiers?: ProductWholesaleTierDto[];

  // ── Classification ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: ProductVisibility, default: ProductVisibility.DRAFT })
  @IsOptional()
  @IsEnum(ProductVisibility)
  visibilite?: ProductVisibility;

  @ApiPropertyOptional({ enum: ProductCondition, default: ProductCondition.NEUF })
  @IsOptional()
  @IsEnum(ProductCondition)
  condition?: ProductCondition;

  @ApiPropertyOptional({ example: '12 mois' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  garantie?: string;

  /** ⑩ Langue de la fiche produit */
  @ApiPropertyOptional({ example: 'fr', enum: ['fr', 'en', 'ar'] })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  langue?: string;

  // ── ③ Origine & ② Dimensions ─────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'GN', description: 'Code ISO pays (GN, CN, FR…)' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  paysOrigine?: string;   // ③

  @ApiPropertyOptional({ example: 0.195, description: 'Poids en kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  poids?: number;

  @ApiPropertyOptional({ example: 14.67, description: 'Longueur en cm' })  // ②
  @IsOptional()
  @IsNumber()
  @Min(0)
  longueur?: number;

  @ApiPropertyOptional({ example: 7.12, description: 'Largeur en cm' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  largeur?: number;

  @ApiPropertyOptional({ example: 0.83, description: 'Hauteur en cm' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hauteur?: number;

  // ── ④ Politique de retour ─────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: RetourPolicy, default: RetourPolicy.SEVEN_DAYS })
  @IsOptional()
  @IsEnum(RetourPolicy)
  politiqueRetour?: RetourPolicy;

  // ── ⑦ Politique de livraison ─────────────────────────────────────────────

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  livraisonStandard?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  livraisonLivreur?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  livraisonCorrespondant?: boolean;

  @ApiPropertyOptional({ example: 50000, description: 'Frais de livraison locale en GNF (0 = gratuit)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fraisLivraisonLocal?: number;

  @ApiPropertyOptional({ enum: DeliveryDelay, default: DeliveryDelay.ONE_THREE })
  @IsOptional()
  @IsEnum(DeliveryDelay)
  delaiLivraison?: DeliveryDelay;

  // ── ⑧ Garanties affichées sur la fiche ───────────────────────────────────

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  garantiePaiement?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  garantieRetour?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  garantieAuthentic?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  garantieSupport?: boolean;

  // ── ① SEO ─────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'iPhone 15 Pro 256GB Titanium — Shopi Guinée', maxLength: 70 })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  titreSeo?: string;

  @ApiPropertyOptional({ example: 'Achetez l\'iPhone 15 Pro…', maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  descriptionSeo?: string;

  @ApiPropertyOptional({ example: 'iphone-15-pro-256gb' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  urlSlug?: string;

  // ── Relations (images, variantes, specs) ──────────────────────────────────

  /**
   * URLs des images après upload vers Cloudinary.
   * Tableau ordonné — index 0 = image principale.
   */
  @ApiPropertyOptional({ type: [ProductImageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images?: ProductImageDto[];

  /** ⑥ Caractéristiques techniques (tableau clé/valeur) */
  @ApiPropertyOptional({ type: [ProductSpecDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecDto)
  specs?: ProductSpecDto[];

  /** Variantes (Couleur, Stockage, RAM, Taille…) */
  @ApiPropertyOptional({ type: [ProductVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variantes?: ProductVariantDto[];

  /** Stories à publier pour ce produit (images déjà uploadées) */
  @ApiPropertyOptional({ type: [ProductStoryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductStoryDto)
  stories?: ProductStoryDto[];
}

// ─────────────────────────────────────────────────────────────
// DTO DE MISE À JOUR (tous les champs optionnels)
// ─────────────────────────────────────────────────────────────

/**
 * UpdateProductDto
 * ✅ FIX 1 — PartialType importé en haut du fichier, plus ici.
 * Hérite de CreateProductDto avec tous les champs optionnels.
 * Utilisé pour PATCH /produits/:id
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}

// ─────────────────────────────────────────────────────────────
// DTO DE FILTRAGE (GET /produits)
// ─────────────────────────────────────────────────────────────

export class FilterProductsDto {
  @ApiPropertyOptional({ enum: ProductVisibility })
  @IsOptional()
  @IsEnum(ProductVisibility)
  visibilite?: ProductVisibility;

  @ApiPropertyOptional({ description: 'UUID catégorie' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'UUID sous-catégorie' })
  @IsOptional()
  @IsUUID()
  subCategoryId?: string;

  @ApiPropertyOptional({ description: 'Recherche sur nom, marque, tags, référence' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()   // ✅ FIX 2 — IsPositive (pas IsPos), import unique en haut
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()   // ✅ FIX 2 — idem
  limit?: number = 20;

  // ✅ FIX 3 — Pour que @Type(() => Number) fonctionne, vérifier dans main.ts :
  //   app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
}