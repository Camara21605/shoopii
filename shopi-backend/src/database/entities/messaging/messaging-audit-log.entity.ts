/* ============================================================
 * FICHIER : messaging-audit-log.entity.ts
 *
 * RÔLE : Table d'audit immuable (append-only) qui enregistre
 *        chaque décision du MessagingPermissionEngine.
 *
 * POURQUOI :
 *   - Traçabilité légale et anti-abus
 *   - Détecter les patterns suspects (flood de tentatives)
 *   - Débugger les règles de permission en production
 *   - Fournir des métriques sur l'utilisation de la messagerie
 *
 * DESIGN :
 *   - Jamais de UPDATE ni DELETE (table append-only)
 *   - Partitionnement par date recommandé en prod (> 100M lignes/an)
 *   - Index sur (requestorType, requestorId, created_at) pour
 *     détecter les floods par utilisateur
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

export enum AuditDecision {
  GRANTED = 'GRANTED',
  DENIED  = 'DENIED',
}

@Index('IDX_audit_requestor', ['requestorType', 'requestorId'])
@Index('IDX_audit_target',    ['targetType',    'targetId'])
@Index('IDX_audit_decision',  ['decision', 'createdAt'])
@Index('IDX_audit_created',   ['createdAt'])
@Entity('messaging_audit_logs')
export class MessagingAuditLog {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* Qui demande à créer la conversation */
  @Column({ type: 'varchar', length: 30 })
  requestorType: string;

  @Column({ type: 'uuid' })
  requestorId: string;

  /* Vers qui */
  @Column({ type: 'varchar', length: 30 })
  targetType: string;

  @Column({ type: 'uuid' })
  targetId: string;

  /* Décision finale du moteur */
  @Column({ type: 'enum', enum: AuditDecision })
  decision: AuditDecision;

  /* Raison lisible (ex: "Aucune commande commune", "Contact mutuel confirmé") */
  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  /* Nom de l'évaluateur qui a pris la décision */
  @Column({ type: 'varchar', length: 100, nullable: true })
  evaluator: string | null;

  /* Performance : durée de l'évaluation en millisecondes */
  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  /* true = résultat lu depuis le cache Redis (pas de DB hit) */
  @Column({ type: 'boolean', default: false })
  cached: boolean;

  /* IP de l'appelant (pour détecter les abus) */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /* userId JWT de l'appelant (users.id) */
  @Column({ type: 'uuid', nullable: true })
  callerUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
