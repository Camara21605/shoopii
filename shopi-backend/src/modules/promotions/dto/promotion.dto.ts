/* ============================================================
 * FICHIER : src/modules/promotions/dto/promotion.dto.ts
 *
 * RÔLE    : Validation et typage de toutes les données
 *           envoyées par le frontend (PromotionsPage.tsx)
 *           pour créer, modifier et valider les promotions.
 *
 * ─── DTOs EXPORTÉS ───────────────────────────────────────────
 *
 *  CreatePromotionDto   → POST /promotions
 *  UpdatePromotionDto   → PATCH /promotions/:id
 *  ValidateCodeDto      → POST /promotions/validate-code
 *  FilterPromotionsDto  → GET /promotions
 *
 * ─── CORRESPONDANCE AVEC PromotionsPage.tsx ──────────────────
 *
 *  nom        → champ "Nom de la promotion"
 *  code       → champ "Code promo" (auto-uppercase)
 *  type       → sélecteur de type (discount/free-ship/bundle/flash)
 *  scope      → "Toute l'entreprise" | "Produit(s) spécifique(s)"
 *  productIds → liste d'IDs si scope = products
 *  valeur     → champ "Valeur de la réduction" (% ou GNF)
 *  maxUtilisations → champ "Utilisations maximum"
 *  endDate    → champ "Date d'expiration"
 *
 * ============================================================ */

import {
  IsString, IsNotEmpty, IsEnum, IsOptional,
  IsNumber, IsInt, IsArray, IsUUID,
  IsPositive, Min, MaxLength, IsDateString,
} from 'class-validator';
import { Type }         from 'class-transformer';
import { PartialType }  from '@nestjs/swagger';
import {
  PromoType,
  PromoScope,
  PromoValueType,
  PromoStatus,
} from 'src/database/entities/entreprise.table/promotion.entity';

// ─────────────────────────────────────────────────────────────
// DTO DE CRÉATION — POST /promotions
// ─────────────────────────────────────────────────────────────

export class CreatePromotionDto {

  // ── Informations de base ──────────────────────────────────────────────────

  /**
   * Nom interne de la promotion.
   * Ex: "Soldes Janvier 2025", "Flash iPhone Week-end"
   * Visible seulement dans le dashboard entreprise.
   */
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la promotion est obligatoire.' })
  @MaxLength(255)
  nom: string;

  /**
   * Code promo saisi par le client au checkout.
   * Ex: SOLDES20, NOEL10, FLASHGAMING
   *
   * Toujours converti en MAJUSCULES côté service.
   * UNIQUE par entreprise — deux entreprises peuvent avoir le même code.
   */
  @IsString()
  @IsNotEmpty({ message: 'Le code promo est obligatoire.' })
  @MaxLength(50)
  code: string;

  /**
   * Type de promotion — correspond aux 4 boutons dans PromotionsPage.tsx.
   *
   * discount   → réduction en % ou montant fixe
   * free-ship  → livraison gratuite
   * bundle     → lot (ex: 2 achetés = 1 offert)
   * flash      → vente flash avec stock limité
   */
  @IsEnum(PromoType, { message: 'Type invalide. Valeurs : discount, free-ship, bundle, flash' })
  type: PromoType;

  /**
   * Portée de la promo — correspond au sélecteur de scope de PromotionsPage.tsx.
   *
   * global   → s'applique à TOUS les produits de l'entreprise
   * products → s'applique SEULEMENT aux produits listés dans productIds
   *
   * Par défaut : global
   */
  @IsOptional()
  @IsEnum(PromoScope)
  scope?: PromoScope;

  /**
   * Type de valeur de la réduction.
   *
   * percent → % (ex: 20 = -20%)
   * fixed   → montant fixe en GNF (ex: 5000 = -5 000 GNF)
   * free    → livraison gratuite (valeur ignorée)
   *
   * Par défaut : percent
   */
  @IsOptional()
  @IsEnum(PromoValueType)
  valueType?: PromoValueType;

  /**
   * Valeur de la réduction.
   * Si valueType = percent → ex: 20 (= -20%)
   * Si valueType = fixed   → ex: 5000 (= -5 000 GNF)
   * Si valueType = free    → ignoré
   * null si type = free-ship sans valeur.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  valeur?: number;

  // ── Portée produits ───────────────────────────────────────────────────────

  /**
   * UUIDs des produits ciblés par cette promotion.
   * OBLIGATOIRE si scope = products.
   * Ignoré si scope = global.
   *
   * Côté service : on vérifie que chaque produit appartient
   * bien à l'entreprise qui crée la promo.
   */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true, message: 'Chaque productId doit être un UUID valide.' })
  productIds?: string[];

  // ── Limites ───────────────────────────────────────────────────────────────

  /**
   * Montant minimum du panier pour bénéficier de la promo.
   * Ex: 50000 → la promo s'active si le panier > 50 000 GNF.
   * null = pas de minimum.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantMinimum?: number;

  /**
   * Plafond de réduction en GNF (uniquement pour percent).
   * Ex: si valeur = 30% et plafond = 10000 → réduction max = 10 000 GNF.
   * null = pas de plafond.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  plafondReduction?: number;

  /**
   * Nombre maximum d'utilisations totales (tous clients confondus).
   * Correspond au champ "Utilisations maximum" dans PromotionsPage.tsx.
   * null = illimité.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxUtilisations?: number;

  /**
   * Nombre maximum d'utilisations par client.
   * Défaut : 1 (chaque client ne peut l'utiliser qu'une fois).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  maxParClient?: number;

  // ── Dates ─────────────────────────────────────────────────────────────────

  /**
   * Date de début de validité (ISO 8601).
   * null = applicable immédiatement dès activation.
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * Date d'expiration (ISO 8601).
   * Correspond au champ "Date d'expiration" dans PromotionsPage.tsx.
   * null = pas de date limite.
   */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  // ── Champs spécifiques FLASH ──────────────────────────────────────────────

  /**
   * Stock dédié à la vente flash.
   * Uniquement pertinent si type = flash.
   * null = pas de stock dédié (utilise le stock des produits).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  flashStock?: number;

  // ── Champs spécifiques BUNDLE ─────────────────────────────────────────────

  /**
   * Quantité minimale d'achat pour déclencher le bundle.
   * Ex: 2 → acheter 2 pour obtenir 1 offert.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  bundleQuantiteMin?: number;

  /**
   * Quantité offerte dans le bundle.
   * Ex: 1 → pour 2 achetés, 1 est offert.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  bundleQuantiteOfferte?: number;

  // ── Champs spécifiques FREE_SHIP ──────────────────────────────────────────

  /**
   * Montant minimum pour bénéficier de la livraison gratuite.
   * Ex: 100000 → livraison offerte si commande > 100 000 GNF.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeShipSeuil?: number;

  // ── Description interne ───────────────────────────────────────────────────

  /**
   * Description interne visible uniquement dans le dashboard entreprise.
   * Ex: "Promo pour le lancement de la nouvelle collection"
   */
  @IsOptional()
  @IsString()
  description?: string;
}

// ─────────────────────────────────────────────────────────────
// DTO DE MISE À JOUR — PATCH /promotions/:id
// Tous les champs de CreatePromotionDto deviennent optionnels.
// ─────────────────────────────────────────────────────────────

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {}

// ─────────────────────────────────────────────────────────────
// DTO DE VALIDATION DE CODE — POST /promotions/validate-code
// Appelé au checkout quand le client saisit un code promo.
// ─────────────────────────────────────────────────────────────

export class ValidateCodeDto {

  /**
   * Code promo saisi par le client.
   * Le service le convertit en majuscules avant la recherche.
   */
  @IsString()
  @IsNotEmpty({ message: 'Le code promo est obligatoire.' })
  code: string;

  /**
   * UUID de l'entreprise ciblée par le code.
   * Nécessaire car deux entreprises peuvent avoir le même code.
   * Résolu depuis le produit dans le panier.
   */
  @IsUUID()
  companyId: string;

  /**
   * Montant total du panier en GNF (avant réduction).
   * Utilisé pour vérifier montantMinimum et calculer la réduction.
   */
  @IsNumber()
  @Min(0)
  cartTotal: number;

  /**
   * UUIDs des produits dans le panier.
   * Si la promo a scope = products, on vérifie que
   * au moins un produit du panier est dans la liste ciblée.
   */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  productIds?: string[];

  /**
   * UUID du client qui utilise le code.
   * Utilisé pour vérifier maxParClient (nombre d'usages par client).
   */
  @IsOptional()
  @IsUUID()
  clientId?: string;
}

// ─────────────────────────────────────────────────────────────
// DTO DE FILTRAGE — GET /promotions
// ─────────────────────────────────────────────────────────────

export class FilterPromotionsDto {

  /**
   * Filtrer par statut (active, draft, scheduled, paused, ended).
   * Correspond aux onglets de filtres dans PromotionsPage.tsx.
   */
  @IsOptional()
  @IsEnum(PromoStatus)
  status?: PromoStatus;

  /**
   * Filtrer par type (discount, free-ship, bundle, flash).
   */
  @IsOptional()
  @IsEnum(PromoType)
  type?: PromoType;

  /**
   * Filtrer par portée (global, products).
   */
  @IsOptional()
  @IsEnum(PromoScope)
  scope?: PromoScope;

  /**
   * Recherche sur le nom ou le code de la promo.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Numéro de page (défaut : 1) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Nombre de résultats par page (défaut : 20) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}