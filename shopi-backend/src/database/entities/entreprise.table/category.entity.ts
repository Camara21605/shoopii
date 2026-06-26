/* ============================================================
 * FICHIER : src/database/entities/category.entity.ts
 *
 * RÔLE
 * ────────────────────────────────────────────────────────────
 * Catégories principales de produits.
 * Exemples : Repas, Mode & Vêtements, Électronique, Boissons…
 *
 * RELATIONS
 * ────────────────────────────────────────────────────────────
 *
 *   Category >── CompanyType  (ManyToOne)
 *     Chaque catégorie appartient à UN SEUL type d'entreprise.
 *     Ex: "Repas" → type "Restaurant"
 *     Ex: "Smartphones" → type "Boutique High-Tech"
 *     Nullable = true pour les catégories génériques (cross-type).
 *
 *   Category ──< SubCategory  (OneToMany)
 *     Une catégorie peut avoir plusieurs sous-catégories.
 *     Ex: "Mode" → [Femme, Homme, Enfant, Accessoires]
 *
 *   Category ──< Product      (OneToMany, sans cascade)
 *     Un produit est classé dans une catégorie principale.
 *
 *   Company >──< Category     (ManyToMany via company_categories)
 *     Une entreprise propose plusieurs catégories.
 *     Une catégorie peut être proposée par plusieurs entreprises.
 *     → Relation gérée côté Company (owner side).
 *
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { CompanyType } from './company-type.entity';
import { SubCategory }  from './sub-category.entity';
import { Product }      from './product.entity';

@Entity('categories')
export class Category {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * IDENTITÉ
   * ========================================================== */

  /**
   * Nom affiché de la catégorie — unique toutes entreprises confondues.
   * Ex: "Électronique", "Mode & Vêtements", "Repas"
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  nom: string;

  /**
   * Slug technique stable pour les URLs et l'API.
   * Ex: 'electronique', 'mode-vetements', 'repas'
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  /**
   * Icône emoji ou classe FontAwesome.
   * Ex : "📱", "👗", "🍽️"
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icone: string | null;

  /**
   * Couleur d'accent (hex) utilisée pour les badges et aperçus.
   * Ex : "#059669"
   */
  @Column({ type: 'varchar', length: 7, nullable: true })
  couleur: string | null;

  /**
   * Description courte pour les filtres et les tooltips.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /**
   * Ordre d'affichage dans les menus de navigation.
   */
  @Column({ type: 'int', default: 0 })
  ordre: number;

  /**
   * Catégorie active (visible dans l'UI).
   */
  @Column({ type: 'boolean', default: true })
  actif: boolean;

  /* ==========================================================
   * RELATION → TYPE D'ENTREPRISE
   * ========================================================== */

  /**
   * Type d'entreprise auquel cette catégorie appartient.
   *
   * Relation : Category >── CompanyType (ManyToOne)
   *
   * Nullable = true → catégories "génériques" accessibles
   * à tous les types d'entreprise (ex: "Autre").
   *
   * onDelete SET NULL → si le type est supprimé, la catégorie
   * reste mais perd son rattachement.
   */
  @ManyToOne(() => CompanyType, ct => ct.categories, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: false,
  })
  @JoinColumn({ name: 'companyTypeId' })
  companyType: CompanyType | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyTypeId: string | null;

  /* ==========================================================
   * RELATIONS ENFANTS
   * ========================================================== */

  /**
   * Sous-catégories de cette catégorie.
   *
   * Relation : Category ──< SubCategory (OneToMany)
   *
   * cascade true → la suppression d'une catégorie supprime
   * automatiquement ses sous-catégories (comportement voulu).
   *
   * Ex: "Mode" → [Femme, Homme, Enfant, Accessoires, Bijoux]
   */
  @OneToMany(() => SubCategory, sc => sc.category, { cascade: true })
  subCategories: SubCategory[];

  /**
   * Produits classés dans cette catégorie.
   * Pas de cascade : un produit ne doit pas être supprimé
   * si sa catégorie est supprimée.
   */
  @OneToMany(() => Product, p => p.category, { cascade: false })
  products: Product[];

  /* ==========================================================
   * TIMESTAMPS
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}