/* ============================================================
 * FICHIER      : src/database/entities/company-team/company-plan-assignment.entity.ts
 * MODULE       : Company Team
 * ROLE         : Assignation d'un plan d'abonnement à une entreprise spécifique.
 *
 * RESPONSABILITES :
 *   - Permet au Super Admin d'assigner un plan par entreprise.
 *   - Un seul plan actif par entreprise (contrainte unique sur companyId).
 *   - Pas de FK sur Company — évite les dépendances circulaires.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { CompanyPlan } from './team-plan-config.entity';

@Entity('company_plan_assignments')
export class CompanyPlanAssignment {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identifiant de l'entreprise (Company.id) — contrainte unique */
  @Index({ unique: true })
  @Column({ type: 'uuid' })
  companyId!: string;

  /** Plan assigné à cette entreprise */
  @Column({ type: 'enum', enum: CompanyPlan, default: CompanyPlan.STANDARD })
  planSlug!: CompanyPlan;

  /** Admin qui a fait l'assignation (nullable = auto ou seed) */
  @Column({ type: 'uuid', nullable: true })
  assignedByAdminId?: string;

  /** Note d'administration (ex. "Passé en Business suite à ticket #xxx") */
  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
