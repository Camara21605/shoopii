/* ============================================================
 * FICHIER : src/database/entities/report.entity.ts
 *
 * Signalements (alertes) — un utilisateur, un produit ou le
 * système peut signaler un comportement suspect. Le super-admin
 * traite la file dans la section "Signalements".
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User } from './user.entity';

export enum ReportSeverity {
  CRITICAL = 'critical',
  WARNING  = 'warning',
  INFO     = 'info',
}

export enum ReportStatus {
  PENDING  = 'pending',
  RESOLVED = 'resolved',
}

@Entity('reports')
@Index('IDX_report_status', ['status'])
export class Report {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReportSeverity, default: ReportSeverity.WARNING })
  severity: ReportSeverity;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /* ── Utilisateur ayant signalé (optionnel — peut être le système) ── */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'reporterId' })
  reporter: User | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  reporterId: string | null;

  /* ── Utilisateur visé par le signalement (optionnel) ── */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  targetUserId: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  resolvedById: string | null;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
