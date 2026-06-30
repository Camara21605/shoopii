import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

import { Commande }  from '../commande/commande.entity';
import { Client }    from '../profiles/client-profile.entity';
import { Company }   from '../profiles/entreprise-profile.entity';
import { SavMessage } from './sav-message.entity';
import { ReturnPriority } from './return-request.entity';

export enum SavStatus {
  OPEN           = 'open',
  IN_PROGRESS    = 'in_progress',
  WAITING_CLIENT = 'waiting_client',
  RESOLVED       = 'resolved',
  CLOSED         = 'closed',
}

@Entity('sav_tickets')
export class SavTicket {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  reference!: string;

  /* ── Acteurs ── */

  @ManyToOne(() => Commande, { nullable: true, onDelete: 'SET NULL', lazy: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'commandeId' })
  commande!: Promise<Commande> | Commande | null;

  @Column({ name: 'commandeId', type: 'uuid', nullable: true })
  commandeId!: string | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL', lazy: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'clientId' })
  client!: Promise<Client> | Client | null;

  @Index()
  @Column({ name: 'clientId', type: 'uuid', nullable: true })
  clientId!: string | null;

  @ManyToOne(() => Company, { nullable: false, onDelete: 'CASCADE', lazy: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'companyId' })
  company!: Promise<Company> | Company;

  @Index()
  @Column({ name: 'companyId', type: 'uuid' })
  companyId!: string;

  /* ── Produit (optionnel) ── */

  @Column({ type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  productName!: string | null;

  /* ── Contenu ── */

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  firstMessage!: string;

  /* ── Statut ── */

  @Index()
  @Column({ type: 'enum', enum: SavStatus, default: SavStatus.OPEN })
  status!: SavStatus;

  @Column({ type: 'enum', enum: ReturnPriority, default: ReturnPriority.NORMAL })
  priority!: ReturnPriority;

  @Column({ type: 'uuid', nullable: true })
  assigneeId!: string | null;

  /* ── Compteurs ── */

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'int', default: 0 })
  unreadCount!: number;

  /* ── SLA ── */

  @Column({ type: 'int', nullable: true })
  responseTimeMinutes!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  firstResponseAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => SavMessage, m => m.ticket, { cascade: true, eager: false })
  messages!: SavMessage[];
}
