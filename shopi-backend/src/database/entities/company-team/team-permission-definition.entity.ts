/* ============================================================
 * FICHIER      : src/database/entities/company-team/team-permission-definition.entity.ts
 * MODULE       : Company Team
 * ROLE         : Définition d'une action de permission (grain fin).
 *
 * RESPONSABILITES :
 *   - Décrit chaque action autorisable — ex. "products.create".
 *   - Slug format : "{category}.{action}" (ex. "orders.validate").
 *   - Valeur par défaut configurable : false = refusé par défaut.
 *   - Peut être désactivée sans supprimer la définition (soft disable).
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';

import { TeamPermissionCategory } from './team-permission-category.entity';

@Entity('team_permission_definitions')
export class TeamPermissionDefinition {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Référence à la catégorie parente */
  @Column({ type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => TeamPermissionCategory, cat => cat.definitions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category!: TeamPermissionCategory;

  /**
   * Slug unique de l'action — format : "{category}.{action}".
   * Exemples : "products.create", "orders.validate", "wallet.withdraw"
   */
  @Index({ unique: true })
  @Column({ length: 80 })
  slug!: string;

  /** Libellé affiché dans l'interface — ex. "Créer des produits" */
  @Column({ length: 150 })
  label!: string;

  /** Description longue de l'action (pour tooltip ou documentation) */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Valeur par défaut lorsqu'un membre est créé sans template.
   * false = permission refusée par défaut (principe du moindre privilège).
   */
  @Column({ default: false })
  defaultValue!: boolean;

  /** Ordre dans la catégorie */
  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  /** Si false, cette action n'apparaît plus dans l'interface */
  @Column({ default: true })
  isActive!: boolean;
}
