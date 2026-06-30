import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { ReturnRequest } from './return-request.entity';

@Entity('return_history')
export class ReturnHistory {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ReturnRequest, r => r.history, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'returnRequestId' })
  returnRequest!: ReturnRequest;

  @Column({ name: 'returnRequestId', type: 'uuid' })
  returnRequestId!: string;

  /** Action effectuée : 'created', 'accepted', 'refused', 'refunded', 'note_added', 'evidence_uploaded', etc. */
  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actorName!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'enterprise' })
  actorRole!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
