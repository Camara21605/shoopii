/* ============================================================
 * FICHIER      : src/database/entities/company-team/company-team-activity-log.entity.ts
 * MODULE       : Company Team
 * ROLE         : Journal d'activité d'un membre de l'équipe.
 *
 * RESPONSABILITES :
 *   - Historiser toutes les actions importantes d'un collaborateur.
 *   - Permettre au propriétaire de consulter l'activité de chaque membre.
 *   - Stocker les métadonnées contextuelles (IDs des ressources touchées).
 *
 * EXEMPLES D'ACTIONS :
 *   member.login        | member.logout
 *   product.created     | product.updated    | product.deleted
 *   order.validated     | order.cancelled
 *   message.sent
 *   settings.updated
 *
 * NOTE : Table append-only — jamais de UPDATE/DELETE.
 *        Rotation recommandée : archiver les entrées > 12 mois.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('company_team_activity_logs')
@Index('IDX_activity_member',  ['memberId'])
@Index('IDX_activity_company', ['companyId'])
@Index('IDX_activity_action',  ['action'])
@Index('IDX_activity_created', ['createdAt'])
export class CompanyTeamActivityLog {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** UUID du membre concerné (soft-deleted members conservent leur historique) */
  @Column({ type: 'uuid' })
  memberId!: string;

  /** UUID de l'entreprise (pour les requêtes d'audit global) */
  @Column({ type: 'uuid' })
  companyId!: string;

  /**
   * Code d'action en snake_case.
   * Format : <ressource>.<action>
   * Exemples : member.login, product.created, order.validated
   */
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  /** Description lisible par un humain */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  /**
   * Métadonnées contextuelles de l'action.
   * Ex : { productId: 'uuid', productName: 'T-shirt noir' }
   */
  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  /** Adresse IP de l'action (si disponible via X-Forwarded-For ou req.ip) */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
