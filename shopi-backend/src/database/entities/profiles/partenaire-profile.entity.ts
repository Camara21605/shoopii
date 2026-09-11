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
import { Company, VerificationStatus } from './entreprise-profile.entity';
import { Delivery } from './livreur-profile.entity';
import { Correspondent } from './correspondant-profile.entity';
import { CreationCode } from '../code-creation.entity';

export { VerificationStatus };

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

  @Index()
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

  /* ── Références géo structurées (résolues depuis ville/pays ci-dessus) ──
   * ville/pays sont du texte libre saisi par l'acteur — non fiable pour
   * filtrer (ex: portée support d'un admin par communauté géo assignée).
   * paysId/villeId sont peuplées par GeoResolutionService (rapprochement
   * nom → référentiel geo_pays/geo_prefectures), en une fois au moment de
   * la création/mise à jour du profil ou via le recalcul manuel super-admin
   * — jamais par correspondance de texte à la lecture. Pas de FK formelle
   * (même convention que paysAssigne/zoneId sur Admin). */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  paysId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  villeId!: string | null;

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

  /**
   * Secret TOTP — chiffré au repos (AES-256-GCM, voir totp-crypto.util.ts).
   *
   * BUG CORRIGÉ — `select: false` manquait ici alors que les 5 autres rôles
   * (Admin, Company, Delivery, Correspondent, Client) l'ont tous : ce champ
   * était chargé par défaut sur CHAQUE `partnerRepo.findOne(...)` (profil,
   * paramètres, etc.), pas seulement là où TwoFaService en a besoin.
   *
   * Longueur portée à 255 (était 64) — le format chiffré ("v1:" + base64
   * de iv+authTag+ciphertext) fait ~83 caractères pour un secret standard
   * de 20 octets, largement au-delà de l'ancienne limite.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  twoFaSecret!: string | null;

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
   * DOCUMENTS & VÉRIFICATION KYC
   *
   * Stocke uniquement le public_id Cloudinary (jamais une URL), comme
   * Company.ownerIdDocument/documentRccm/documentBancaire — voir
   * DocumentsParametresService (module entreprise), pattern répliqué ici.
   * CNI + justificatif de domicile sont obligatoires : voir la garde de
   * retrait dans WalletService.applyOperation() qui bloque le retrait de
   * commission tant que ces deux documents ne sont pas fournis.
   * ============================================================ */

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentCni!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentDomicile!: string | null;

  /** Justificatif d'activité — optionnel, ne bloque jamais le retrait. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  documentActivite!: string | null;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus!: VerificationStatus;

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
   * LIEN DE PARRAINAGE
   *
   * Slug stable, généré paresseusement (voir ProfilPartenaireService.
   * getParametres()) à la première consultation de la section
   * "Parrainage" — jamais régénéré ensuite, pour que le lien déjà
   * partagé par le partenaire reste valide. Résolu publiquement par
   * PublicController.resolveReferral() (GET /public/rejoindre/:slug),
   * qui incrémente referralClicks à chaque visite, puis par
   * AuthService.register() (champ RegisterDto.referralSlug) pour
   * rattacher le nouvel acteur à ce partenaire — même rattachement que
   * les codes de création, sans code à saisir.
   * ============================================================ */

  @Index({ unique: true, where: '"referralSlug" IS NOT NULL' })
  @Column({ type: 'varchar', length: 64, nullable: true })
  referralSlug!: string | null;

  @Column({ type: 'int', default: 0 })
  referralClicks!: number;

  /* ============================================================
   * TIMESTAMPS
   * ============================================================ */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}