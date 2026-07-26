/* ============================================================
 * FICHIER      : src/database/entities/security/security-event-log.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Journal d'événements de sécurité de la plateforme Shopi.
 * Trace toutes les actions sensibles, tentatives d'intrusion,
 * anomalies et alertes système.
 *
 * PRINCIPE D'IMMUABILITÉ
 * ─────────────────────────────────────────────────────────────
 * Ces enregistrements ne peuvent jamais être modifiés.
 * La conservation minimale est de 3 ans (configurable).
 *
 * MODULES CONCERNÉS
 * ─────────────────────────────────────────────────────────────
 *   PlatformSecurityModule → crée et lit
 *   AdminModule            → lit (rapports de sécurité)
 *
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
 * ENUMS
 * ============================================================ */

/**
 * Types d'événements de sécurité couvrant l'ensemble
 * du périmètre de la plateforme Shopi.
 */
export enum SecurityEventType {
  /* ── Authentification ──────────────────────────────── */
  LOGIN_SUCCESS                = 'login_success',
  LOGIN_FAILED                 = 'login_failed',
  LOGOUT                       = 'logout',
  TOKEN_INVALID                = 'token_invalid',
  PASSWORD_RESET               = 'password_reset',
  /* ── Limitation de débit ────────────────────────────── */
  RATE_LIMIT_EXCEEDED          = 'rate_limit_exceeded',
  BRUTE_FORCE_DETECTED         = 'brute_force_detected',
  /* ── Contrôle d'accès ───────────────────────────────── */
  ACCESS_DENIED                = 'access_denied',
  UNAUTHORIZED_ENDPOINT        = 'unauthorized_endpoint',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  /* ── Données sensibles ──────────────────────────────── */
  SENSITIVE_DATA_ACCESS        = 'sensitive_data_access',
  BULK_DATA_EXPORT             = 'bulk_data_export',
  /* ── Configuration ──────────────────────────────────── */
  CONFIG_CHANGED               = 'config_changed',
  ADMIN_ACTION                 = 'admin_action',
  /* ── Sécurité financière ────────────────────────────── */
  SUSPICIOUS_TRANSACTION       = 'suspicious_transaction',
  WEBHOOK_SIGNATURE_INVALID    = 'webhook_signature_invalid',
  DOUBLE_PAYMENT_ATTEMPT       = 'double_payment_attempt',
  ABNORMAL_WITHDRAWAL          = 'abnormal_withdrawal',
  REFUND_SPIKE_DETECTED        = 'refund_spike_detected',
  /* ── Système ────────────────────────────────────────── */
  SYSTEM_ERROR                 = 'system_error',
  DEPENDENCY_FAILURE           = 'dependency_failure',
  ANOMALY_DETECTED             = 'anomaly_detected',
  /* ── Alertes ────────────────────────────────────────── */
  ALERT_TRIGGERED              = 'alert_triggered',
  ALERT_RESOLVED               = 'alert_resolved',
  /* ── Conformité ─────────────────────────────────────── */
  RETENTION_CLEANUP            = 'retention_cleanup',
  COMPLIANCE_REPORT_GENERATED  = 'compliance_report_generated',
}

/**
 * Niveau de criticité de l'événement de sécurité.
 * Détermine la priorité de traitement et les notifications.
 */
export enum SecuritySeverity {
  /** Compromission probable — réponse immédiate requise */
  CRITICAL = 'critical',
  /** Anomalie sérieuse — investigation dans les 4h */
  HIGH     = 'high',
  /** Comportement suspect — investigation dans les 24h */
  MEDIUM   = 'medium',
  /** Anomalie mineure — surveillance */
  LOW      = 'low',
  /** Événement informatif — aucune action requise */
  INFO     = 'info',
}

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_sec_event_type',    ['eventType'])
@Index('IDX_sec_event_actor',   ['actorId'])
@Index('IDX_sec_event_sev',     ['severity'])
@Index('IDX_sec_event_ip',      ['ipAddress'])
@Index('IDX_sec_event_corrId',  ['correlationId'])
@Index('IDX_sec_event_created', ['createdAt'])

@Entity('security_event_logs')
export class SecurityEventLog {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * CLASSIFICATION
   * ========================================================== */

  @Column({ type: 'enum', enum: SecurityEventType })
  eventType: SecurityEventType;

  @Column({
    type: 'enum',
    enum: SecuritySeverity,
    default: SecuritySeverity.INFO,
  })
  severity: SecuritySeverity;

  /* ==========================================================
   * ACTEUR
   * ========================================================== */

  /** UUID de l'utilisateur à l'origine de l'événement. NULL = système. */
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  /** Rôle de l'acteur au moment de l'événement (snapshot). */
  @Column({ type: 'varchar', length: 50, nullable: true })
  actorRole: string | null;

  /* ==========================================================
   * CONTEXTE RÉSEAU
   * ========================================================== */

  /** Adresse IP de l'acteur (IPv4 ou IPv6). */
  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  /** User-Agent HTTP. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  /* ==========================================================
   * RESSOURCE CIBLÉE
   * ========================================================== */

  /** Chemin de la ressource accédée (ex: '/api/wallets/:id'). */
  @Column({ type: 'varchar', length: 200, nullable: true })
  resource: string | null;

  /** Action tentée (ex: 'DELETE', 'export', 'freeze'). */
  @Column({ type: 'varchar', length: 100, nullable: true })
  action: string | null;

  /* ==========================================================
   * TRAÇABILITÉ
   * ========================================================== */

  /**
   * Identifiant de corrélation de la requête HTTP (X-Request-Id).
   * Permet de relier cet événement au log applicatif correspondant.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  correlationId: string | null;

  /* ==========================================================
   * DÉTAILS
   * ========================================================== */

  /**
   * Métadonnées spécifiques à l'événement.
   * Contenu variable selon eventType.
   * Ex LOGIN_FAILED : { attempts: 3, reason: 'wrong_password' }
   * Ex BRUTE_FORCE  : { attempts: 6, windowMinutes: 5, blocked: true }
   */
  @Column({ type: 'json', nullable: true })
  details: Record<string, unknown> | null;

  /* ==========================================================
   * RÉSOLUTION (pour ALERT_TRIGGERED)
   * ========================================================== */

  /** Horodatage de résolution — rempli quand l'alerte est résolue. */
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  /* ==========================================================
   * DATE
   * ========================================================== */

  /** Date exacte de l'événement. Immuable. */
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
