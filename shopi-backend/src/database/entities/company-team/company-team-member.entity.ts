/* ============================================================
 * FICHIER      : src/database/entities/company-team/company-team-member.entity.ts
 * MODULE       : Company Team
 * ROLE         : Représente un collaborateur (personnel) d'une entreprise.
 *
 * RESPONSABILITES :
 *   - Lier un compte utilisateur (User) à une entreprise (Company).
 *   - Stocker le statut, le poste, le rôle interne et l'activité du membre.
 *   - Permettre la suspension et la réactivation sans supprimer le compte.
 *
 * DESIGN :
 *   - Chaque collaborateur possède son propre compte User (role: 'company').
 *   - Il n'a PAS d'entité Company propre (≠ propriétaire).
 *   - Le lien owner→company se fait via User.company (OneToOne existant).
 *   - Le lien staff→company se fait via ce CompanyTeamMember.companyId.
 *   - Le login détecte automatiquement l'entreprise via findProfileId().
 *
 * RELATIONS :
 *   - ManyToOne User   (le compte du collaborateur)
 *   - OneToOne  CompanyTeamPermission (ses permissions)
 *
 * INDEX :
 *   - IDX_team_member_company (companyId) — liste rapide des membres
 *   - IDX_team_member_user   (userId)     — lookup login
 *   - UNIQUE (userId, companyId)          — un user ne peut être membre qu'une fois
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  Index, Unique,
} from 'typeorm';
import { User } from '../user.entity';
import { CompanyTeamPermission } from './company-team-permission.entity';

/* ── Statut du membre dans l'équipe ──────────────────────────── */
export enum TeamMemberStatus {
  /** Membre actif — accès complet selon ses permissions */
  ACTIVE    = 'active',
  /** Suspendu temporairement — ne peut pas se connecter au dashboard */
  SUSPENDED = 'suspended',
  /** Invitation envoyée, compte non activé */
  PENDING   = 'pending',
  /** Accès définitivement révoqué (soft-deleted) */
  REVOKED   = 'revoked',
}

/* ── Rôles internes prédéfinis (organisationnels, non liés aux permissions) ── */
export enum InternalTeamRole {
  MANAGER              = 'manager',
  COMMERCIAL           = 'commercial',
  ORDER_MANAGER        = 'order_manager',
  LOGISTICS_MANAGER    = 'logistics_manager',
  CUSTOMER_SERVICE     = 'customer_service',
  ACCOUNTANT           = 'accountant',
  CUSTOM               = 'custom',
}

/* ──────────────────────────────────────────────────────────────
 * ENTITY
 * ────────────────────────────────────────────────────────────── */

@Entity('company_team_members')
@Index('IDX_team_member_company', ['companyId'])
@Index('IDX_team_member_user',    ['userId'])
@Index('IDX_team_member_status',  ['status'])
@Unique('UNIQ_team_member_user_company', ['userId', 'companyId'])
export class CompanyTeamMember {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── Compte utilisateur du collaborateur ── */

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  /** UUID du compte utilisateur (User.id) */
  @Column({ type: 'uuid' })
  userId!: string;

  /* ── Entreprise propriétaire ── */

  /**
   * UUID de l'entreprise (Company.id) à laquelle appartient ce membre.
   * Pas de FK déclarée pour éviter les dépendances circulaires à l'import.
   * L'intégrité est garantie par la logique applicative.
   */
  @Column({ type: 'uuid' })
  companyId!: string;

  /* ── Statut ── */

  @Column({ type: 'enum', enum: TeamMemberStatus, default: TeamMemberStatus.ACTIVE })
  status!: TeamMemberStatus;

  /* ── Informations professionnelles ── */

  /** Poste occupé (ex: "Responsable des ventes") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  jobTitle!: string | null;

  /**
   * Rôle organisationnel interne.
   * Sert uniquement à l'affichage et à l'organisation — n'affecte pas les permissions.
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  internalRole!: string | null;

  /* ── Activité ── */

  /** Dernière connexion au dashboard — mis à jour à chaque login réussi */
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt!: Date | null;

  /** Adresse IP de la dernière connexion */
  @Column({ type: 'varchar', length: 45, nullable: true })
  lastLoginIp!: string | null;

  /* ── Suspension ── */

  /** Date de suspension du compte */
  @Column({ type: 'timestamp', nullable: true })
  suspendedAt!: Date | null;

  /** Motif de suspension (visible par le propriétaire) */
  @Column({ type: 'text', nullable: true })
  suspensionReason!: string | null;

  /* ── Réinitialisation de mot de passe ── */

  /**
   * Mot de passe temporaire en clair — stocké UNIQUEMENT le temps d'être
   * affiché une fois au propriétaire et envoyé par email.
   * Mis à null immédiatement après l'envoi.
   * select: false → jamais retourné par SELECT *
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  temporaryPassword!: string | null;

  /** true si le membre doit changer son mot de passe à la prochaine connexion */
  @Column({ type: 'boolean', default: true })
  mustChangePassword!: boolean;

  /* ── Relation permissions ── */

  @OneToOne(() => CompanyTeamPermission, perm => perm.member, {
    cascade: true,
    eager: false,
  })
  permission!: CompanyTeamPermission;

  /* ── Timestamps ── */

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /** Soft delete — le membre est conservé pour l'historique */
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
