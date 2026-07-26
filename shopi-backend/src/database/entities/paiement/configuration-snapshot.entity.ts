/* ============================================================
 * FICHIER      : src/database/entities/paiement/configuration-snapshot.entity.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Snapshot versionné de chaque modification apportée
 *                à un groupe de paramètres financiers de PlatformSettings.
 *                Constitue le registre d'audit de toutes les règles métier.
 * RESPONSABILITES :
 *   - Stocker l'état avant/après (JSON) de chaque modification
 *   - Numéroter les versions par section pour permettre le rollback
 *   - Conserver l'auteur, la justification, l'IP pour conformité légale
 *   - Ne jamais être modifié ou supprimé (immuabilité)
 * DEPENDANCES  : aucune (entité autonome)
 * UTILISE PAR  :
 *   FinancialConfigWriterService → crée les snapshots
 *   FinancialConfigHistoryService → lit les snapshots
 *   FinancialConfigEngine → expose via getHistory / rollbackToVersion
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/* ============================================================
 * ENUM — Sections de configuration financière
 * ============================================================ */

/**
 * Identifiant de la section de PlatformSettings concernée.
 *
 * Chaque section regroupe des champs thématiquement cohérents.
 * Permet de filtrer l'historique par domaine fonctionnel.
 */
export enum ConfigSection {
  /** Taux de commission produit/livraison, ratios de répartition, multiplicateurs de plan */
  COMMISSION  = 'commission',
  /** Providers de paiement activés, montants min/max, délais, mode test */
  PAYMENT     = 'payment',
  /** Limites de wallet, plafonds, délais de disponibilité des fonds */
  WALLET      = 'wallet',
  /** Durée d'escrow, validation automatique, comportement à expiration */
  ESCROW      = 'escrow',
  /** Fenêtre de litige, catégories, délais de traitement, remboursement auto */
  DISPUTE     = 'dispute',
  /** Retrait min/max, validation automatique/manuelle, méthodes, tentatives */
  SETTLEMENT  = 'settlement',
  /** Nom de plateforme, devise, langue, timezone, mode maintenance */
  GENERAL     = 'general',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

/**
 * Index sur section + version pour récupérer rapidement l'historique
 * par section dans l'ordre chronologique.
 */
@Index('IDX_config_snapshot_section_version', ['section', 'version'])
@Index('IDX_config_snapshot_performed_by', ['performedByUserId'])
@Index('IDX_config_snapshot_created_at', ['createdAt'])

@Entity('configuration_snapshots')
export class ConfigurationSnapshot {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  /** UUID unique de ce snapshot. Immuable. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * CLASSIFICATION
   * ========================================================== */

  /**
   * Section de configuration concernée.
   * Ex : COMMISSION, WALLET, ESCROW…
   */
  @Column({ type: 'enum', enum: ConfigSection })
  section: ConfigSection;

  /**
   * Numéro de version au sein de cette section.
   * Incrémenté de +1 à chaque modification de la section.
   * Permet d'identifier et restaurer un état précis.
   */
  @Column({ type: 'int', default: 1 })
  version: number;

  /**
   * Libellé optionnel donné par l'admin pour identifier ce changement.
   * Ex : "Ajustement commissions Q3 2026", "Activation Orange Money"
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  label: string | null;

  /* ==========================================================
   * CHAMPS MODIFIÉS
   * ========================================================== */

  /**
   * Liste des noms de colonnes de PlatformSettings qui ont changé.
   * Ex : ['tauxCommissionProduit', 'planMultiplierPro']
   * Permet d'afficher un diff lisible sans parser le JSON brut.
   */
  @Column({ type: 'simple-array' })
  changedFields: string[];

  /* ==========================================================
   * ÉTAT AVANT / APRÈS
   * ========================================================== */

  /**
   * Valeurs AVANT la modification, filtrées aux champs modifiés.
   * JSON. Ex : { tauxCommissionProduit: 6, planMultiplierPro: 0.75 }
   * NULL uniquement pour la version initiale (création de la plateforme).
   */
  @Column({ type: 'json', nullable: true })
  before: Record<string, unknown> | null;

  /**
   * Valeurs APRÈS la modification.
   * JSON. Ex : { tauxCommissionProduit: 7, planMultiplierPro: 0.8 }
   */
  @Column({ type: 'json' })
  after: Record<string, unknown>;

  /* ==========================================================
   * JUSTIFICATION
   * ========================================================== */

  /**
   * Raison obligatoire fournie par l'admin pour ce changement.
   * Conservée pour la conformité légale et l'auditabilité.
   * Ex : "Rééquilibrage suite accord partenaire Q3 2026"
   */
  @Column({ type: 'text' })
  justification: string;

  /* ==========================================================
   * MÉTADONNÉES D'ACTEUR
   * ========================================================== */

  /**
   * UUID du Super Admin ayant effectué la modification.
   * NULL uniquement si la modification est système (bootstrap).
   */
  @Column({ type: 'uuid', nullable: true })
  performedByUserId: string | null;

  /**
   * Rôle de l'auteur au moment de la modification.
   * Snapshot — le rôle peut changer après cette date.
   * Ex : 'super_admin', 'admin', 'system'
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  performedByRole: string | null;

  /**
   * Adresse IP de l'auteur si disponible.
   * NULL pour les modifications système/cron.
   */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /* ==========================================================
   * FLAG ROLLBACK
   * ========================================================== */

  /**
   * Indique si ce snapshot est lui-même le résultat d'un rollback.
   * Permet de distinguer les changements intentionnels des restaurations.
   */
  @Column({ type: 'boolean', default: false })
  isRollback: boolean;

  /**
   * Si isRollback = true, version source depuis laquelle on a restauré.
   * Ex : version = 5 issu d'un rollback vers version = 3 → rolledBackToVersion = 3
   */
  @Column({ type: 'int', nullable: true })
  rolledBackToVersion: number | null;

  /* ==========================================================
   * DATE (immuable)
   * ========================================================== */

  /**
   * Date et heure exactes de la modification.
   * Immuable — pas d'UpdateDateColumn sur cette entité.
   */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
