/* ============================================================
 * FICHIER      : src/database/entities/security/system-metric.entity.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Stockage des métriques système en séries temporelles.
 * Chaque enregistrement représente une mesure ponctuelle.
 *
 * NOMS DE MÉTRIQUES STANDARD
 * ─────────────────────────────────────────────────────────────
 *   process.memory_mb        — RAM utilisée par le processus (MB)
 *   process.memory_pct       — RAM en % du heap total
 *   process.uptime_min       — Uptime du processus (minutes)
 *   http.total_requests      — Nombre total de requêtes HTTP
 *   http.error_count         — Nombre d'erreurs HTTP (4xx/5xx)
 *   http.error_rate_pct      — Taux d'erreur HTTP (%)
 *   http.avg_duration_ms     — Durée moyenne des requêtes (ms)
 *   events.published         — Événements publiés (bus)
 *   events.failed            — Événements échoués (bus)
 *   events.failure_rate_pct  — Taux d'échec du bus (%)
 *   events.dlq_size          — Taille de la Dead Letter Queue
 *   health.db_latency_ms     — Latence base de données (ms)
 *   health.redis_latency_ms  — Latence Redis (ms)
 *
 * RÉTENTION
 * ─────────────────────────────────────────────────────────────
 * Les métriques sont purgées automatiquement après 90 jours
 * par le SecurityScheduler (tâche mensuelle).
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

import { ColumnNumericTransformer } from '../../transformers/column-numeric.transformer';

/* ============================================================
 * ENTITY
 * ============================================================ */

@Index('IDX_metric_name',      ['metricName'])
@Index('IDX_metric_collected', ['collectedAt'])

@Entity('system_metrics')
export class SystemMetric {

  /* ==========================================================
   * IDENTIFIANT
   * ========================================================== */

  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ==========================================================
   * MÉTRIQUE
   * ========================================================== */

  /**
   * Nom de la métrique (notation pointée).
   * Ex : 'process.memory_mb', 'http.error_rate_pct'
   */
  @Column({ type: 'varchar', length: 100 })
  metricName: string;

  /**
   * Valeur numérique de la métrique au moment de la collecte.
   * Precision 15,4 pour supporter les pourcentages et les grands entiers.
   */
  @Column({
    type: 'decimal',
    precision: 15,
    scale: 4,
    transformer: new ColumnNumericTransformer(),
  })
  value: number;

  /**
   * Unité de mesure.
   * Valeurs possibles : 'ms', 'pct', 'count', 'mb', 'bytes', 'min'
   */
  @Column({ type: 'varchar', length: 20, default: 'count' })
  unit: string;

  /**
   * Tags de dimension pour filtrer et grouper les métriques.
   * Ex : { component: 'database', status: 'healthy' }
   */
  @Column({ type: 'json', nullable: true })
  tags: Record<string, string> | null;

  /* ==========================================================
   * HORODATAGE
   * ========================================================== */

  /**
   * Moment exact de la collecte.
   * Pas de CreateDateColumn car la date est fournie par le collector.
   */
  @Column({ type: 'timestamp' })
  collectedAt: Date;
}
