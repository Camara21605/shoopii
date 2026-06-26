/* ============================================================
 * FICHIER : src/database/entities/promotion.entity.ts
 *
 * RÔLE    : Promotions & Codes promo créés par les entreprises Shopi.
 *           Gère les réductions, ventes flash, livraison gratuite et bundles.
 *
 * ─── RELATIONS ───────────────────────────────────────────────
 *
 *  Promotion ──(ManyToOne)──► Company
 *    → Une promo appartient à une seule entreprise
 *    → Une entreprise peut avoir plusieurs promos
 *
 *  Promotion ──(OneToMany)──► PromotionProduct  [TABLE DE JOINTURE]
 *    → Si scope = PRODUCTS, la promo cible des produits spécifiques
 *    → Si scope = GLOBAL, elle s'applique à toute l'entreprise
 *
 *  Promotion ──(OneToMany)──► PromotionUsage
 *    → Historique de chaque utilisation du code (par quel client, quelle commande)
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *  1. code promo UNIQUE par entreprise (pas global — deux entreprises
 *     peuvent avoir le même code, ça ne se chevauche pas)
 *  2. scope GLOBAL → s'applique à tous les produits de l'entreprise
 *     scope PRODUCTS → seuls les produits listés dans PromotionProduct
 *  3. usesCount est dénormalisé pour la performance (incrémenté à chaque usage)
 *  4. isActive calculé en runtime : status=ACTIVE + !expiré + stock > 0
 *  5. Un client ne peut utiliser le même code qu'une seule fois
 *     (contrainte UNIQUE sur PromotionUsage.clientId + promotionId)
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company }          from '../profiles/entreprise-profile.entity';
import { PromotionProduct } from './promotion-product.entity';
import { PromotionUsage }   from './promotion-usage.entity';

// ─── ENUMS ────────────────────────────────────────────────────

/**
 * Type de promotion — correspond aux 4 templates de PromotionsPage.tsx
 */
export enum PromoType {
  /** Réduction en pourcentage (ex: -20%) */
  DISCOUNT   = 'discount',
  /** Livraison offerte (sans seuil ou au-dessus d'un montant) */
  FREE_SHIP  = 'free-ship',
  /** Bundle : ex "2 achetés = 1 offert" ou réduction sur lot */
  BUNDLE     = 'bundle',
  /** Vente flash : durée + stock limités */
  FLASH      = 'flash',
}

/**
 * Statut de la promotion
 */
export enum PromoStatus {
  /** Brouillon — créé mais pas encore publié */
  DRAFT      = 'draft',
  /** Planifié — sera actif à partir de startDate */
  SCHEDULED  = 'scheduled',
  /** Actif — visible et utilisable par les clients */
  ACTIVE     = 'active',
  /** Suspendu — mis en pause manuellement */
  PAUSED     = 'paused',
  /** Terminé — expiré naturellement (date ou stock épuisé) */
  ENDED      = 'ended',
}

/**
 * Portée de la promotion
 * Correspond au sélecteur "Toute l'entreprise / Produit(s) spécifique(s)"
 * de PromotionsPage.tsx
 */
export enum PromoScope {
  /** S'applique à tous les produits de l'entreprise */
  GLOBAL   = 'global',
  /** S'applique uniquement aux produits listés dans PromotionProduct */
  PRODUCTS = 'products',
}

/**
 * Type de valeur de la réduction
 */
export enum PromoValueType {
  /** Pourcentage (ex: 20 = -20%) */
  PERCENT  = 'percent',
  /** Montant fixe en GNF (ex: 5000 = -5 000 GNF) */
  FIXED    = 'fixed',
  /** Livraison gratuite (valeur ignorée) */
  FREE     = 'free',
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ PRINCIPALE
// ─────────────────────────────────────────────────────────────

@Entity('promotions')
export class Promotion {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation Entreprise ───────────────────────────────────────────────────

  /**
   * Entreprise propriétaire de cette promotion.
   *
   * onDelete CASCADE : si l'entreprise est supprimée,
   * toutes ses promotions le sont aussi.
   */
  @ManyToOne(() => Company, company => company.promotions, {
    nullable: false,
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company> | Company;

  @Index()
  @Column({ name: 'companyId', type: 'uuid' })
  companyId: string;

  // ── Informations de base ───────────────────────────────────────────────────

  /** Nom interne de la promotion (ex: "Soldes Janvier 2025") */
  @Column({ type: 'varchar', length: 255 })
  nom: string;

  /**
   * Code promo saisi par le client lors du checkout.
   * Ex: SOLDES20, NOEL10, FLASHGAMING
   *
   * UNIQUE PAR ENTREPRISE (via la contrainte composite ci-dessous).
   * Deux entreprises différentes peuvent avoir le même code.
   *
   * Toujours stocké en MAJUSCULES.
   */
  @Index()
  @Column({ type: 'varchar', length: 50 })
  code: string;

  /** Type de promotion */
  @Column({ type: 'enum', enum: PromoType })
  type: PromoType;

  /** Portée : toute l'entreprise ou produits spécifiques */
  @Column({ type: 'enum', enum: PromoScope, default: PromoScope.GLOBAL })
  scope: PromoScope;

  /** Statut courant de la promotion */
  @Column({ type: 'enum', enum: PromoStatus, default: PromoStatus.DRAFT })
  @Index()
  status: PromoStatus;

  // ── Valeur de la réduction ────────────────────────────────────────────────

  /** Type de valeur : pourcentage, montant fixe ou gratuit */
  @Column({ type: 'enum', enum: PromoValueType, default: PromoValueType.PERCENT })
  valueType: PromoValueType;

  /**
   * Valeur de la réduction.
   * Si valueType = PERCENT  → ex: 20 (signifie -20%)
   * Si valueType = FIXED    → ex: 5000 (signifie -5 000 GNF)
   * Si valueType = FREE     → ignoré (livraison gratuite)
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valeur: number | null;

  /**
   * Montant minimum de commande requis pour bénéficier de la promo.
   * Ex: 50000 → la promo s'active seulement si le panier > 50 000 GNF.
   * null = pas de minimum.
   */
  @Column({ type: 'bigint', nullable: true })
  montantMinimum: number | null;

  /**
   * Plafond de réduction en GNF (utilisé si valueType = PERCENT).
   * Ex: si valeur = 30% et plafond = 10000, la réduction max est 10 000 GNF.
   * null = pas de plafond.
   */
  @Column({ type: 'bigint', nullable: true })
  plafondReduction: number | null;

  // ── Limites d'utilisation ─────────────────────────────────────────────────

  /**
   * Nombre maximum d'utilisations totales (tous clients confondus).
   * null = illimité.
   */
  @Column({ type: 'int', nullable: true })
  maxUtilisations: number | null;

  /**
   * Nombre maximum d'utilisations PAR CLIENT.
   * Valeur recommandée : 1 (un seul usage par client).
   * null = illimité par client.
   */
  @Column({ type: 'int', default: 1 })
  maxParClient: number;

  /**
   * Compteur dénormalisé du nombre total d'utilisations.
   * Incrémenté à chaque PromotionUsage créé.
   * Évite un COUNT(*) à chaque affichage.
   */
  @Column({ type: 'int', default: 0 })
  usesCount: number;

  // ── Dates ─────────────────────────────────────────────────────────────────

  /**
   * Date de début de validité.
   * null = applicable immédiatement dès activation.
   */
  @Column({ type: 'timestamp', nullable: true })
  @Index()
  startDate: Date | null;

  /**
   * Date d'expiration.
   * null = pas de date limite (illimité dans le temps).
   */
  @Column({ type: 'timestamp', nullable: true })
  @Index()
  endDate: Date | null;

  // ── Champs spécifiques au type FLASH ──────────────────────────────────────

  /**
   * Stock dédié à la vente flash.
   * Uniquement pertinent si type = FLASH.
   * Décrémenté à chaque utilisation.
   * null = pas de stock dédié (utilise le stock produit).
   */
  @Column({ type: 'int', nullable: true })
  flashStock: number | null;

  // ── Champs spécifiques au type BUNDLE ────────────────────────────────────

  /**
   * Quantité minimale d'achat pour déclencher le bundle.
   * Ex: 2 (acheter 2 → 1 offert).
   * Uniquement pertinent si type = BUNDLE.
   */
  @Column({ type: 'int', nullable: true })
  bundleQuantiteMin: number | null;

  /**
   * Quantité offerte dans le bundle.
   * Ex: 1 (pour 2 achetés, 1 est offert).
   */
  @Column({ type: 'int', nullable: true })
  bundleQuantiteOfferte: number | null;

  // ── Champs spécifiques FREE_SHIP ──────────────────────────────────────────

  /**
   * Montant minimum pour bénéficier de la livraison gratuite.
   * Ex: 100000 → livraison offerte pour commande > 100 000 GNF.
   * Uniquement pertinent si type = FREE_SHIP.
   */
  @Column({ type: 'bigint', nullable: true })
  freeShipSeuil: number | null;

  // ── Métadonnées ────────────────────────────────────────────────────────────

  /** Description interne visible uniquement par l'entreprise */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * CA (Chiffre d'Affaires) généré grâce à cette promo.
   * Dénormalisé pour éviter une jointure avec orders à chaque affichage.
   * Mis à jour par un trigger ou un job après chaque commande.
   */
  @Column({ type: 'bigint', default: 0 })
  caGenere: number;

  // ── Relations OneToMany ────────────────────────────────────────────────────

  /**
   * Produits ciblés par cette promotion.
   * Peuplé UNIQUEMENT si scope = PRODUCTS.
   * Vide si scope = GLOBAL.
   */
  @OneToMany(() => PromotionProduct, pp => pp.promotion, {
    cascade: true,
    eager: false,
  })
  produits: PromotionProduct[];

  /**
   * Historique de toutes les utilisations de ce code promo.
   * Utilisé pour : vérifier les droits, calculer les stats, auditer.
   */
  @OneToMany(() => PromotionUsage, usage => usage.promotion, {
    cascade: true,
    eager: false,
  })
  usages: PromotionUsage[];

  // ── Timestamps ─────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}