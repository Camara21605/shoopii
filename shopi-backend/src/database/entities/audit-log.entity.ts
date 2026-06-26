/* ============================================================
 * FICHIER : src/database/entities/audit-log.entity.ts
 *
 * Journal d'audit — trace les actions sensibles effectuées
 * par les admins / super-admins (blocage, suspension, etc.)
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

@Entity('audit_logs')
@Index('IDX_audit_log_createdAt', ['createdAt'])
export class AuditLog {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ── Acteur ── */
  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 255 })
  actorName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorEmail: string | null;

  /* ── Action ── */
  @Column({ type: 'varchar', length: 8 })
  icon: string;

  @Column({ type: 'text' })
  action: string;

  /* ── Cible (optionnelle) ── */
  @Column({ type: 'varchar', length: 50, nullable: true })
  targetType: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  targetId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
