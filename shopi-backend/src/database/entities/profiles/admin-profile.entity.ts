/* ============================================================
 * FICHIER : src/database/entities/profiles/admin-profile.entity.ts
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User } from '../user.entity';
import { CreationCode } from '../code-creation.entity';
import { Partner } from './partenaire-profile.entity';
import { Company } from './entreprise-profile.entity';
import { Delivery } from './livreur-profile.entity';

// ─── ENUM ────────────────────────────────────────────────────

export enum AdminStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  SUSPENDED = 'suspended',
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ
// ─────────────────────────────────────────────────────────────

@Entity('admins')
export class Admin {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── USER RELATION ──────────────────────────────────────────

  /**
   * Compte utilisateur lié (role = ADMIN)
   */
  @OneToOne(() => User, user => user.admin, {
    nullable: false,
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * FK userId
   *
   * ✔ FIX IMPORTANT :
   * suppression de insert: false
   * sinon TypeORM ne peut pas créer l’admin correctement
   */
  @Column({
    name: 'userId',
    type: 'uuid',
    update: false,
  })
  userId: string;

  // ── CODE INVITATION ────────────────────────────────────────

  @OneToOne(() => CreationCode, code => code.admin, {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'creationCodeId' })
  creationCode: Promise<CreationCode> | CreationCode | null;

  @Column({
    name: 'creationCodeId',
    type: 'uuid',
    nullable: true,
  })
  creationCodeId: string | null;

  // ── RELATIONS MÉTIER ───────────────────────────────────────

  /**
   * Partenaires supervisés
   */
  @OneToMany(() => Partner, partner => partner.admin)
  partners: Partner[];

  /**
   * Entreprises supervisées
   */
  @OneToMany(() => Company, company => company.admin)
  companies: Company[];

  /**
   * Livreurs supervisés
   */
  @OneToMany(() => Delivery, delivery => delivery.admin)
  deliveries: Delivery[];

  // ── INFORMATIONS ───────────────────────────────────────────

  @Index()
  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  zone: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({
    type: 'enum',
    enum: AdminStatus,
    default: AdminStatus.PENDING,
  })
  status: AdminStatus;

  /**
   * Permissions accordées à cet admin (modules accessibles).
   * Clés possibles : partners, companies, delivery, customers,
   * stats, reports, notifs, support.
   */
  @Column({ type: 'json', nullable: true })
  permissions: Record<string, boolean> | null;

  // ── STATISTIQUES ───────────────────────────────────────────

  @Column({ type: 'int', default: 0 })
  totalPartners: number;

  @Column({ type: 'int', default: 0 })
  totalCompanies: number;

  @Column({ type: 'int', default: 0 })
  totalDeliveries: number;

  // ── TIMESTAMPS ─────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}