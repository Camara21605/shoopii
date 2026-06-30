import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { SavTicket } from './sav-ticket.entity';

@Entity('sav_messages')
export class SavMessage {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SavTicket, t => t.messages, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'ticketId' })
  ticket!: SavTicket;

  @Column({ name: 'ticketId', type: 'uuid' })
  ticketId!: string;

  @Column({ type: 'text' })
  content!: string;

  /** 'client' | 'enterprise' | 'admin' */
  @Column({ type: 'varchar', length: 20 })
  senderRole!: string;

  @Column({ type: 'uuid' })
  senderId!: string;

  @Column({ type: 'varchar', length: 255 })
  senderName!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  senderAvatar!: string | null;

  @Column({ type: 'json', nullable: true })
  attachments!: { url: string; name: string; type: string; size?: number }[] | null;

  @Column({ type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
