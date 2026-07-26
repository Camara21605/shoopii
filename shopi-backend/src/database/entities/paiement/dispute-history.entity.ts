/* ============================================================
 * FICHIER : src/database/entities/paiement/dispute-history.entity.ts
 *
 * RÔLE    : Journal immuable de toutes les transitions d'état
 *           d'un litige (Dispute). Chaque ligne est créée une
 *           seule fois et jamais modifiée ni supprimée.
 *
 * PLACEMENT
 * ─────────────────────────────────────────────────────────────
 * src/database/entities/paiement/dispute-history.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { DisputeStatus } from './dispute.entity';

export enum DisputeActorRole {
  CLIENT = 'CLIENT',
  ADMIN  = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

@Index('IDX_dispute_history_dispute',    ['disputeId'])
@Index('IDX_dispute_history_created_at', ['createdAt'])
@Entity('dispute_history')
export class DisputeHistory {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  disputeId: string;

  /** Statut avant la transition (null à l'ouverture). */
  @Column({ type: 'varchar', length: 50, nullable: true })
  fromStatus: DisputeStatus | null;

  /** Statut cible après la transition. */
  @Column({ type: 'varchar', length: 50 })
  toStatus: DisputeStatus;

  /** UserId de l'acteur qui a déclenché la transition. */
  @Column({ type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  actorRole: DisputeActorRole | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
