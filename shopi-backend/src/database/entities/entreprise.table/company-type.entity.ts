/* ============================================================
 * FICHIER : src/database/entities/company-type.entity.ts
 *
 * RÔLE
 * ────────────────────────────────────────────────────────────
 * Table des types d'entreprise Shopi.
 * Exemples : Restaurant, Boutique, Pharmacie, Artisan…
 *
 * RELATIONS
 * ────────────────────────────────────────────────────────────
 *
 *   CompanyType ──< Category
 *     Un type peut regrouper plusieurs catégories.
 *     Ex: "Restaurant" → [Repas, Boissons, Desserts]
 *     Ex: "Boutique"   → [Mode, Accessoires, Électronique]
 *
 *   CompanyType ──< Company (via company.companyTypeId)
 *     Chaque entreprise a exactement un type.
 *
 * SEED INITIAL
 * ────────────────────────────────────────────────────────────
 * Les données initiales sont injectées via un seeder NestJS.
 * Champ `slug` = identifiant stable pour les seeds + API.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { Category } from './category.entity';
import { Company }  from '../profiles/entreprise-profile.entity';

@Entity('company_types')
export class CompanyType {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * IDENTITÉ
   * ========================================================== */

  /**
   * Slug technique stable (kebab-case).
   * Utilisé dans les seeds, les filtres API et les URLs.
   * Exemples : 'restaurant', 'boutique', 'pharmacie'
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug: string;

  /**
   * Libellé affiché dans l'interface.
   * Ex : "Restaurant", "Boutique & Commerce", "Pharmacie"
   */
  @Column({ type: 'varchar', length: 120 })
  nom: string;

  /**
   * Description courte du type d'entreprise.
   * Affichée dans les formulaires d'inscription.
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Icône emoji ou classe FontAwesome.
   * Ex : "🍽️", "🏪", "💊"
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  icone: string | null;

  /**
   * Couleur hexadécimale associée au type.
   * Utilisée dans les badges et les chips UI.
   * Ex : "#059669"
   */
  @Column({ type: 'varchar', length: 7, nullable: true })
  couleur: string | null;

  /**
   * Ordre d'affichage dans les listes et les filtres.
   * Les types les plus courants ont un ordre plus bas.
   */
  @Column({ type: 'int', default: 0 })
  ordre: number;

  /**
   * Indique si ce type est actif (visible dans l'UI).
   * false = désactivé sans suppression (soft disable).
   */
  @Column({ type: 'boolean', default: true })
  actif: boolean;

  /* ==========================================================
   * RELATIONS
   * ========================================================== */

  /**
   * Catégories appartenant à ce type d'entreprise.
   *
   * Relation : CompanyType ──< Category
   *
   * Une catégorie appartient à UN SEUL type (ManyToOne côté Category).
   * Suppression du type → les catégories passent à null (SET NULL).
   *
   * Ex: type "Restaurant" → catégories ["Repas", "Boissons", "Desserts"]
   */
  @OneToMany(() => Category, cat => cat.companyType)
  categories: Category[];

  /**
   * Entreprises ayant ce type.
   *
   * Relation : CompanyType ──< Company
   *
   * Une entreprise a UN SEUL type (ManyToOne côté Company).
   */
  @OneToMany(() => Company, company => company.companyType)
  companies: Company[];

  /* ==========================================================
   * TIMESTAMPS
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}