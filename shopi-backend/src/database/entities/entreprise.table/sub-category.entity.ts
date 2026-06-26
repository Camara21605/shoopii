/* ============================================================
 * FICHIER : src/database/entities/sub-category.entity.ts
 *
 * RÔLE
 * ────────────────────────────────────────────────────────────
 * Sous-catégories liées à une catégorie principale.
 * Exemples : "Smartphones Android", "Ultrabooks", "Sneakers"
 *
 * RELATIONS
 * ────────────────────────────────────────────────────────────
 *
 *   SubCategory >── Category  (ManyToOne)
 *     Chaque sous-catégorie appartient à UNE SEULE catégorie.
 *     onDelete CASCADE → si la catégorie parente est supprimée,
 *     ses sous-catégories le sont aussi.
 *
 *   SubCategory ──< Product   (OneToMany, sans cascade)
 *     Les produits référencent leur sous-catégorie.
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { Category } from './category.entity';
import { Product }  from './product.entity';

@Entity('sub_categories')
export class SubCategory {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * IDENTITÉ
   * ========================================================== */

  /**
   * Nom affiché de la sous-catégorie.
   * Ex : "Smartphones Android", "Chaussures Homme", "Desserts"
   */
  @Column({ type: 'varchar', length: 100 })
  nom: string;

  /**
   * Slug technique pour les URLs et l'API.
   * Ex : 'smartphones-android', 'chaussures-homme'
   * Unique au sein de la même catégorie (index composite).
   */
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  /**
   * Icône optionnelle (emoji ou FontAwesome).
   * Hérite de l'icône de la catégorie si non définie.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icone: string | null;

  /**
   * Description courte affichée dans les filtres et tooltips.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /**
   * Ordre d'affichage dans la liste des sous-catégories.
   */
  @Column({ type: 'int', default: 0 })
  ordre: number;

  /**
   * Sous-catégorie active (visible dans l'UI).
   */
  @Column({ type: 'boolean', default: true })
  actif: boolean;

  /* ==========================================================
   * RELATION → CATÉGORIE PARENTE
   * ========================================================== */

  /**
   * Catégorie parente de cette sous-catégorie.
   *
   * Relation : SubCategory >── Category (ManyToOne)
   *
   * onDelete CASCADE → suppression de la catégorie parente
   * entraîne la suppression de toutes ses sous-catégories.
   * C'est le comportement voulu : les sous-catégories n'ont
   * pas de sens sans leur catégorie.
   */
  @ManyToOne(() => Category, cat => cat.subCategories, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  categoryId: string;

  /* ==========================================================
   * RELATIONS ENFANTS
   * ========================================================== */

  /**
   * Produits classés dans cette sous-catégorie.
   * Pas de cascade : les produits ne doivent pas être supprimés
   * si leur sous-catégorie est supprimée.
   */
  @OneToMany(() => Product, p => p.subCategory, { cascade: false })
  products: Product[];

  /* ==========================================================
   * TIMESTAMPS
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}