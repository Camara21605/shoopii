/* ============================================================
 * FICHIER      : src/modules/platform-security/platform-security.module.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Câblage NestJS du moteur de sécurité, conformité, monitoring
 * et fiabilité de la plateforme Shopi.
 *
 * PROVIDERS INTERNES (9 services + 1 scheduler + 1 façade)
 * ─────────────────────────────────────────────────────────────
 *   SecurityEventService     — journalisation sécurité
 *   MetricsCollectorService  — métriques système in-memory + DB
 *   DeepHealthService        — health checks (DB, Redis, process)
 *   AlertManagerService      — gestion alertes actives
 *   IncidentManagerService   — cycle de vie incidents P1→P4
 *   ComplianceService        — rétention, rapports conformité
 *   ObservabilityService     — traces distribuées in-memory
 *   AnomalyDetectorService   — brute force, retraits anormaux
 *   BackupStrategyService    — stratégie sauvegarde (pure doc)
 *   SecurityScheduler        — tâches cron (@Cron)
 *   PlatformSecurityEngine   — façade publique (point d'entrée)
 *
 * EXPORT
 * ─────────────────────────────────────────────────────────────
 * Seul PlatformSecurityEngine est exporté.
 * Les autres modules importent ce module et injectent
 * PlatformSecurityEngine — jamais les services internes.
 *
 * PRÉREQUIS DANS AppModule
 * ─────────────────────────────────────────────────────────────
 *   - RedisModule (global) → @InjectRedis() pour DeepHealthService
 *   - ScheduleModule.forRoot() (dans JobsModule) → @Cron() tasks
 *   - ConfigModule.forRoot({ isGlobal: true }) → ConfigService
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

/* ── Entités ── */
import { SecurityEventLog } from '../../database/entities/security/security-event-log.entity';
import { SystemMetric }     from '../../database/entities/security/system-metric.entity';
import { PlatformIncident } from '../../database/entities/security/platform-incident.entity';

/* ── Services internes ── */
import { SecurityEventService }    from './services/security-event.service';
import { MetricsCollectorService } from './services/metrics-collector.service';
import { DeepHealthService }       from './services/deep-health.service';
import { AlertManagerService }     from './services/alert-manager.service';
import { IncidentManagerService }  from './services/incident-manager.service';
import { ComplianceService }       from './services/compliance.service';
import { ObservabilityService }    from './services/observability.service';
import { AnomalyDetectorService }  from './services/anomaly-detector.service';
import { BackupStrategyService }   from './services/backup-strategy.service';
import { PerformanceModule }       from '../performance-engine/performance.module';

/* ── Scheduler ── */
import { SecurityScheduler } from './scheduler/security.scheduler';

/* ── Façade + Controller ── */
import { PlatformSecurityEngine }     from './platform-security.engine';
import { PlatformSecurityController } from './platform-security.controller';

/* ============================================================
 * MODULE
 * ============================================================ */

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SecurityEventLog,
      SystemMetric,
      PlatformIncident,
    ]),
    PerformanceModule,
  ],

  controllers: [
    PlatformSecurityController,
  ],

  providers: [
    /* Services métier */
    SecurityEventService,
    MetricsCollectorService,
    DeepHealthService,
    AlertManagerService,
    IncidentManagerService,
    ComplianceService,
    ObservabilityService,
    AnomalyDetectorService,
    BackupStrategyService,

    /* Tâches planifiées (requiert ScheduleModule.forRoot() dans JobsModule) */
    SecurityScheduler,

    /* Façade publique */
    PlatformSecurityEngine,
  ],

  exports: [
    /* Seul export public — les modules consommateurs n'importent jamais
     * les services internes directement. */
    PlatformSecurityEngine,
  ],
})
export class PlatformSecurityModule {}
