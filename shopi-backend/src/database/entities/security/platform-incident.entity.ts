/* ============================================================
 * FICHIER      : src/database/entities/security/platform-incident.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Suivi du cycle de vie des incidents opérationnels de Shopi.
 * Un incident est tout événement ayant un impact réel ou potentiel
 * sur la disponibilité, la sécurité ou la fiabilité de la plateforme.
 *
 * MACHINE À ÉTATS
 * ─────────────────────────────────────────────────────────────
 * OPEN → INVESTIGATING → MITIGATED → RESOLVED → CLOSED
 *                      ↘ (optionnel) POST_MORTEM → CLOSED
 *
 * NIVEAUX DE SÉVÉRITÉ (PriorityLevels)
 * ─────────────────────────────────────────────────────────────
 * P1_CRITICAL — Service totalement indisponible (paiements, wallets)
 * P2_HIGH     — Dégradation majeure (>50% utilisateurs impactés)
 * P3_MEDIUM   — Dégradation partielle (fonctionnalité secondaire)
 * P4_LOW      — Impact mineur, workaround disponible
 *
 * RESPONSABILITÉS POST-MORTEM
 * ─────────────────────────────────────────────────────────────
 * Les P1 et P2 DOIVENT faire l'objet d'un post-mortem documenté
 * (rootCause + remediation) avant la clôture.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/* ============================================================
 * ENUMS
 * ============================================================ */

export enum IncidentSeverity {
  /** Service totalement indisponible — réponse immédiate 24/7 */
  P1_CRITICAL = 'p1_critical',
  /** Impact majeur sur les utilisateurs — réponse dans l'heure */
  P2_HIGH     = 'p2_high',
  /** Dégradation partielle — réponse dans les 4 heures */
  P3_MEDIUM   = 'p3_medium',
  /** Impact mineur — réponse dans les 24 heures */
  P4_LOW      = 'p4_low',
}

export enum IncidentStatus {
  /** Incident détecté, non encore pris en charge */
  OPEN          = 'open',
  /** Équipe engagée dans l'investigation */
  INVESTIGATING = 'investigating',
  /** Impact limité mais incident non résolu */
  MITIGATED     = 'mitigated',
  /** Cause racine traitée, service rétabli */
  RESOLVED      = 'resolved',
  /** Incident archivé (post-mortem optionnel terminé) */
  CLOSED        = 'closed',
  /** Post-mortem en cours de rédaction */
  POST_MORTEM   = 'post_mortem',
}

/**
 * Une entrée de la timeline de l'incident.
 * Représente un événement daté avec son contexte.
 */
export interface IncidentTimelineEntry {
  /** Horodatage ISO 8601 */
  timestamp: string;
  /** ID ou nom de l'acteur (admin, système, ...) */
  actor?: string;
  /** Description de l'action ou de la découverte */
  message: string;
  /** Nouveau statut si changement d'état */
  status?: IncidentStatus;
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_incident_ref',      ['reference'])
@Index('IDX_incident_status',   ['status'])
@Index('IDX_incident_sev',      ['severity'])
@Index('IDX_incident_detected', ['detectedAt'])

@Entity('platform_incidents')
export class PlatformIncident {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Référence lisible de l'incident.
   * Format : "INC-YYYY-NNNNN" (ex: INC-2026-00001)
   * Générée automatiquement par IncidentManagerService.
   */
  @Column({ type: 'varchar', length: 20, unique: true })
  reference: string;

  /* ==========================================================
   * DESCRIPTION
   * ========================================================== */

  /** Résumé court de l'incident (affiché dans les listes). */
  @Column({ type: 'varchar', length: 300 })
  title: string;

  /** Description détaillée de l'incident et de son impact. */
  @Column({ type: 'text' })
  description: string;

  /* ==========================================================
   * CLASSIFICATION
   * ========================================================== */

  @Column({ type: 'enum', enum: IncidentSeverity, default: IncidentSeverity.P3_MEDIUM })
  severity: IncidentSeverity;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.OPEN })
  status: IncidentStatus;

  /**
   * Liste des composants affectés.
   * Ex : ['paiement', 'wallet', 'notifications']
   */
  @Column({ type: 'json', default: '[]' })
  affectedComponents: string[];

  /* ==========================================================
   * TIMELINE
   * ========================================================== */

  /**
   * Chronologie complète de l'incident.
   * Chaque entrée est immuable une fois ajoutée.
   * Permet la reconstruction exacte du déroulement.
   */
  @Column({ type: 'json', default: '[]' })
  timeline: IncidentTimelineEntry[];

  /* ==========================================================
   * ANALYSE POST-INCIDENT
   * ========================================================== */

  /** Cause racine identifiée (obligatoire pour P1 et P2). */
  @Column({ type: 'text', nullable: true })
  rootCause: string | null;

  /** Actions correctives appliquées pour éviter la récurrence. */
  @Column({ type: 'text', nullable: true })
  remediation: string | null;

  /* ==========================================================
   * ACTEURS
   * ========================================================== */

  /** UserId de l'admin qui a ouvert l'incident. */
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  /** UserId de l'admin qui a résolu l'incident. */
  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string | null;

  /* ==========================================================
   * DATES DU CYCLE DE VIE
   * ========================================================== */

  /** Moment où l'incident a été détecté (peut précéder la création). */
  @Column({ type: 'timestamp' })
  detectedAt: Date;

  /** Moment de la résolution (cause traitée). */
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  /** Moment de la clôture (post-mortem terminé). */
  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
