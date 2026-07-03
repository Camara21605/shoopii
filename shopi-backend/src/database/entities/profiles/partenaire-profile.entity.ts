/* ============================================================
 * FICHIER : src/database/entities/profiles/partenaire-profile.entity.ts
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User } from '../user.entity';
import { Admin } from './admin-profile.entity';
import { Company } from './entreprise-profile.entity';
import { Delivery } from './livreur-profile.entity';
import { Correspondent } from './correspondant-profile.entity';
import { CreationCode } from '../code-creation.entity';

/* ============================================================
 * ENUM
 * ============================================================ */

export enum PartnerStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  SUSPENDED = 'suspended',
}

/* ============================================================
 * ENTITY PARTNER
 * ============================================================ */

@Entity('partenaires')
export class Partner {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ============================================================
   * USER
   * ============================================================ */

  @OneToOne(() => User, user => user.partner, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ name: 'userId', type: 'uuid' })
  userId!: string;

  /* ============================================================
   * CREATION CODE
   * ============================================================ */

  @ManyToOne(() => CreationCode, code => code.partner, {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'creationCodeId' })
  creationCode!: Promise<CreationCode> | CreationCode | null;

  @Column({
    name: 'creationCodeId',
    type: 'uuid',
    nullable: true,
    update: false,
  })
  creationCodeId!: string | null;

  /* ============================================================
   * ADMIN
   * ============================================================ */

  @ManyToOne(() => Admin, admin => admin.partners, {
    nullable: true,
    onDelete: 'SET NULL',
    lazy: true,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'adminId' })
  admin!: Promise<Admin> | Admin | null;

  @Column({ name: 'adminId', type: 'uuid', nullable: true })
  adminId!: string | null;

  /* ============================================================
   * RELATIONS ENFANTS
   * ============================================================ */

  @OneToMany(() => Company, company => company.partner)
  companies!: Company[];

  @OneToMany(() => Delivery, delivery => delivery.partner)
  deliveries!: Delivery[];

  @OneToMany(() => Correspondent, correspondent => correspondent.partner)
  correspondants!: Correspondent[];

  /* ============================================================
   * INFOS
   * ============================================================ */

  @Index()
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  zone!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  /* ── Localisation ── */
  @Column({ type: 'varchar', length: 500, nullable: true })
  adresse!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  commune!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  ville!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  region!: string | null;

  @Column({ type: 'varchar', length: 100, default: 'GN' })
  pays!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  codePostal!: string | null;

  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  latitude!: number | null;

  @Index()
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  longitude!: number | null;

  @Column({
    type: 'enum',
    enum: PartnerStatus,
    default: PartnerStatus.PENDING,
  })
  status!: PartnerStatus;

  /** Date de réactivation automatique (après désactivation temporaire) */
  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil!: Date | null;

  /* ============================================================
   * PROFIL ÉTENDU
   * ============================================================ */

  /** Bio / Présentation publique du partenaire */
  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  /* ============================================================
   * SÉCURITÉ — 2FA
   * ============================================================ */

  @Column({ type: 'boolean', default: false })
  twoFaEnabled!: boolean;

  /** 'sms' | 'app' | 'email' */
  @Column({ type: 'varchar', length: 20, nullable: true })
  twoFaMethod!: string | null;

  /* ============================================================
   * PRÉFÉRENCES (JSON sérialisé — pas de table séparée)
   * ============================================================ */

  /**
   * Préférences de notifications sérialisées en JSON.
   * Ex : {"notifActeurActive":true,"notifCommission":true,...}
   */
  @Column({ type: 'text', nullable: true })
  notifSettings!: string | null;

  /**
   * Paramètres de confidentialité sérialisés en JSON.
   * Ex : {"profilPublic":true,"afficherTelephone":true,...}
   */
  @Column({ type: 'text', nullable: true })
  privacySettings!: string | null;

  /**
   * Préférences UI sérialisées en JSON.
   * Ex : {"langue":"fr","apparence":"light"}
   */
  @Column({ type: 'text', nullable: true })
  preferences!: string | null;

  /* ============================================================
   * STATS
   * ============================================================ */

  @Column({ type: 'int', default: 0 })
  totalCompanies!: number;

  @Column({ type: 'int', default: 0 })
  totalDeliveries!: number;

  @Column({ type: 'int', default: 0 })
  totalCorrespondants!: number;

  /* ============================================================
   * TIMESTAMPS
   * ============================================================ */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}