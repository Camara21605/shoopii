import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

import {
  FollowerActorType,
  TargetActorType,
} from './follow.entity';

/* ============================================================
 * ENUM
 * ============================================================ */

export enum FollowRequestStatus {
  PENDING = 'pending',

  ACCEPTED = 'accepted',

  DECLINED = 'declined',

  CANCELLED = 'cancelled',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Unique('UQ_follow_request_pair', [
  'requesterType',
  'requesterId',
  'targetType',
  'targetId',
])

@Index('IDX_follow_request_requester', [
  'requesterType',
  'requesterId',
])

@Index('IDX_follow_request_target', [
  'targetType',
  'targetId',
])

@Entity('follow_requests')
export class FollowRequest {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * DEMANDEUR
   * ========================================================== */

  @Column({
    type: 'enum',
    enum: FollowerActorType,
  })
  requesterType: FollowerActorType;

  @Column({
    type: 'uuid',
  })
  requesterId: string;

  /* ==========================================================
   * CIBLE
   * ========================================================== */

  @Column({
    type: 'enum',
    enum: TargetActorType,
  })
  targetType: TargetActorType;

  @Column({
    type: 'uuid',
  })
  targetId: string;

  /* ==========================================================
   * ÉTAT
   * ========================================================== */

  @Column({
    type: 'enum',
    enum: FollowRequestStatus,
    default: FollowRequestStatus.PENDING,
  })
  status: FollowRequestStatus;

  /* ==========================================================
   * MESSAGE OPTIONNEL
   * ========================================================== */

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  message: string | null;

  /* ==========================================================
   * DATES
   * ========================================================== */

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  respondedAt: Date | null;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;
}