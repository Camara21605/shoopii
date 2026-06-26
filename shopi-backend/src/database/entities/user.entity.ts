/* ============================================================
 * FICHIER : src/database/entities/user.entity.ts
 * RÔLE    : Table principale des utilisateurs Shopi
 *
 * AJOUTS vs version originale (6 nouveaux champs OTP) :
 *   - resetOtpHash         → hash bcrypt du code OTP 6 chiffres
 *   - resetOtpExpiry       → expiration de l'OTP (10 min)
 *   - resetOtpAttempts     → tentatives incorrectes (max 3)
 *   - resetOtpRequestedAt  → timestamp dernière demande OTP
 *   - resetOtpRequestCount → compteur de demandes (rate limiting)
 *   - lastPasswordChangedAt→ invalide les JWT antérieurs au changement
 *
 * Tout le reste est identique à la structure originale.
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  Index,
  Unique,
  DeleteDateColumn,
} from 'typeorm';

import { Admin }        from './profiles/admin-profile.entity';
import { Partner }      from './profiles/partenaire-profile.entity';
import { Company }      from './profiles/entreprise-profile.entity';
import { Delivery }     from './profiles/livreur-profile.entity';
import { Correspondent} from './profiles/correspondant-profile.entity';
import { Client }       from './profiles/client-profile.entity';
import { CreationCode } from './code-creation.entity';
import { Wallet }       from './wallet.entity';
import { Localisation } from './localisation.entity';

import { UserRole } from 'src/common/enums/user-role.enum';

/* ============================================================
 * ENUM STATUS UTILISATEUR
 * ============================================================ */
export enum UserStatus {
  ACTIVE    = 'active',
  PENDING   = 'pending',
  SUSPENDED = 'suspended',
  BANNED    = 'banned',
}

/* ============================================================
 * ENTITY USER
 * ============================================================ */

@Entity('users')
@Index('IDX_user_role', ['role'])
@Index('IDX_user_status', ['status'])
@Unique('UNIQ_user_email', ['email'])
export class User {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * IDENTITÉ
   * ========================================================== */

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  /** Code pays ISO-2 détecté via l'indicatif téléphonique (ex : "GN") */
  @Column({ type: 'varchar', length: 3, nullable: true })
  countryCode: string | null;

  /** Nom du pays détecté (ex : "Guinée") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  countryName: string | null;

  /** Indicatif international (ex : "+224") */
  @Column({ type: 'varchar', length: 10, nullable: true })
  dialCode: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  username: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  /* ==========================================================
   * SÉCURITÉ LOGIN (champs originaux inchangés)
   * ========================================================== */

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp: string | null;

  /* ==========================================================
   * RÉINITIALISATION MOT DE PASSE — OTP (NOUVEAUX CHAMPS)
   *
   * Ces 6 champs gèrent le flux "mot de passe oublié" :
   *   1. forgotPassword()  → génère l'OTP, stocke resetOtpHash
   *   2. verifyOtp()       → vérifie, efface le hash
   *   3. resetPassword()   → met à jour le MDP
   *
   * Le hash est stocké avec bcrypt (jamais le code brut).
   * Le code brut est uniquement envoyé par email.
   * ========================================================== */

  /**
   * Hash bcrypt du code OTP à 6 chiffres.
   * null → pas d'OTP en cours.
   * Effacé immédiatement après vérification réussie.
   * select: false → jamais retourné dans les queries SELECT *
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  resetOtpHash: string | null;

  /**
   * Date d'expiration du code OTP (10 minutes après génération).
   * null → pas d'OTP en cours.
   */
  @Column({ type: 'timestamp', nullable: true })
  resetOtpExpiry: Date | null;

  /**
   * Nombre de tentatives de saisie incorrectes pour l'OTP actuel.
   * Réinitialisé à 0 à chaque nouveau code.
   * Au-delà de 3 → l'OTP est automatiquement invalidé.
   */
  @Column({ type: 'int', default: 0 })
  resetOtpAttempts: number;

  /**
   * Timestamp de la dernière demande d'OTP.
   * Utilisé pour le rate limiting :
   *   max 3 demandes par fenêtre de 15 minutes.
   */
  @Column({ type: 'timestamp', nullable: true })
  resetOtpRequestedAt: Date | null;

  /**
   * Nombre de demandes dans la fenêtre active.
   * Réinitialisé automatiquement si la fenêtre de 15 min est dépassée.
   */
  @Column({ type: 'int', default: 0 })
  resetOtpRequestCount: number;

  /**
   * Date du dernier changement de mot de passe.
   * Permet d'invalider les JWT émis AVANT cette date.
   * (Implémenter dans JwtStrategy si besoin de déconnexion forcée.)
   */
  @Column({ type: 'timestamp', nullable: true })
  lastPasswordChangedAt: Date | null;

  /* ==========================================================
   * PROFILS MÉTIER (inchangés)
   * ========================================================== */

  @OneToOne(() => Admin, admin => admin.user, { nullable: true })
  admin: Admin | null;

  @OneToOne(() => Partner, partner => partner.user, { nullable: true })
  partner: Partner | null;

  @OneToOne(() => Company, company => company.user, { nullable: true })
  company: Company | null;

  @OneToOne(() => Delivery, delivery => delivery.user, { nullable: true })
  delivery: Delivery | null;

  @OneToOne(() => Correspondent, c => c.user, { nullable: true })
  correspondent: Correspondent | null;

  @OneToOne(() => Client, client => client.user, { nullable: true })
  client: Client | null;

  /* ==========================================================
   * WALLET (inchangé)
   * ========================================================== */

  @OneToOne(() => Wallet, wallet => wallet.user, { nullable: true })
  wallet: Wallet | null;

  /* ==========================================================
   * LOCALISATIONS (inchangé)
   * ========================================================== */

  @OneToMany(() => Localisation, localisation => localisation.user)
  localisations!: Localisation[];

  /* ==========================================================
   * CODES D'INVITATION (inchangés)
   * ========================================================== */

  @OneToMany(() => CreationCode, code => code.generatedBy)
  generatedCodes: CreationCode[];

  @OneToMany(() => CreationCode, code => code.usedBy)
  usedCodes: CreationCode[];

  /* ==========================================================
   * SOFT DELETE (inchangé)
   * ========================================================== */

  @DeleteDateColumn()
  deletedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profilePicture: string | null;

  /* ==========================================================
   * TIMESTAMPS (inchangés)
   * ========================================================== */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}