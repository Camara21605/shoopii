/* ============================================================
 * FICHIER : src/database/entities/profiles/client-profile.entity.ts
 *
 * CHAMPS AJOUTÉS par rapport à l'ancienne version :
 *   - Profil étendu : genre, bio, langue
 *   - Adresses de livraison (JSON)
 *   - Moyens de paiement (JSON)
 *   - Shopi Points + niveau + expiration
 *   - Sécurité : 2FA, questions, codes de secours
 *   - Sessions actives (JSON)
 *   - Journal d'activité (JSON)
 *   - Appareils de confiance (JSON)
 *   - Préférences : notifs, privacy, apparence, langue/devise/timezone
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

import { User }        from '../user.entity';
import { ProductLike } from '../entreprise.table/product-like.entity';

// ─── ENUMS ───────────────────────────────────────────────────

export enum ClientStatus {
  ACTIVE    = 'active',
  INACTIVE  = 'inactive',
  SUSPENDED = 'suspended',
  DELETED   = 'deleted',
  BANNED    = 'banned',
}

export enum ClientGenre {
  HOMME       = 'homme',
  FEMME       = 'femme',
  AUTRE       = 'autre',
  NON_PRECISE = 'non_precise',
}

export enum ClientTheme {
  CLAIR  = 'clair',
  SOMBRE = 'sombre',
  AUTO   = 'auto',
}

export enum ClientTextSize {
  NORMAL     = 'normal',
  GRAND      = 'grand',
  TRES_GRAND = 'tres_grand',
}

export enum ClientImageQuality {
  HAUTE      = 'haute',
  ECONOMIQUE = 'economique',
}

// ─────────────────────────────────────────────────────────────
// ENTITÉ PRINCIPALE
// ─────────────────────────────────────────────────────────────

@Entity('clients')
export class Client {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ══════════════════════════════════════════════════════════
  // RELATION USER
  // ══════════════════════════════════════════════════════════

  @OneToOne(() => User, user => user.client, {
    nullable: false,
    onDelete: 'CASCADE',
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ name: 'userId', type: 'varchar', length: 36, update: false })
  userId: string;

  // ══════════════════════════════════════════════════════════
  // STATUT COMPTE
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'enum', enum: ClientStatus, default: ClientStatus.ACTIVE })
  status: ClientStatus;

  // ══════════════════════════════════════════════════════════
  // SECTION 1 — PROFIL ÉTENDU
  // (prénom/nom/email/phone/avatar sont dans User)
  // ══════════════════════════════════════════════════════════

  /** Nom complet dénormalisé pour les recherches rapides */
  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  fullName: string | null;

  @Column({ type: 'date', nullable: true })
  dateNaissance: Date | null;

  @Column({ type: 'enum', enum: ClientGenre, nullable: true })
  genre: ClientGenre | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  bio: string | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 2 — ADRESSES DE LIVRAISON (JSON)
  // Format : [{ id, nom, fullName, adresse, commune, ville, phone, isDefault }]
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'json', nullable: true })
  adresses: string | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 3 — MOYENS DE PAIEMENT (JSON)
  // Format : [{ id, type, numero, isDefault, addedAt }]
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'json', nullable: true })
  paymentMethods: string | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 4 — SHOPI POINTS
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'int', default: 0 })
  shopiPoints: number;

  @Column({ type: 'int', default: 0 })
  pointsGagnesMois: number;

  @Column({ type: 'int', default: 0 })
  pointsUtilises: number;

  @Column({ type: 'date', nullable: true })
  pointsExpiration: Date | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 5 — SÉCURITÉ
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'boolean', default: false })
  twoFaEnabled: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  twoFaMethod: string | null;   // 'sms' | 'totp' | 'fido2'

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  twoFaSecret: string | null;   // secret TOTP (ne jamais exposer)

  /**
   * Questions de sécurité
   * Format JSON : [{ question: string, reponse: string (haché) }]
   */
  @Column({ type: 'json', nullable: true })
  questionsSecurite: string | null;

  /**
   * Nombre de codes de secours restants (décompte public)
   */
  @Column({ type: 'int', default: 0 })
  codesSecours: number;

  /**
   * Codes de secours hachés (ne jamais exposer)
   * Format JSON : string[] (bcrypt hash)
   */
  @Column({ type: 'json', nullable: true, select: false })
  codesSecoursHashed: string | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 6 — SESSIONS ACTIVES (JSON)
  // Format : [{ id, device, browser, os, ip, location, lastSeen, isCurrent, suspect? }]
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'json', nullable: true })
  sessions: string | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 7 — JOURNAL D'ACTIVITÉ (JSON)
  // Format : [{ type, title, meta[], ip?, time }]
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'json', nullable: true })
  activityLog: string | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 8 — APPAREILS DE CONFIANCE (JSON)
  // Format : [{ id, name, type, location, lastUsed, addedAt }]
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'json', nullable: true })
  trustedDevices: string | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 9 — NOTIFICATIONS (JSON 14 toggles)
  // Format : { commandes:{sms,email,push}, promos:{...}, ... }
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'json', nullable: true })
  notifSettings: object | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 10 — CONFIDENTIALITÉ (JSON 7 toggles)
  // Format : { historique, wishlist, perso, localisation, pubs }
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'json', nullable: true })
  privacySettings: object | null;

  // ══════════════════════════════════════════════════════════
  // SECTION 11 — APPARENCE
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'enum', enum: ClientTheme, default: ClientTheme.CLAIR })
  theme: ClientTheme;

  @Column({ type: 'enum', enum: ClientTextSize, default: ClientTextSize.NORMAL })
  textSize: ClientTextSize;

  @Column({ type: 'enum', enum: ClientImageQuality, default: ClientImageQuality.HAUTE })
  imageQuality: ClientImageQuality;

  // ══════════════════════════════════════════════════════════
  // SECTION 12 — LANGUE & RÉGION
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  langue: string;

  @Column({ type: 'varchar', length: 10, default: 'GNF' })
  devise: string;

  @Column({ type: 'varchar', length: 20, default: 'GMT+0' })
  timezone: string;

  // ══════════════════════════════════════════════════════════
  // STATISTIQUES
  // ══════════════════════════════════════════════════════════

  @Column({ type: 'int', default: 0 })
  totalOrders: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalSpent: number;

  @Column({ type: 'int', default: 0 })
  totalFavorites: number;

  // ══════════════════════════════════════════════════════════
  // RELATIONS
  // ══════════════════════════════════════════════════════════

  @OneToMany(() => ProductLike, like => like.client)
  likes: ProductLike[];

  // ══════════════════════════════════════════════════════════
  // TIMESTAMPS
  // ══════════════════════════════════════════════════════════

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}