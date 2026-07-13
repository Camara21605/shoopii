/* ============================================================
 * FICHIER  : src/database/entities/help/help-article.entity.ts
 * ROLE     : Article du Centre d'aide Shopi.
 *
 * RESPONSABILITES :
 *   - Stocke le contenu Markdown des articles d'aide.
 *   - Maintient le cycle de vie DRAFT → PUBLISHED → ARCHIVED.
 *   - Indexe le contenu en tsvector pour la recherche plein texte.
 *   - Accumule les métriques de satisfaction (helpfulCount / notHelpfulCount).
 *   - Soft delete : un article archivé est conservé pour l'historique
 *     des liens partagés (SEO, signets utilisateur).
 *
 * DEPENDANCES :
 *   - HelpCategory (ManyToOne — nullable, SET NULL si catégorie supprimée)
 *
 * INDEXES :
 *   - slug (unique)               → URL canonique de l'article
 *   - categoryId                  → liste des articles par catégorie
 *   - status                      → filtre draft/published/archived
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { HelpCategory } from './help-category.entity';

/* ── Cycle de vie d'un article ──────────────────────────────── */
export enum HelpArticleStatus {
  DRAFT     = 'draft',      // en cours de rédaction — invisible client
  PUBLISHED = 'published',  // visible côté client
  ARCHIVED  = 'archived',   // masqué client, conservé pour historique
}

@Entity('help_articles')
export class HelpArticle {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* Slug URL-safe, ex: "comment-payer-en-ligne".
   * Généré à partir du titre, modifiable par l'admin.
   * Stable pour le référencement — changer le slug casse les liens partagés. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug!: string;

  /* ── Catégorie ───────────────────────────────────────────── */

  @ManyToOne(() => HelpCategory, { nullable: true, onDelete: 'SET NULL', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'categoryId' })
  category!: HelpCategory | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  categoryId!: string | null;

  /* ── Contenu ─────────────────────────────────────────────── */

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  /* Résumé de 1-2 phrases — affiché dans les résultats de recherche
   * et les cartes catégorie. Non rendu en Markdown. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  excerpt!: string | null;

  /* Corps de l'article en Markdown brut.
   * Le rendu HTML est produit côté client.
   * Jamais stocker du HTML brut ici (risque XSS). */
  @Column({ type: 'text' })
  content!: string;

  /* Colonne tsvector maintenue par un trigger PostgreSQL.
   * select:false — jamais sérialisée dans les réponses API.
   * Utilisée exclusivement dans les requêtes de recherche FTS. */
  @Column({ type: 'tsvector', nullable: true, select: false })
  searchVector!: string | null;

  /* ── Cycle de vie ────────────────────────────────────────── */

  @Index()
  @Column({ type: 'enum', enum: HelpArticleStatus, default: HelpArticleStatus.DRAFT })
  status!: HelpArticleStatus;

  /* Audience restreinte — null = visible par tous les rôles.
   * Valeurs possibles: 'client', 'company', 'delivery', 'partner', etc.
   * Stocké en simple-array PostgreSQL (virgule comme délimiteur). */
  @Column({ type: 'simple-array', nullable: true })
  audience!: string[] | null;

  /* ── Auteur et publication ───────────────────────────────── */

  /* userId de l'admin qui a créé l'article.
   * Pas de FK contrainte — consultez le log d'audit pour l'historique complet. */
  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  /* Rempli lors du premier passage en PUBLISHED.
   * Jamais remis à null — une republication garde la date initiale. */
  @Column({ type: 'timestamp', nullable: true })
  publishedAt!: Date | null;

  /* ── Compteurs de satisfaction (dénormalisés) ────────────── */

  /* Vues totales — incrémenté par ArticleService.recordView().
   * Non exact (pas de déduplication utilisateur) — uniquement indicatif. */
  @Column({ type: 'int', default: 0 })
  viewCount!: number;

  /* Votes "Oui, cet article m'a aidé" */
  @Column({ type: 'int', default: 0 })
  helpfulCount!: number;

  /* Votes "Non, cet article ne répond pas à ma question" */
  @Column({ type: 'int', default: 0 })
  notHelpfulCount!: number;

  /* ── Audit de suppression ─────────────────────────────────── */

  /* UUID de l'admin qui a supprimé (soft deleted) l'article. */
  @Column({ type: 'uuid', nullable: true })
  deletedBy!: string | null;

  /* ── Timestamps ───────────────────────────────────────────── */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /* Soft delete — l'article reste en base même après suppression.
   * Les liens partagés par email ou bookmarks restent valides ;
   * le service renvoie 410 Gone au lieu de 404. */
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
