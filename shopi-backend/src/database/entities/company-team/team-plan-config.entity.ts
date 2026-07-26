/* ============================================================
 * FICHIER      : src/database/entities/company-team/team-plan-config.entity.ts
 * MODULE       : Company Team
 * ROLE         : Configuration des limites de collaborateurs par plan d'abonnement.
 *
 * RESPONSABILITES :
 *   - Stocke les limites de membres autorisés selon le plan.
 *   - Permet au Super Admin de reconfigurer sans toucher au code.
 *   - maxMembers = -1 signifie "illimité" (plan Enterprise).
 *
 * RÈGLE MÉTIER :
 *   - Chaque planSlug est unique dans la table.
 *   - Si aucune assignation n'est trouvée pour une entreprise,
 *     on utilise PlatformSettings.maxTeamMembersPerCompany en fallback.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/** Plans d'abonnement disponibles */
export enum CompanyPlan {
  FREE       = 'free',
  STANDARD   = 'standard',
  BUSINESS   = 'business',
  PREMIUM    = 'premium',
  ENTERPRISE = 'enterprise',
}

@Entity('team_plan_configs')
export class TeamPlanConfig {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identifiant unique du plan — ex. "business" */
  @Column({ type: 'enum', enum: CompanyPlan, unique: true })
  planSlug!: CompanyPlan;

  /** Libellé affiché — ex. "Plan Business" */
  @Column({ length: 100 })
  name!: string;

  /**
   * Nombre maximum de membres autorisés.
   * -1 = illimité (plan Enterprise).
   */
  @Column({ type: 'int', default: 5 })
  maxMembers!: number;

  /** Description marketing du plan */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /** Fonctionnalités incluses (JSON) — extensible sans migration */
  @Column({ type: 'json', nullable: true })
  features?: Record<string, boolean>;

  /** Si false, ce plan n'est plus proposé aux nouvelles entreprises */
  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
