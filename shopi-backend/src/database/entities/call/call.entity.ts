/* ============================================================
 * FICHIER : src/database/entities/call/call.entity.ts
 *
 * Appel ACTIF uniquement (ringing → connecting → connected).
 * Dès que l'appel se termine (peu importe le motif), la ligne est
 * copiée dans CallHistory puis supprimée d'ici — cette table ne
 * contient jamais que les appels en cours, ce qui en fait aussi
 * l'outil de vérification "cet utilisateur est-il déjà en appel ?".
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallStatus {
  RINGING    = 'ringing',
  CONNECTING = 'connecting',
  CONNECTED  = 'connected',
}

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ type: 'enum', enum: CallStatus, default: CallStatus.RINGING })
  status: CallStatus;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  answeredAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
