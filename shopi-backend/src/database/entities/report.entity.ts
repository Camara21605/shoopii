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
  PENDING       = 'pending',
  INVESTIGATING = 'investigating',
  RESOLVED      = 'resolved',
  /* AJOUTÉ — le frontend (admin comme partenaire) affichait déjà un statut
   * "Rejeté" distinct (ST.rejected / SignalementStatut='rejected'), mais
   * "Classer sans suite" appelait resolveSignalement() : un signalement
   * dismissé sans fondement portait donc EXACTEMENT le même statut RESOLVED
   * qu'un signalement réellement traité (avertissement/suspension) — les
   * deux étaient indiscernables en base. */
  REJECTED      = 'rejected',
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

  @Column({ type: 'uuid', nullable: true })
  reporterId: string | null;

  /* ── Utilisateur visé par le signalement (optionnel) ── */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: User | null;

  @Column({ type: 'uuid', nullable: true })
  targetUserId: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @Column({ type: 'uuid', nullable: true })
  resolvedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  /**
   * true si un admin a confirmé ce signalement comme fondé contre le
   * compte visé (voir AdminSignalementsService.warnSignalement) — par
   * opposition à un signalement simplement "résolu" (classé sans suite,
   * infondé…). Seuls les signalements `founded=true` comptent pour
   * PlatformSettings.reportsBeforeSuspend : compter n'importe quel
   * signalement résolu permettrait à un tiers de faire suspendre un
   * compte avec de faux signalements en masse.
   */
  @Column({ type: 'boolean', default: false })
  founded: boolean;

  @Column({ type: 'timestamp', nullable: true })
  foundedAt: Date | null;

  /** Motif optionnel saisi par l'admin lors d'un rejet (ReportStatus.REJECTED). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
