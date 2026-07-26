/* ============================================================
 * FICHIER      : src/database/entities/company-team/team-permission-template.entity.ts
 * MODULE       : Company Team
 * ROLE         : Modèle de permissions réutilisable.
 *
 * RESPONSABILITES :
 *   - Stocke un ensemble de permissions prêt à appliquer à un collaborateur.
 *   - Deux types :
 *       • Système (isSystem = true, companyId = null) — créés par migration
 *       • Personnalisés (isSystem = false, companyId défini) — créés par le propriétaire
 *   - L'application d'un modèle écrase les permissions existantes du membre.
 *   - Le modèle peut ensuite être personnalisé individuellement.
 *
 * MODÈLES SYSTÈME PRÉ-DÉFINIS (seedés par migration) :
 *   - Gestionnaire   : toutes les permissions de gestion
 *   - Commercial     : produits + promotions + clients
 *   - Service Client : messagerie + commandes (vue) + retours
 *   - Logistique     : livraisons + commandes (vue)
 *   - Comptable      : finances + statistiques + portefeuille
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('team_permission_templates')
export class TeamPermissionTemplate {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Si null → modèle système disponible pour toutes les entreprises.
   * Si défini → modèle personnalisé créé par cette entreprise.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  companyId?: string;

  /** Libellé du modèle — ex. "Responsable des ventes" */
  @Column({ length: 100 })
  name!: string;

  /** Description du rôle couvert par ce modèle */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Permissions du modèle.
   * Format identique aux permissions du membre :
   * { products: { view: true, create: false, ... }, orders: { ... }, ... }
   */
  @Column({ type: 'json' })
  permissions!: Record<string, Record<string, boolean>>;

  /** true = modèle fourni par le système (non modifiable par l'entreprise) */
  @Column({ default: false })
  isSystem!: boolean;

  /** Utilisateur qui a créé le modèle (null pour les modèles système) */
  @Column({ type: 'uuid', nullable: true })
  createdByUserId?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
