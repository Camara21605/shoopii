/* ============================================================
 * FICHIER      : src/database/entities/company-team/company-team-permission.entity.ts
 * MODULE       : Company Team
 * ROLE         : Permissions granulaires d'un membre de l'équipe entreprise.
 *
 * RESPONSABILITES :
 *   - Stocker les permissions en JSON pour une extensibilité maximale.
 *   - Permettre l'ajout de nouveaux groupes/actions sans migration DB.
 *   - Garantir une relation OneToOne avec CompanyTeamMember.
 *
 * DESIGN :
 *   L'interface TeamPermissions est la source de vérité.
 *   Pour ajouter une nouvelle permission (ex: promotions.create) :
 *     1. Ajouter le champ dans TeamPermissions
 *     2. Mettre à jour DEFAULT_TEAM_PERMISSIONS avec false
 *     3. Aucune migration DB nécessaire
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, JoinColumn, UpdateDateColumn,
} from 'typeorm';
import { CompanyTeamMember } from './company-team-member.entity';

/* ──────────────────────────────────────────────────────────────
 * INTERFACE — Structure des permissions
 * Extensible sans migration : ajouter un champ = déployer le code
 * ────────────────────────────────────────────────────────────── */
export interface TeamPermissions {
  /** Gestion du catalogue produits */
  products: {
    view:   boolean;  /** Voir les produits */
    create: boolean;  /** Créer un produit */
    edit:   boolean;  /** Modifier un produit */
    delete: boolean;  /** Supprimer un produit */
  };
  /** Gestion des commandes */
  orders: {
    view:     boolean;  /** Voir les commandes */
    validate: boolean;  /** Valider une commande */
    cancel:   boolean;  /** Annuler une commande */
    edit:     boolean;  /** Modifier une commande */
  };
  /** Gestion des livraisons */
  deliveries: {
    view:   boolean;  /** Voir les livraisons */
    assign: boolean;  /** Affecter un livreur */
    edit:   boolean;  /** Modifier une livraison */
  };
  /** Finances et paiements */
  payments: {
    view:             boolean;  /** Voir les données financières */
    viewTransactions: boolean;  /** Consulter les transactions */
    manageRefunds:    boolean;  /** Gérer les remboursements */
  };
  /** Messagerie interne */
  messaging: {
    read: boolean;  /** Lire les messages */
    send: boolean;  /** Envoyer des messages */
  };
  /** Statistiques et analytics */
  statistics: {
    view: boolean;  /** Voir les statistiques */
  };
  /** Paramètres de la boutique */
  settings: {
    view: boolean;  /** Voir les paramètres */
    edit: boolean;  /** Modifier les paramètres */
  };
  /** Gestion de l'équipe (personnel) */
  team: {
    view:    boolean;  /** Voir l'équipe */
    create:  boolean;  /** Ajouter un membre */
    edit:    boolean;  /** Modifier un membre */
    suspend: boolean;  /** Suspendre un membre */
    delete:  boolean;  /** Supprimer un membre */
  };
  /** Gestion des promotions */
  promotions: {
    view:   boolean;
    create: boolean;
    edit:   boolean;
    delete: boolean;
  };
  /** Gestion des retours et SAV */
  returns: {
    view:    boolean;
    process: boolean;
  };
}

/**
 * Permissions par défaut pour un nouveau membre : tout à false.
 * Le propriétaire choisit explicitement ce qu'il accorde.
 */
export const DEFAULT_TEAM_PERMISSIONS: TeamPermissions = {
  products:   { view: false, create: false, edit: false, delete: false },
  orders:     { view: false, validate: false, cancel: false, edit: false },
  deliveries: { view: false, assign: false, edit: false },
  payments:   { view: false, viewTransactions: false, manageRefunds: false },
  messaging:  { read: false, send: false },
  statistics: { view: false },
  settings:   { view: false, edit: false },
  team:       { view: false, create: false, edit: false, suspend: false, delete: false },
  promotions: { view: false, create: false, edit: false, delete: false },
  returns:    { view: false, process: false },
};

/* ──────────────────────────────────────────────────────────────
 * ENTITY
 * ────────────────────────────────────────────────────────────── */

@Entity('company_team_permissions')
export class CompanyTeamPermission {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /* ── Relation membre ── */

  @OneToOne(() => CompanyTeamMember, member => member.permission, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'memberId' })
  member!: CompanyTeamMember;

  /** UUID du membre propriétaire de ces permissions */
  @Column({ type: 'uuid' })
  memberId!: string;

  /**
   * Permissions stockées en JSON.
   * Structure définie par l'interface TeamPermissions.
   * Extensible sans migration — ajouter un champ = déployer le code.
   */
  @Column({ type: 'json' })
  permissions!: TeamPermissions;

  @UpdateDateColumn()
  updatedAt!: Date;
}
