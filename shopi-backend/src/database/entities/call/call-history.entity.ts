/* ============================================================
 * FICHIER : src/database/entities/call/call-history.entity.ts
 *
 * Archive permanente d'un appel terminé. Écrite une seule fois,
 * à la toute fin de l'appel (copie depuis Call juste avant que
 * la ligne active ne soit supprimée). Source de GET /calls/history.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';
import { CallType } from './call.entity';

export enum CallHistoryStatus {
  COMPLETED = 'completed',
  MISSED    = 'missed',
  REJECTED  = 'rejected',
  BUSY      = 'busy',
}

@Entity('call_history')
export class CallHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Référence de l'appel d'origine (table `calls`, déjà supprimée à ce stade) — traçabilité uniquement. */
  @Column({ type: 'uuid' })
  callId: string;

  @Index()
  @Column({ type: 'uuid' })
  callerId: string;

  @Index()
  @Column({ type: 'uuid' })
  calleeId: string;

  @Column({ type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ type: 'enum', enum: CallType, default: CallType.AUDIO })
  callType: CallType;

  @Column({ type: 'enum', enum: CallHistoryStatus })
  status: CallHistoryStatus;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  answeredAt: Date | null;

  @Index()
  @Column({ type: 'timestamp' })
  endedAt: Date;

  /** Secondes — 0 si jamais décroché. */
  @Column({ type: 'int', default: 0 })
  duration: number;

  @CreateDateColumn()
  createdAt: Date;
}
