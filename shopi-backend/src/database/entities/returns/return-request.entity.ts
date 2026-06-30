/* ============================================================
 * FICHIER : src/database/entities/returns/return-request.entity.ts
 * RÔLE    : Entité principale des demandes de retour produit.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

import { Commande }  from '../commande/commande.entity';
import { Client }    from '../profiles/client-profile.entity';
import { Company }   from '../profiles/entreprise-profile.entity';
import { ReturnEvidence } from './return-evidence.entity';
import { ReturnHistory }  from './return-history.entity';

/* ── Enums ─────────────────────────────────────────────── */

export enum ReturnReason {
  DEFECTIVE    = 'defective',
  NOT_MATCHING = 'not_matching',
  CHANGE_OF_MIND = 'change_of_mind',
  WRONG_ITEM   = 'wrong_item',
  DAMAGED      = 'damaged',
  EXPIRED      = 'expired',
  OTHER        = 'other',
}

export enum ReturnStatus {
  PENDING    = 'pending',
  ACCEPTED   = 'accepted',
  REFUSED    = 'refused',
  IN_TRANSIT = 'in_transit',
  RECEIVED   = 'received',
  REFUNDED   = 'refunded',
  EXCHANGED  = 'exchanged',
  CLOSED     = 'closed',
}

export enum ReturnType {
  REFUND   = 'refund',
  EXCHANGE = 'exchange',
  REPAIR   = 'repair',
  CREDIT   = 'credit',
}

export enum ReturnPriority {
  LOW    = 'low',
  NORMAL = 'normal',
  HIGH   = 'high',
  URGENT = 'urgent',
}

/* ── Entité ─────────────────────────────────────────────── */

@Entity('return_requests')
export class ReturnRequest {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  reference!: string;

  /* ── Relations acteurs ── */

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

  /* ── Snapshot produit ── */

  @Column({ name: 'productId', type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  productName!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  productImage!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  productVariant!: string | null;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  /* ── Financier ── */

  @Column({ type: 'bigint' })
  montantDemande!: number;

  @Column({ type: 'bigint', nullable: true })
  montantAccorde!: number | null;

  /* ── Détails retour ── */

  @Column({ type: 'enum', enum: ReturnReason })
  reason!: ReturnReason;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ReturnType, default: ReturnType.REFUND })
  returnType!: ReturnType;

  @Index()
  @Column({ type: 'enum', enum: ReturnStatus, default: ReturnStatus.PENDING })
  status!: ReturnStatus;

  @Column({ type: 'enum', enum: ReturnPriority, default: ReturnPriority.NORMAL })
  priority!: ReturnPriority;

  /* ── Notes ── */

  @Column({ type: 'text', nullable: true })
  noteInterne!: string | null;

  @Column({ type: 'text', nullable: true })
  noteClient!: string | null;

  /* ── Assignation ── */

  @Column({ type: 'uuid', nullable: true })
  assigneeId!: string | null;

  /* ── Dates d'action ── */

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refusedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  receivedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refundedAt!: Date | null;

  /* ── Timestamps ── */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /* ── Relations ── */

  @OneToMany(() => ReturnEvidence, e => e.returnRequest, { cascade: true, eager: false })
  evidences!: ReturnEvidence[];

  @OneToMany(() => ReturnHistory, h => h.returnRequest, { cascade: true, eager: false })
  history!: ReturnHistory[];
}
