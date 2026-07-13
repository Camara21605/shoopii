/* ============================================================
 * FICHIER : src/database/entities/profiles/livreur-profile.entity.ts
 *
 * ✅ AJOUTS PAR RAPPORT À LA VERSION PRÉCÉDENTE :
 *   - whatsapp     → numéro WhatsApp (utilisé sur le profil public)
 *   - ponctualite  → % de ponctualité affiché sur les cards livreurs
 *
 * Ces 2 champs sont requis par LivreursClientService (page /livreurs).
 * Tout le reste est INCHANGÉ.
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User }           from '../user.entity';
import { CreationCode }   from '../code-creation.entity';
import { Company }        from './entreprise-profile.entity';
import { Partner }        from './partenaire-profile.entity';
import { Admin }          from './admin-profile.entity';
import { Correspondent }  from './correspondant-profile.entity';
import { LivreurHoraire } from '../livreur.table/livreur-horaire.entity';

/* ============================================================
 * ENUMS
 * ============================================================ */

export enum DeliveryStatus {
  PENDING   = 'pending',
  ACTIVE    = 'active',
  SUSPENDED = 'suspended',
  BANNED    = 'banned',
}

export enum DeliveryAvailability {
  AVAILABLE   = 'available',
  ON_DELIVERY = 'on_delivery',
  OFFLINE     = 'offline',
}

export enum VehicleType {
  MOTO     = 'moto',
  VOITURE  = 'voiture',
  VELO     = 'velo',
  TRICYCLE = 'tricycle',
  CAMION   = 'camion',
  PIETON   = 'pieton',
}

export enum LivreurVerificationStatus {
  PENDING   = 'pending',
  REVIEWING = 'reviewing',
  VERIFIED  = 'verified',
  REJECTED  = 'rejected',
}

export { DeliveryStatus as LivreurStatus };


/* ============================================================
 * ENTITY
 * ============================================================ */

@Entity('livreurs')
export class Delivery {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── User ── */
  @OneToOne(() => User, user => user.delivery, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Index({ unique: true })
  @Column({ name: 'userId', type: 'uuid' })
  userId!: string;

  /* ── Code d'invitation ── */
  @OneToOne(() => CreationCode, code => code.delivery, {
    nullable: true, onDelete: 'SET NULL', lazy: true, createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'creationCodeId' })
  creationCode!: Promise<CreationCode> | CreationCode | null;

  @Column({ name: 'creationCodeId', type: 'uuid', nullable: true })
  creationCodeId!: string | null;

  /* ── Superviseurs ── */
  @ManyToOne(() => Company,      c => c.deliveries, { nullable: true, onDelete: 'SET NULL', lazy: true })
  @JoinColumn({ name: 'companyId' })
  company!: Promise<Company> | Company | null;

  @Column({ name: 'companyId', type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => Partner,      p => p.deliveries, { nullable: true, onDelete: 'SET NULL', lazy: true })
  @JoinColumn({ name: 'partnerId' })
  partner!: Promise<Partner> | Partner | null;

  @Column({ name: 'partnerId', type: 'uuid', nullable: true })
  partnerId!: string | null;

  @ManyToOne(() => Admin,        a => a.deliveries, { nullable: true, onDelete: 'SET NULL', lazy: true })
  @JoinColumn({ name: 'adminId' })
  admin!: Promise<Admin> | Admin | null;

  @Column({ name: 'adminId', type: 'uuid', nullable: true })
  adminId!: string | null;

  /* ── Correspondants ── */
  @OneToMany(() => Correspondent, c => c.delivery)
  correspondants!: Correspondent[];

  /* ── Horaires (relation, PAS du JSON) ── */
  @OneToMany(() => LivreurHoraire, h => h.livreur, { cascade: true })
  horaires!: LivreurHoraire[];

  /* ══════════════════════════════════════════════════════════
   * INFOS PERSONNELLES
   * ══════════════════════════════════════════════════════════ */

  @Index()
  @Column({ type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photoUrl!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  /**
   * ✅ AJOUTÉ — Numéro WhatsApp du livreur.
   * Affiché sur le profil public pour permettre au client
   * d'ouvrir une conversation WhatsApp directement.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsapp!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  /** Langues parlées, séparées par virgules. Ex : "Français, Soussou, Malinké" */
  @Column({ type: 'varchar', length: 255, nullable: true })
  langues!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ville!: string | null;

  @Column({ type: 'varchar', length: 10, default: '🛵' })
  deliveryEmoji!: string;

  /* ══════════════════════════════════════════════════════════
   * VÉHICULE
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'enum', enum: VehicleType, default: VehicleType.MOTO })
  VehicleType!: VehicleType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehiculePlaque!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  vehiculePhotoUrl!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vehiculeMarque!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  vehiculeModele!: string | null;

  @Column({ type: 'int', nullable: true })
  vehiculeAnnee!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  vehiculeCouleur!: string | null;

  @Column({ type: 'varchar', length: 20, default: '20kg' })
  vehiculeCapacite!: string;

  @Column({ type: 'json', nullable: true })
  colisAcceptes!: string[] | null;

  /* ══════════════════════════════════════════════════════════
   * ZONE & LOCALISATION
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'varchar', length: 255, nullable: true })
  zone!: string | null;

  @Column({ type: 'int', nullable: true })
  radiusKm!: number | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lastLatitude!: number | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lastLongitude!: number | null;

  /** Type de livraison : entre_pays | entre_villes | entre_prefectures | entre_regions | entre_communes | entre_quartiers */
  @Column({ type: 'varchar', length: 30, nullable: true })
  deliveryType!: string | null;

  /** Date à laquelle le type de livraison a été choisi — verrouillage 6 mois */
  @Column({ type: 'timestamp', nullable: true })
  deliveryTypeSetAt!: Date | null;

  /** Zones desservies (noms du niveau choisi). Ex : ["Kaloum", "Dixinn"] */
  @Column({ type: 'json', nullable: true })
  communesActives!: string[] | null;

  /** Sous-ensemble de communesActives où le livreur est disponible en ce moment */
  @Column({ type: 'json', nullable: true })
  zonesDisponibles!: string[] | null;

  @Column({ type: 'int', default: 25 })
  distanceMax!: number;

  @Column({ type: 'json', nullable: true })
  autoDispoSettings!: Record<string, boolean> | null;

  /* ══════════════════════════════════════════════════════════
   * STATUT & DISPONIBILITÉ
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING })
  status!: DeliveryStatus;

  /**
   * Date de réactivation automatique après une désactivation volontaire (J+30).
   * NULL = pas de désactivation temporaire en cours.
   * Le cron ExpiryCronService lit ce champ pour réactiver automatiquement.
   */
  @Column({ type: 'timestamp', nullable: true })
  suspendedUntil!: Date | null;

  @Column({ type: 'enum', enum: DeliveryAvailability, default: DeliveryAvailability.OFFLINE })
  availability!: DeliveryAvailability;

  /* ══════════════════════════════════════════════════════════
   * DOCUMENTS & VÉRIFICATION
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentCni!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentPermis!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentAssurance!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  documentCasier!: string | null;

  @Column({
    type: 'enum',
    enum: LivreurVerificationStatus,
    default: LivreurVerificationStatus.PENDING,
  })
  verificationStatus!: LivreurVerificationStatus;

  /* Anciens champs documents — conservés pour compatibilité */
  @Column({ type: 'varchar', length: 500, nullable: true })
  idDocumentUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  driverLicenseUrl!: string | null;

  /* ══════════════════════════════════════════════════════════
   * VITESSES & TARIFICATION
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'json', nullable: true })
  vitessesActives!: Record<string, boolean> | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 15000 })
  tarifBase!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1500 })
  tarifParKm!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 5000 })
  supplementLourd!: number;

  @Column({ type: 'int', default: 30 })
  majorationNocturne!: number;

  /* ══════════════════════════════════════════════════════════
   * PAIEMENT
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'json', nullable: true })
  methodesRetrait!: Record<string, unknown>[] | null;

  @Column({ type: 'varchar', length: 30, default: 'weekly' })
  virementFrequence!: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 50000 })
  virementSeuil!: number;

  /* ══════════════════════════════════════════════════════════
   * SÉCURITÉ (2FA)
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'boolean', default: false })
  twoFaEnabled!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  twoFaMethod!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, select: false })
  twoFaSecret!: string | null;

  /* ══════════════════════════════════════════════════════════
   * NOTIFICATIONS & CONFIDENTIALITÉ
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'json', nullable: true })
  notifSettings!: Record<string, boolean> | null;

  @Column({ type: 'json', nullable: true })
  privacySettings!: Record<string, boolean> | null;

  /* ══════════════════════════════════════════════════════════
   * STATISTIQUES
   * ══════════════════════════════════════════════════════════ */

  @Column({ type: 'int', default: 0 })
  totalDeliveries!: number;

  @Column({ type: 'int', default: 0 })
  successfulDeliveries!: number;

  @Column({ type: 'int', default: 0 })
  failedDeliveries!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating!: number;

  @Column({ type: 'int', default: 0 })
  totalRatings!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalEarnings!: number;

  /**
   * ✅ AJOUTÉ — Taux de ponctualité en pourcentage (0–100).
   * Affiché sur les cards et le profil public.
   * Calculé périodiquement : livraisons à l'heure / total livraisons.
   */
  @Column({ type: 'int', default: 95 })
  ponctualite!: number;

  /* ══════════════════════════════════════════════════════════
   * TIMESTAMPS
   * ══════════════════════════════════════════════════════════ */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}