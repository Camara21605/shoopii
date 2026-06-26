/* ============================================================
 * FICHIER : code-creation.entity.ts
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from './user.entity';
import { UserRole } from 'src/common/enums/user-role.enum';

import { Admin } from './profiles/admin-profile.entity';
import { Partner } from './profiles/partenaire-profile.entity';
import { Company } from './profiles/entreprise-profile.entity';
import { Delivery } from './profiles/livreur-profile.entity';
import { Correspondent } from './profiles/correspondant-profile.entity';

/* ============================================================
 * ENUM
 * ============================================================ */
export enum CodeStatus {
  PENDING = 'pending',
  USED = 'used',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Entity('creation_codes')
@Index(['targetRole'])
@Index(['status'])
@Index(['expiresAt'])
export class CreationCode {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ================= CODE ================= */

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column({ type: 'enum', enum: UserRole })
  targetRole: UserRole;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetEmail: string | null;

  /* ================= LIMITS ================= */

  @Column({ type: 'int' })
  validityDays: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  usedFromIp: string | null;

  @Column({ type: 'int', default: 1 })
  maxUses: number;

  @Column({ type: 'int', default: 0 })
  usesCount: number;

  @Column({ type: 'enum', enum: CodeStatus, default: CodeStatus.PENDING })
  status: CodeStatus;

  /* ================= AUTHOR ================= */

  @ManyToOne(() => User, user => user.generatedCodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'generatedById' })
  generatedBy: User;

  @Column({ type: 'varchar', length: 36 })
  generatedById: string;

  /* ================= USED BY ================= */

  @ManyToOne(() => User, user => user.usedCodes, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'usedById' })
  usedBy: User | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  usedById: string | null;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  /* ================= TARGET PROFILE ================= */

  @ManyToOne(() => Admin, { nullable: true })
  @JoinColumn({ name: 'adminId' })
  admin: Admin | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  adminId: string | null;

  @ManyToOne(() => Partner, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId: string | null;

  @ManyToOne(() => Company, { nullable: true })
  @JoinColumn({ name: 'companyId' })
  company: Company | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  companyId: string | null;

  @ManyToOne(() => Delivery, { nullable: true })
  @JoinColumn({ name: 'deliveryId' })
  delivery: Delivery | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  deliveryId: string | null;

  @ManyToOne(() => Correspondent, { nullable: true })
  @JoinColumn({ name: 'correspondentId' })
  correspondent: Correspondent | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  correspondentId: string | null;

  /* ================= SECURITY ================= */

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  verificationAttempts: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  /* ================= TIMESTAMPS ================= */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}