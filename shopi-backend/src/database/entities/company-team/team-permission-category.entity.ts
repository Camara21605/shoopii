/* ============================================================
 * FICHIER      : src/database/entities/company-team/team-permission-category.entity.ts
 * MODULE       : Company Team
 * ROLE         : Catégorie de permissions d'équipe (système dynamique).
 *
 * RESPONSABILITES :
 *   - Groupe les permissions par domaine fonctionnel (Produits, Commandes…).
 *   - Permet d'ajouter de nouveaux domaines sans modifier le code source.
 *   - Utilisée par le frontend pour construire l'interface d'édition dynamique.
 *
 * ARCHITECTURE ÉVOLUTIVE :
 *   L'ajout d'un nouveau module (ex. "Entrepôt") se fait par INSERT en base,
 *   sans aucune modification du code ou des migrations existantes.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany, Index,
} from 'typeorm';

import { TeamPermissionDefinition } from './team-permission-definition.entity';

@Entity('team_permission_categories')
export class TeamPermissionCategory {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identifiant technique unique — ex. "products" */
  @Index({ unique: true })
  @Column({ length: 60 })
  slug!: string;

  /** Libellé affiché à l'utilisateur — ex. "Produits" */
  @Column({ length: 100 })
  label!: string;

  /** Classe Font Awesome — ex. "fa-tag" */
  @Column({ length: 60, nullable: true })
  icon?: string;

  /** Ordre d'affichage dans l'interface */
  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  /** Si false, la catégorie est masquée dans l'interface */
  @Column({ default: true })
  isActive!: boolean;

  /** Liste des actions disponibles dans cette catégorie */
  @OneToMany(() => TeamPermissionDefinition, def => def.category, { eager: false })
  definitions!: TeamPermissionDefinition[];
}
