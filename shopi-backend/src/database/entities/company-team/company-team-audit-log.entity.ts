/* ============================================================
 * FICHIER      : src/database/entities/company-team/company-team-audit-log.entity.ts
 * MODULE       : Company Team
 * ROLE         : Journal d'audit des actions d'administration de l'équipe.
 *
 * RESPONSABILITES :
 *   - Enregistrer TOUTES les modifications effectuées sur les membres.
 *   - Stocker l'état avant/après pour permettre un audit complet.
 *   - Enregistrer l'IP, le navigateur et le résultat de chaque action.
 *
 * DIFFÉRENCE AVEC activity_log :
 *   activity_log = ce que fait un MEMBRE dans son travail quotidien
 *   audit_log    = ce que fait le PROPRIÉTAIRE pour gérer son équipe
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('company_team_audit_logs')
@Index('IDX_ct_audit_company',   ['companyId'])
@Index('IDX_ct_audit_performer', ['performedByUserId'])
@Index('IDX_ct_audit_target',    ['targetMemberId'])
@Index('IDX_ct_audit_created',   ['createdAt'])
export class CompanyTeamAuditLog {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** UUID de l'entreprise */
  @Column({ type: 'uuid' })
  companyId!: string;

  /** UUID de l'utilisateur qui a réalisé l'action (propriétaire ou gestionnaire autorisé) */
  @Column({ type: 'uuid' })
  performedByUserId!: string;

  /** UUID du membre ciblé par l'action (null pour les actions globales) */
  @Column({ type: 'uuid', nullable: true })
  targetMemberId!: string | null;

  /**
   * Action réalisée.
   * Exemples :
   *   team.member.created   | team.member.deleted
   *   team.member.suspended | team.member.reactivated
   *   team.permission.updated
   *   team.password.reset
   */
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  /** État de la ressource AVANT l'action (null pour les créations) */
  @Column({ type: 'json', nullable: true })
  before!: Record<string, unknown> | null;

  /** État de la ressource APRÈS l'action (null pour les suppressions) */
  @Column({ type: 'json', nullable: true })
  after!: Record<string, unknown> | null;

  /** Adresse IP de l'auteur de l'action */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  /** User-Agent du navigateur */
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null;

  /** true si l'action a réussi, false en cas d'erreur */
  @Column({ type: 'boolean', default: true })
  success!: boolean;

  /** Message d'erreur en cas d'échec */
  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
