/* ============================================================
 * FICHIER : src/database/entities/entreprise.table/product-story.entity.ts
 * RÔLE    : Stories éphémères type Instagram liées à un produit.
 *           Publiées par l'entreprise — expiration après 24h.
 *
 * ─── RELATIONS ───────────────────────────────────────────────
 *  ProductStory ──(ManyToOne)──► Product
 *    → Une story est liée à UN produit
 *    → Un produit peut avoir plusieurs stories
 *
 *  ProductStory ──(ManyToOne)──► Company
 *    → Une story appartient à UNE entreprise
 *    → Une entreprise peut publier plusieurs stories
 *
 * ─── CYCLE DE VIE ────────────────────────────────────────────
 *  published  → story visible (dans les 24h)
 *  expired    → story expirée (après 24h) — gardée en base
 *  archived   → story archivée manuellement par l'entreprise
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, Index,
} from 'typeorm';
import { Product } from './product.entity';
import { Company } from '../profiles/entreprise-profile.entity';

// ─── ENUMS ────────────────────────────────────────────────────

export enum StoryMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

export enum StoryStatus {
  PUBLISHED = 'published', // visible — dans les 24h
  EXPIRED   = 'expired',   // expirée automatiquement après 24h
  ARCHIVED  = 'archived',  // archivée manuellement
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Entity('product_stories')
export class ProductStory {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation Produit ──────────────────────────────────────────────────────

  /**
   * Produit mis en avant dans cette story.
   * onDelete CASCADE : si le produit est supprimé, ses stories aussi.
   */
  @ManyToOne(() => Product, product => product.stories, {
    nullable: false,
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'productId' })
  product: Promise<Product> | Product;

  @Column({ name: 'productId', type: 'varchar', length: 36 })
  productId: string;

  // ── Relation Entreprise ───────────────────────────────────────────────────

  /**
   * Entreprise qui publie cette story.
   * onDelete CASCADE : si l'entreprise est supprimée, ses stories aussi.
   */
  @ManyToOne(() => Company, company => company.stories, {
    nullable: false,
    onDelete: 'CASCADE',
    lazy: true,
  })
  @JoinColumn({ name: 'companyId' })
  company: Promise<Company> | Company;

  @Column({ name: 'companyId', type: 'varchar', length: 36 })
  companyId: string;

  // ── Contenu média ─────────────────────────────────────────────────────────

  /** URL du fichier (image ou vidéo) uploadé sur Cloudinary */
  @Column({ type: 'varchar', length: 500 })
  mediaUrl: string;

  /** Type de média : image ou vidéo */
  @Column({
    type: 'enum',
    enum: StoryMediaType,
    default: StoryMediaType.IMAGE,
  })
  mediaType: StoryMediaType;

  /**
   * Durée d'affichage en secondes.
   * Image : 5s par défaut
   * Vidéo : durée réelle de la vidéo (max 30s)
   */
  @Column({ type: 'int', default: 5 })
  duration: number;

  // ── Texte superposé ───────────────────────────────────────────────────────

  /** Texte affiché par-dessus la story (optionnel) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  caption: string | null;

  /**
   * Lien CTA (Call to Action) — ex: "Voir le produit"
   * Pointe vers la fiche produit ou une URL externe.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  ctaUrl: string | null;

  /** Texte du bouton CTA (ex: "Voir l'offre", "Commander") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  ctaLabel: string | null;

  // ── Planification horaire ─────────────────────────────────────────────────

  /**
   * Heure de début d'affichage au format "HH:MM".
   * Null = pas de restriction horaire (visible toute la journée).
   */
  @Column({ type: 'varchar', length: 5, nullable: true })
  heureDebut: string | null;

  /** Heure de fin d'affichage au format "HH:MM". */
  @Column({ type: 'varchar', length: 5, nullable: true })
  heureFin: string | null;

  /**
   * Jours d'affichage stockés en JSON.
   * Ex: ["lun","mar","mer","jeu","ven","sam","dim"]
   * Null = visible tous les jours.
   */
  @Column({ type: 'json', nullable: true })
  jours: string[] | null;

  // ── Statut & Expiration ───────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: StoryStatus,
    default: StoryStatus.PUBLISHED,
  })
  @Index()
  status: StoryStatus;

  /**
   * Date d'expiration automatique.
   * Calculée à la création : createdAt + 24h.
   * Un CRON job passe les stories expirées en status = EXPIRED.
   */
  @Column({ type: 'timestamp' })
  @Index()
  expiresAt: Date;

  // ── Statistiques ──────────────────────────────────────────────────────────

  /** Nombre de vues uniques */
  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  /** Nombre de clics sur le CTA */
  @Column({ type: 'int', default: 0 })
  ctaClicks: number;

  // ── Timestamp ─────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;
}