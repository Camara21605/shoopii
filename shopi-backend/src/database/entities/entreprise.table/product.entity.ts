/* ============================================================
 * FICHIER : src/database/entities/product.entity.ts
 * RÔLE    : Produits publiés par les entreprises Shopi.
 *
 * ─── RELATIONS ───────────────────────────────────────────────
 *
 *  Product ──(ManyToOne)──► Company
 *    → Un produit appartient à une seule entreprise
 *    → Une entreprise peut avoir de 0 à plusieurs produits
 *
 *  Product ──(ManyToOne)──► Category + SubCategory
 *    → Catégorisation pour la navigation et le SEO
 *
 *  Product ──(OneToMany)──► ProductMedia   (max 10)
 *  Product ──(OneToMany)──► ProductVariant (couleur, taille…)
 *  Product ──(OneToMany)──► ProductSpec    (caractéristiques clé/valeur)
 *
 * ─── CHAMPS ISSUS DE AjouterPage.tsx ─────────────────────────
 *  ① SEO : titreSeo, descriptionSeo, urlSlug
 *  ② Dimensions : longueur, largeur, hauteur, poids
 *  ③ Origine : paysOrigine
 *  ④ Retour : politiqueRetour
 *  ⑤ Contenu boîte : contenuBoite
 *  ⑦ Livraison : livraisonStandard, livraisonLivreur, livraisonCorrespondant
 *  ⑧ Garanties fiche : garantiePaiement, garantieRetour, garantieAuthentic…
 *  ⑩ Langue : langue
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company }        from '../profiles/entreprise-profile.entity';
import { Category }       from './category.entity';
import { SubCategory }    from './sub-category.entity';
import { ProductMedia }   from './product-media.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductSpec }    from './product-spec.entity';
import { ProductWholesaleTier } from './product-wholesale-tier.entity';
import { ProductLike } from './product-like.entity';
import { ProductStory } from './product-story.entity';
import { PromotionProduct } from './promotion-product.entity';

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export enum ProductVisibility {
  PUBLIC  = 'public',  // Visible sur la boutique
  DRAFT   = 'draft',   // Brouillon — non publié
  PRIVATE = 'private', // Lien direct uniquement
}

export enum ProductCondition {
  NEUF          = 'neuf',
  RECONDITIONNE = 'reconditionne',
  OCCASION      = 'occasion',
}

export enum RetourPolicy {
  SEVEN_DAYS    = '7j',
  FOURTEEN_DAYS = '14j',
  THIRTY_DAYS   = '30j',
  DEFECT_ONLY   = 'defect',
  NONE          = 'none',
}

export enum DeliveryDelay {
  SAME_DAY    = 'Même jour',
  ONE_THREE   = '1-3 jours',
  THREE_SEVEN = '3-7 jours',
  SEVEN_14    = '7-14 jours',
  FOURTEEN_30 = '14-30 jours',
  ON_ORDER    = 'Sur commande',
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────────────────────

@Entity('products')
export class Product {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation vers l'entreprise propriétaire ────────────────────────────────

  /**
   * Entreprise qui a publié ce produit.
   *
   * ✅ RELATION CLÉ : ManyToOne vers Company
   *
   * Une entreprise → plusieurs produits (OneToMany côté Company).
   * Un produit → une seule entreprise (ManyToOne ici).
   *
   * onDelete CASCADE : si l'entreprise est supprimée, ses produits aussi.
   */
  @ManyToOne(() => Company, company => company.products, {
    nullable: false,
    onDelete: 'CASCADE',
    lazy:     true,
  })
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company> | Company;

  /** UUID de l'entreprise — accessible sans charger la relation */
  @Index() 
  @Column({ name: 'companyId', type: 'uuid' })
  companyId: string;

  // ── Catégorie & Sous-catégorie ─────────────────────────────────────────────

  /** Catégorie principale (ex: Électronique) */
  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column({ name: 'categoryId', type: 'uuid' })
  categoryId: string;

  /** Sous-catégorie facultative (ex: Smartphones Android) */
  @ManyToOne(() => SubCategory, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'subCategoryId' })
  subCategory: SubCategory | null;

  @Column({ name: 'subCategoryId', type: 'uuid', nullable: true })
  subCategoryId: string | null;

  // ── Informations de base ───────────────────────────────────────────────────

  /** Nom du produit (ex: iPhone 15 Pro 256GB Titanium) */
  @Column({ type: 'varchar', length: 255 })
  nom: string;

  /** Description longue du produit */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Contenu de la boîte — affiché dans l'onglet Description */
  @Column({ type: 'text', nullable: true })
  contenuBoite: string | null;

  /** Marque (ex: Apple, Samsung…) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  marque: string | null;

  /** Tags SEO séparés par virgule (ex: iphone,apple,smartphone) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  tags: string | null;

  /** Référence / SKU interne (ex: APPL-IP15P-256-TIT) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  // ── Prix ───────────────────────────────────────────────────────────────────

  /** Prix de vente en GNF */
  @Column({ type: 'bigint' })
  prix: number;

  /** Ancien prix barré — null si pas de promotion */
  @Column({ type: 'bigint', nullable: true })
  prixAncien: number | null;

  // ── Stock ──────────────────────────────────────────────────────────────────

  /** Quantité disponible */
  @Column({ type: 'int', default: 0 })
  stock: number;

  /** Seuil d'alerte — notification quand stock <= seuil */
  @Column({ type: 'int', nullable: true })
  seuil: number | null;

  // ── Classification ─────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: ProductVisibility, default: ProductVisibility.DRAFT })
  visibilite: ProductVisibility;

  @Column({ type: 'enum', enum: ProductCondition, default: ProductCondition.NEUF })
  condition: ProductCondition;

  /** Garantie commerciale (ex: 12 mois) */
  @Column({ type: 'varchar', length: 50, default: '12 mois' })
  garantie: string;

  /** Langue de la fiche produit (fr, en, ar) */
  @Column({ type: 'varchar', length: 5, default: 'fr' })
  langue: string;

  // ── Origine & Dimensions physiques ────────────────────────────────────────

  /** Code pays d'origine (ex: GN, CN, FR…) */
  @Column({ type: 'varchar', length: 5, default: 'GN' })
  paysOrigine: string;

  /** Poids en kg */
  @Column({ type: 'decimal', precision: 8, scale: 3, nullable: true })
  poids: number | null;

  /** Longueur en cm */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  longueur: number | null;

  /** Largeur en cm */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  largeur: number | null;

  /** Hauteur en cm */
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  hauteur: number | null;

  // ── Politique de retour ────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: RetourPolicy, default: RetourPolicy.SEVEN_DAYS })
  politiqueRetour: RetourPolicy;

  // ── Politique de livraison ─────────────────────────────────────────────────

  /** Livraison standard (gérée par la boutique) */
  @Column({ type: 'boolean', default: true })
  livraisonStandard: boolean;

  /** Choix d'un livreur Shopi disponible */
  @Column({ type: 'boolean', default: true })
  livraisonLivreur: boolean;

  /** Livraison via correspondant (produits internationaux) */
  @Column({ type: 'boolean', default: false })
  livraisonCorrespondant: boolean;

  /** Frais de livraison locale en GNF (0 = gratuit) */
  @Column({ type: 'int', nullable: true })
  fraisLivraisonLocal: number | null;

  /** Délai de livraison estimé */
  @Column({ type: 'enum', enum: DeliveryDelay, default: DeliveryDelay.ONE_THREE })
  delaiLivraison: DeliveryDelay;

  // ── Garanties affichées sur la fiche produit ───────────────────────────────

  @Column({ type: 'boolean', default: true })
  garantiePaiement: boolean;

  @Column({ type: 'boolean', default: true })
  garantieRetour: boolean;

  @Column({ type: 'boolean', default: true })
  garantieAuthentic: boolean;

  @Column({ type: 'boolean', default: true })
  garantieSupport: boolean;

  // ── SEO ────────────────────────────────────────────────────────────────────

  /** Meta title pour Google (50-70 caractères recommandés) */
  @Column({ type: 'varchar', length: 70, nullable: true })
  titreSeo: string | null;

  /** Meta description pour Google (120-160 caractères recommandés) */
  @Column({ type: 'varchar', length: 160, nullable: true })
  descriptionSeo: string | null;

  /**
   * URL Slug unique → shopi.gn/p/<urlSlug>
   * Ex: "iphone-15-pro-256gb"
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  urlSlug: string | null;

  // ── Vente en gros ──────────────────────────────────────────────────────────

  /** Active la vente en gros pour ce produit (paliers de prix dégressifs) */
  @Column({ type: 'boolean', default: false })
  venteEnGros: boolean;

  /** Quantité minimum de commande pour acheter en gros */
  @Column({ type: 'int', nullable: true })
  moq: number | null;

  /** Conditionnement — nombre d'unités par carton/colis */
  @Column({ type: 'int', nullable: true })
  conditionnement: number | null;

  /** Délai de préparation pour les commandes en gros (ex: "3-5 jours") */
  @Column({ type: 'varchar', length: 50, nullable: true })
  delaiPreparationGros: string | null;

  /** Paliers de prix dégressifs selon la quantité commandée */
  @OneToMany(() => ProductWholesaleTier, t => t.product, { cascade: true, eager: true })
  wholesaleTiers: ProductWholesaleTier[];

  // ── Relations OneToMany ────────────────────────────────────────────────────

  /** Images du produit (max 10, ordre = 0 → image principale) */
  @OneToMany(() => ProductMedia, media => media.product, { cascade: true, eager: true })
  media: ProductMedia[];
  /** Variantes (Couleur, Stockage, RAM, Taille…) */
  @OneToMany(() => ProductVariant, v => v.product, { cascade: true })
  variantes: ProductVariant[];

  /** Caractéristiques techniques (tableau clé/valeur) */
  @OneToMany(() => ProductSpec, s => s.product, { cascade: true, eager: true })
  specs: ProductSpec[];
  
  /** Nombre de likes — dénormalisé pour la performance */
  @Column({ type: 'int', default: 0 })
  likesCount: number;

  /** Relation vers les likes */
  @OneToMany(() => ProductLike, like => like.product, { cascade: true })
  likes: ProductLike[];

  /** Stories éphémères liées à ce produit */
  @OneToMany(() => ProductStory, story => story.product, { cascade: true })
  stories: ProductStory[];
  /**
 * Prix promotionnel actif en GNF — null si aucune promo active.
 * Mis à jour par un job quand une promotion démarre/se termine.
 * Évite de rejoindre promotion_products à chaque affichage de liste.
 */
  @Column({ type: 'bigint', nullable: true })
  prixPromo: number | null;

  /**
   * UUID de la promotion active sur ce produit — null si aucune.
   * Dénormalisé pour afficher le badge promo en un seul SELECT.
   */
  @Column({ type: 'uuid', nullable: true })
  activePromoId: string | null;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;


}