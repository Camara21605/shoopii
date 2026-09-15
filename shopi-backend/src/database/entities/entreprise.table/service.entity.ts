/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/service.entity.ts
 * RÔLE    : Prestations de service publiées par les entreprises dont
 *           Company.businessModel === SERVICES (voir entreprise-profile
 *           .entity.ts). Miroir structurel de product.entity.ts pour ce
 *           qui est réellement commun (catégorie, médias, SEO, likes),
 *           mais sans rien de spécifique aux biens physiques (stock,
 *           poids/dimensions, livraison, vente en gros) — remplacé par
 *           ce qui a du sens pour un service : durée, tarification
 *           (fixe/horaire/sur devis), zone d'intervention.
 *
 * ─── HORS SCOPE MVP (volontairement absent) ────────────────────
 *   - Pas de moteur de réservation/calendrier réel : dureeMin/MaxMinutes
 *     et capaciteMax ne font qu'INFORMER l'affichage client, aucun
 *     système de créneaux/disponibilités n'existe derrière.
 *   - Pas de stories, pas de promotions, pas de variantes, pas de vente
 *     en gros — aucun de ces concepts n'a de sens pour un service ici.
 *   - Pas de flux de paiement/commande : un service ne s'achète pas via
 *     le panier existant, il déclenche une demande de contact/devis
 *     (voir CardService.tsx côté frontend).
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Company }      from '../profiles/entreprise-profile.entity';
import { Category }     from './category.entity';
import { SubCategory }  from './sub-category.entity';
import { ServiceMedia } from './service-media.entity';
import { ServiceSpec }  from './service-spec.entity';
import { ServiceLike }  from './service-like.entity';

// ─── ENUMS ────────────────────────────────────────────────────────────────────

export enum ServiceVisibility {
  PUBLIC  = 'public',
  DRAFT   = 'draft',
  PRIVATE = 'private',
}

/** Comment le prix est présenté au client — un service n'a pas toujours
 *  de prix fixe affichable (ex: "sur devis"), contrairement à un produit. */
export enum ServicePricingType {
  FIXE    = 'fixe',
  HORAIRE = 'horaire',
  DEVIS   = 'sur_devis',
}

export enum ServiceResponseDelay {
  IMMEDIATE = 'immediate',
  H24       = '24h',
  H48       = '48h',
  J7        = '7j',
}

export enum ServiceCancellationPolicy {
  FLEXIBLE          = 'flexible',
  MODEREE           = 'moderee',
  STRICTE           = 'stricte',
  NON_REMBOURSABLE  = 'non_remboursable',
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────────────────────

@Entity('services')
export class Service {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation vers l'entreprise propriétaire ────────────────────────────────

  @ManyToOne(() => Company, company => company.services, {
    nullable: false,
    onDelete: 'CASCADE',
    lazy:     true,
  })
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company> | Company;

  @Index()
  @Column({ name: 'companyId', type: 'uuid' })
  companyId: string;

  // ── Catégorie & Sous-catégorie ─────────────────────────────────────────────
  // Non eager — même règle de performance que Product (voir product.entity.ts).
  // Le service applicatif doit s'assurer que la catégorie choisie appartient à
  // un CompanyType dont nature ∈ {services, neutral} (voir prestations.service.ts).

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Index()
  @Column({ name: 'categoryId', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => SubCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subCategoryId' })
  subCategory: SubCategory | null;

  @Column({ name: 'subCategoryId', type: 'uuid', nullable: true })
  subCategoryId: string | null;

  // ── Informations de base ───────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 255 })
  nom: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Tags SEO séparés par virgule */
  @Column({ type: 'varchar', length: 500, nullable: true })
  tags: string | null;

  @Column({ type: 'enum', enum: ServiceVisibility, default: ServiceVisibility.DRAFT })
  visibilite: ServiceVisibility;

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  langue: string;

  // ── Tarification ───────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: ServicePricingType, default: ServicePricingType.FIXE })
  pricingType: ServicePricingType;

  /** Prix en GNF — requis si pricingType ∈ {FIXE, HORAIRE}, doit rester null
   *  si pricingType === DEVIS (contrainte applicative, pas en DB — voir
   *  CreateServiceDto). Pour HORAIRE, c'est le tarif par heure. */
  @Column({ type: 'bigint', nullable: true })
  prix: number | null;

  /** Prix barré promo — même logique que Product.prixAncien. */
  @Column({ type: 'bigint', nullable: true })
  prixAncien: number | null;

  // ── Durée & capacité (informatif — pas de moteur de réservation, voir en-tête) ──

  @Column({ type: 'int', nullable: true })
  dureeMinMinutes: number | null;

  @Column({ type: 'int', nullable: true })
  dureeMaxMinutes: number | null;

  /** Nombre max de personnes par session (cours collectif, atelier…) — null = pas de limite affichée. */
  @Column({ type: 'int', nullable: true })
  capaciteMax: number | null;

  // ── Mode de prestation ─────────────────────────────────────────────────────

  /** Le client se déplace chez le prestataire. */
  @Column({ type: 'boolean', default: true })
  surPlaceEntreprise: boolean;

  /** Le prestataire se déplace chez le client. */
  @Column({ type: 'boolean', default: false })
  aDomicile: boolean;

  /** Visio / téléphone / en ligne. */
  @Column({ type: 'boolean', default: false })
  aDistance: boolean;

  /** Zone d'intervention en texte libre (ex: "Kaloum, Dixinn, Ratoma") — actif seulement si aDomicile. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  zoneCouverture: string | null;

  /** Frais de déplacement en GNF (0 = gratuit) — actif seulement si aDomicile. */
  @Column({ type: 'int', nullable: true })
  fraisDeplacement: number | null;

  // ── Réservation & annulation ───────────────────────────────────────────────

  /** false = service "sans rendez-vous". */
  @Column({ type: 'boolean', default: true })
  reservationRequise: boolean;

  @Column({ type: 'enum', enum: ServiceResponseDelay, default: ServiceResponseDelay.H24 })
  delaiReponse: ServiceResponseDelay;

  @Column({ type: 'enum', enum: ServiceCancellationPolicy, default: ServiceCancellationPolicy.MODEREE })
  politiqueAnnulation: ServiceCancellationPolicy;

  // ── Garanties affichées sur la fiche ───────────────────────────────────────

  @Column({ type: 'boolean', default: true })
  garantiePaiement: boolean;

  /** Équivalent de garantieRetour côté produit — "satisfait ou refait". */
  @Column({ type: 'boolean', default: true })
  garantieSatisfaction: boolean;

  // ── SEO ────────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 70, nullable: true })
  titreSeo: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  descriptionSeo: string | null;

  /** URL Slug unique → shopi.gn/s/<urlSlug> */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  urlSlug: string | null;

  // ── Relations OneToMany ────────────────────────────────────────────────────

  /** Médias (max 5 images + 1 vidéo — voir CreateServiceDto) — non eager. */
  @OneToMany(() => ServiceMedia, media => media.service, { cascade: true })
  media: ServiceMedia[];

  /** "Ce qui est inclus" / prérequis — tableau clé/valeur, même pattern que ProductSpec. */
  @OneToMany(() => ServiceSpec, s => s.service, { cascade: true })
  specs: ServiceSpec[];

  @Column({ type: 'int', default: 0 })
  likesCount: number;

  @OneToMany(() => ServiceLike, like => like.service, { cascade: true })
  likes: ServiceLike[];

  // ── Timestamps ─────────────────────────────────────────────────────────────

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
