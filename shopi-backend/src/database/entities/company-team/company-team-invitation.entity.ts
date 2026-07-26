/* ============================================================
 * FICHIER      : src/database/entities/company-team/company-team-invitation.entity.ts
 * MODULE       : Company Team
 * ROLE         : Invitation d'un collaborateur à rejoindre l'équipe entreprise.
 *
 * RESPONSABILITES :
 *   - Stocke un jeton unique + date d'expiration par invitation.
 *   - Le collaborateur crée son mot de passe lors de l'acceptation.
 *   - Une invitation expirée ou annulée ne peut pas être ré-utilisée.
 *   - Supporte l'envoi d'un templateId pour pré-charger les permissions.
 *
 * CYCLE DE VIE :
 *   pending → accepted (lien cliqué, compte créé)
 *   pending → cancelled (propriétaire annule)
 *   pending → expired  (job cron ou vérification au moment du clic)
 *
 * SÉCURITÉ :
 *   - Le token est 64 caractères hexadécimaux (32 octets aléatoires).
 *   - Valide 48 heures par défaut.
 *   - Index unique sur token pour éviter les collisions.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/** Cycle de vie d'une invitation */
export enum InvitationStatus {
  PENDING   = 'pending',
  ACCEPTED  = 'accepted',
  EXPIRED   = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('company_team_invitations')
export class CompanyTeamInvitation {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Entreprise qui émet l'invitation */
  @Index()
  @Column({ type: 'uuid' })
  companyId!: string;

  /** Email de la personne invitée */
  @Index()
  @Column({ length: 255 })
  email!: string;

  @Column({ length: 100, nullable: true })
  firstName?: string;

  @Column({ length: 100, nullable: true })
  lastName?: string;

  @Column({ length: 100, nullable: true })
  jobTitle?: string;

  @Column({ length: 50, nullable: true })
  internalRole?: string;

  /**
   * Jeton unique de 64 caractères hexadécimaux.
   * Généré avec crypto.randomBytes(32).toString('hex').
   */
  @Index({ unique: true })
  @Column({ length: 64, select: false })
  token!: string;

  /** Date d'expiration — 48h après création */
  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING })
  status!: InvitationStatus;

  /** Permissions pré-configurées à appliquer lors de l'acceptation */
  @Column({ type: 'json', nullable: true })
  initialPermissions?: Record<string, Record<string, boolean>>;

  /** Référence optionnelle à un modèle de permissions */
  @Column({ type: 'uuid', nullable: true })
  templateId?: string;

  /** Utilisateur propriétaire qui a créé l'invitation */
  @Column({ type: 'uuid' })
  createdByUserId!: string;

  /** Date à laquelle l'invitation a été acceptée */
  @Column({ type: 'timestamp', nullable: true })
  acceptedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
