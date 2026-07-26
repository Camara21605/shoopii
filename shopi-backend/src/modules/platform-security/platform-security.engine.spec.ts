/* ============================================================
 * FICHIER      : src/modules/platform-security/platform-security.engine.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests unitaires de PlatformSecurityEngine (façade).
 * Couvre les 9 domaines fonctionnels avec mocks complets.
 *
 * STRATÉGIE
 * ─────────────────────────────────────────────────────────────
 * Chaque service interne est entièrement mocké via jest.fn().
 * On vérifie que la façade délègue correctement et ne transforme
 * pas les données (pass-through idiom).
 *
 * GROUPES DE TESTS (9)
 * ─────────────────────────────────────────────────────────────
 *  1. Security — logSecurityEvent / logSecurityEventAsync / getSecurityEvents / getSecuritySummary
 *  2. Metrics  — getMetricsSnapshot / recordRequest / incrementActive / decrementActive
 *  3. Health   — checkHealth
 *  4. Alerts   — triggerAlert / resolveAlert / acknowledgeAlert / getActiveAlerts / getAlertCount
 *  5. Incidents — openIncident / updateIncident / addIncidentTimeline / resolveIncident / closeIncident / listIncidents / getIncident
 *  6. Observabilité — startSpan / endSpan / getTrace
 *  7. Anomalies — recordFailedLogin / recordWithdrawal / recordPayment / recordRefund
 *  8. Conformité — getRetentionPolicy / runRetentionCheck / generateComplianceReport
 *  9. Sauvegardes — getBackupStrategy / getDisasterRecoveryPlan / getBackupChecklist
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';

import { PlatformSecurityEngine }     from './platform-security.engine';
import { SecurityEventService }    from './services/security-event.service';
import { MetricsCollectorService } from './services/metrics-collector.service';
import { DeepHealthService }       from './services/deep-health.service';
import { AlertManagerService }     from './services/alert-manager.service';
import { IncidentManagerService }  from './services/incident-manager.service';
import { ComplianceService }       from './services/compliance.service';
import { ObservabilityService }    from './services/observability.service';
import { AnomalyDetectorService }  from './services/anomaly-detector.service';
import { BackupStrategyService }   from './services/backup-strategy.service';

import { SecurityEventType, SecuritySeverity } from '../../database/entities/security/security-event-log.entity';
import { IncidentSeverity, IncidentStatus }    from '../../database/entities/security/platform-incident.entity';

/* ============================================================
 * HELPERS — création de mocks typés
 * ============================================================ */

function mockSecurityEventService() {
  return {
    log:                     jest.fn().mockResolvedValue({ id: 'ev-001' }),
    logAsync:                jest.fn(),
    getEvents:               jest.fn().mockResolvedValue([]),
    getSummary:              jest.fn().mockResolvedValue({ criticalCount: 0, highCount: 0, eventCount: 0 }),
    countByTypeGrouped:      jest.fn().mockResolvedValue({}),
    countBySeverityGrouped:  jest.fn().mockResolvedValue({}),
    topIps:                  jest.fn().mockResolvedValue([]),
    purgeOlderThan:          jest.fn().mockResolvedValue(0),
  };
}

function mockMetricsCollectorService() {
  return {
    getSnapshot:      jest.fn().mockReturnValue({ process: { memoryUsedMb: 100, memoryUsedPct: 25 }, http: { totalRequests: 0, errorCount: 0, errorRatePct: 0 } }),
    recordRequest:    jest.fn(),
    incrementActive:  jest.fn(),
    decrementActive:  jest.fn(),
    persistSnapshot:  jest.fn().mockResolvedValue(undefined),
    purgeOlderThan:   jest.fn().mockResolvedValue(0),
  };
}

function mockDeepHealthService() {
  return {
    checkAll: jest.fn().mockResolvedValue({
      overall: 'healthy',
      checkedAt: new Date(),
      totalCheckMs: 5,
      components: [],
    }),
  };
}

function mockAlertManagerService() {
  return {
    trigger:                        jest.fn().mockReturnValue({ id: 'a-001', ruleId: 'test', count: 1 }),
    resolve:                        jest.fn().mockReturnValue(true),
    acknowledge:                    jest.fn().mockReturnValue(true),
    getActiveAlerts:                jest.fn().mockReturnValue([]),
    getActiveCount:                 jest.fn().mockReturnValue(0),
    hasCriticalAlert:               jest.fn().mockReturnValue(false),
    autoResolveForHealthyComponents: jest.fn(),
  };
}

function mockIncidentManagerService() {
  return {
    open:               jest.fn().mockResolvedValue({ id: 'inc-001', reference: 'INC-2026-00001' }),
    update:             jest.fn().mockResolvedValue({ id: 'inc-001' }),
    addTimeline:        jest.fn().mockResolvedValue(undefined),
    resolve:            jest.fn().mockResolvedValue({ id: 'inc-001', status: 'RESOLVED' }),
    close:              jest.fn().mockResolvedValue({ id: 'inc-001', status: 'CLOSED' }),
    list:               jest.fn().mockResolvedValue([]),
    findOrFail:         jest.fn().mockResolvedValue({ id: 'inc-001' }),
    countOpen:          jest.fn().mockResolvedValue(0),
    avgResolutionHours: jest.fn().mockResolvedValue(null),
  };
}

function mockComplianceService() {
  return {
    getRetentionPolicy:       jest.fn().mockReturnValue({ financialAuditLogsYears: 5 }),
    runRetentionCheck:        jest.fn().mockResolvedValue({ totalRecordsToArchive: 0, tables: [] }),
    generateComplianceReport: jest.fn().mockResolvedValue({ generatedAt: new Date(), securityEvents: { total: 0 } }),
  };
}

function mockObservabilityService() {
  return {
    startSpan:       jest.fn().mockReturnValue('span-abc'),
    endSpan:         jest.fn(),
    getTrace:        jest.fn().mockReturnValue(null),
    cleanupOldTraces: jest.fn().mockReturnValue(0),
  };
}

function mockAnomalyDetectorService() {
  return {
    recordFailedLogin: jest.fn().mockReturnValue({ anomalyDetected: false }),
    recordWithdrawal:  jest.fn().mockReturnValue({ anomalyDetected: false }),
    recordPayment:     jest.fn(),
    recordRefund:      jest.fn().mockReturnValue({ anomalyDetected: false }),
    cleanupExpiredWindows: jest.fn().mockReturnValue(0),
  };
}

function mockBackupStrategyService() {
  return {
    getStrategy:             jest.fn().mockReturnValue({ rpo: '24h', rto: '4h' }),
    getDisasterRecoveryPlan: jest.fn().mockReturnValue({ steps: [] }),
    getVerificationChecklist: jest.fn().mockReturnValue([]),
  };
}

/* ============================================================
 * SUITE PRINCIPALE
 * ============================================================ */

describe('PlatformSecurityEngine', () => {
  let engine:    PlatformSecurityEngine;
  let secEvent:  ReturnType<typeof mockSecurityEventService>;
  let metrics:   ReturnType<typeof mockMetricsCollectorService>;
  let health:    ReturnType<typeof mockDeepHealthService>;
  let alerts:    ReturnType<typeof mockAlertManagerService>;
  let incidents: ReturnType<typeof mockIncidentManagerService>;
  let compliance: ReturnType<typeof mockComplianceService>;
  let obs:       ReturnType<typeof mockObservabilityService>;
  let anomaly:   ReturnType<typeof mockAnomalyDetectorService>;
  let backup:    ReturnType<typeof mockBackupStrategyService>;

  beforeEach(async () => {
    secEvent   = mockSecurityEventService();
    metrics    = mockMetricsCollectorService();
    health     = mockDeepHealthService();
    alerts     = mockAlertManagerService();
    incidents  = mockIncidentManagerService();
    compliance = mockComplianceService();
    obs        = mockObservabilityService();
    anomaly    = mockAnomalyDetectorService();
    backup     = mockBackupStrategyService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSecurityEngine,
        { provide: SecurityEventService,    useValue: secEvent   },
        { provide: MetricsCollectorService, useValue: metrics    },
        { provide: DeepHealthService,       useValue: health     },
        { provide: AlertManagerService,     useValue: alerts     },
        { provide: IncidentManagerService,  useValue: incidents  },
        { provide: ComplianceService,       useValue: compliance },
        { provide: ObservabilityService,    useValue: obs        },
        { provide: AnomalyDetectorService,  useValue: anomaly    },
        { provide: BackupStrategyService,   useValue: backup     },
      ],
    }).compile();

    engine = module.get<PlatformSecurityEngine>(PlatformSecurityEngine);
  });

  /* ==========================================================
   * 1. SÉCURITÉ — JOURNALISATION
   * ========================================================== */

  describe('Security — logSecurityEvent', () => {
    it('délègue log() à SecurityEventService et retourne le résultat', async () => {
      const dto = {
        eventType: SecurityEventType.LOGIN_FAILED,
        severity:  SecuritySeverity.HIGH,
        action:    'login',
      };
      const result = await engine.logSecurityEvent(dto as any);
      expect(secEvent.log).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'ev-001' });
    });

    it('logSecurityEventAsync appelle logAsync sans attendre', () => {
      const dto = { eventType: SecurityEventType.RATE_LIMIT_EXCEEDED, severity: SecuritySeverity.MEDIUM, action: 'api' };
      engine.logSecurityEventAsync(dto as any);
      expect(secEvent.logAsync).toHaveBeenCalledWith(dto);
    });

    it('getSecurityEvents délègue le filtre à SecurityEventService', async () => {
      const filter = { severity: SecuritySeverity.CRITICAL, limit: 10 };
      await engine.getSecurityEvents(filter as any);
      expect(secEvent.getEvents).toHaveBeenCalledWith(filter);
    });

    it('getSecuritySummary fusionne le résumé d'événements avec alertes et incidents', async () => {
      alerts.getActiveCount.mockReturnValue(3);
      incidents.countOpen.mockResolvedValue(2);
      secEvent.getSummary.mockResolvedValue({ criticalCount: 1, highCount: 2, eventCount: 5 });

      const summary = await engine.getSecuritySummary();

      expect(summary.activeAlerts).toBe(3);
      expect(summary.openIncidents).toBe(2);
      expect(summary.criticalCount).toBe(1);
    });
  });

  /* ==========================================================
   * 2. MONITORING — MÉTRIQUES
   * ========================================================== */

  describe('Metrics', () => {
    it('getMetricsSnapshot retourne le snapshot en mémoire', () => {
      const snap = engine.getMetricsSnapshot();
      expect(metrics.getSnapshot).toHaveBeenCalled();
      expect(snap.process.memoryUsedMb).toBe(100);
    });

    it('recordRequest délègue statusCode et durationMs', () => {
      engine.recordRequest(200, 42);
      expect(metrics.recordRequest).toHaveBeenCalledWith(200, 42);
    });

    it('incrementActiveRequest incrémente le compteur', () => {
      engine.incrementActiveRequest();
      expect(metrics.incrementActive).toHaveBeenCalled();
    });

    it('decrementActiveRequest décrémente le compteur', () => {
      engine.decrementActiveRequest();
      expect(metrics.decrementActive).toHaveBeenCalled();
    });
  });

  /* ==========================================================
   * 3. HEALTH CHECKS
   * ========================================================== */

  describe('Health', () => {
    it('checkHealth retourne le rapport complet de DeepHealthService', async () => {
      const report = await engine.checkHealth();
      expect(health.checkAll).toHaveBeenCalled();
      expect(report.overall).toBe('healthy');
    });
  });

  /* ==========================================================
   * 4. ALERTES
   * ========================================================== */

  describe('Alerts', () => {
    it('triggerAlert crée ou met à jour une alerte et retourne l'objet', () => {
      const trigger = {
        ruleId:    'test.rule',
        severity:  SecuritySeverity.HIGH,
        component: 'api',
        message:   'Test alerte',
      };
      const result = engine.triggerAlert(trigger as any);
      expect(alerts.trigger).toHaveBeenCalledWith(trigger);
      expect(result).toMatchObject({ ruleId: 'test' });
    });

    it('resolveAlert retourne true quand l'alerte est trouvée', () => {
      expect(engine.resolveAlert('test.rule', 'admin-01')).toBe(true);
      expect(alerts.resolve).toHaveBeenCalledWith('test.rule', 'admin-01');
    });

    it('acknowledgeAlert délègue au AlertManagerService', () => {
      expect(engine.acknowledgeAlert('test.rule', 'admin-01')).toBe(true);
      expect(alerts.acknowledge).toHaveBeenCalledWith('test.rule', 'admin-01');
    });

    it('getActiveAlerts retourne la liste triée', () => {
      alerts.getActiveAlerts.mockReturnValue([{ ruleId: 'x' }]);
      expect(engine.getActiveAlerts()).toHaveLength(1);
    });

    it('getAlertCount retourne le nombre d'alertes actives', () => {
      alerts.getActiveCount.mockReturnValue(5);
      expect(engine.getAlertCount()).toBe(5);
    });
  });

  /* ==========================================================
   * 5. INCIDENTS
   * ========================================================== */

  describe('Incidents', () => {
    const baseDto = {
      title:              'Paiement indisponible',
      description:        'Le PSP orange-money ne répond plus',
      severity:           IncidentSeverity.P1_CRITICAL,
      affectedComponents: ['payment-engine'],
    };

    it('openIncident crée un incident et retourne la référence', async () => {
      const result = await engine.openIncident(baseDto as any);
      expect(incidents.open).toHaveBeenCalledWith(baseDto);
      expect(result.reference).toBe('INC-2026-00001');
    });

    it('updateIncident transmet le dto et l'acteur', async () => {
      await engine.updateIncident('inc-001', { status: IncidentStatus.INVESTIGATING }, 'admin-01');
      expect(incidents.update).toHaveBeenCalledWith('inc-001', { status: 'INVESTIGATING' }, 'admin-01');
    });

    it('addIncidentTimeline ajoute une entrée de timeline', async () => {
      await engine.addIncidentTimeline('inc-001', 'PSP contacté', 'admin-01');
      expect(incidents.addTimeline).toHaveBeenCalledWith('inc-001', 'PSP contacté', 'admin-01');
    });

    it('resolveIncident passe la cause racine et la remédiation', async () => {
      const result = await engine.resolveIncident('inc-001', 'Timeout PSP', 'Alertes ajoutées', 'admin-01');
      expect(incidents.resolve).toHaveBeenCalledWith('inc-001', 'Timeout PSP', 'Alertes ajoutées', 'admin-01');
      expect(result.status).toBe('RESOLVED');
    });

    it('closeIncident délègue l'acteur', async () => {
      const result = await engine.closeIncident('inc-001', 'admin-01');
      expect(incidents.close).toHaveBeenCalledWith('inc-001', 'admin-01');
      expect(result.status).toBe('CLOSED');
    });

    it('listIncidents délègue le filtre', async () => {
      await engine.listIncidents({ status: IncidentStatus.OPEN, limit: 10 });
      expect(incidents.list).toHaveBeenCalledWith({ status: 'OPEN', limit: 10 });
    });

    it('getIncident retourne l'incident correspondant', async () => {
      const inc = await engine.getIncident('inc-001');
      expect(incidents.findOrFail).toHaveBeenCalledWith('inc-001');
      expect(inc).toMatchObject({ id: 'inc-001' });
    });
  });

  /* ==========================================================
   * 6. OBSERVABILITÉ
   * ========================================================== */

  describe('Observability', () => {
    it('startSpan retourne un spanId non vide', () => {
      const spanId = engine.startSpan('corr-abc', 'payment.process');
      expect(obs.startSpan).toHaveBeenCalledWith('corr-abc', 'payment.process');
      expect(spanId).toBe('span-abc');
    });

    it('endSpan délègue le résultat et la métadonnée', () => {
      engine.endSpan('corr-abc', 'span-abc', 'success', { amount: 5000 });
      expect(obs.endSpan).toHaveBeenCalledWith('corr-abc', 'span-abc', 'success', { amount: 5000 });
    });

    it('getTrace retourne null si la trace est expirée ou inexistante', () => {
      expect(engine.getTrace('unknown-corr')).toBeNull();
    });
  });

  /* ==========================================================
   * 7. DÉTECTION D'ANOMALIES
   * ========================================================== */

  describe('Anomaly Detection', () => {
    it('recordFailedLogin retourne AnomalyResult sans anomalie initiale', () => {
      const result = engine.recordFailedLogin('user-01', '1.2.3.4');
      expect(anomaly.recordFailedLogin).toHaveBeenCalledWith('user-01', '1.2.3.4');
      expect(result.anomalyDetected).toBe(false);
    });

    it('recordFailedLogin signale brute force après le seuil', () => {
      anomaly.recordFailedLogin.mockReturnValue({ anomalyDetected: true, reason: 'BRUTE_FORCE' });
      const result = engine.recordFailedLogin('user-hacker', '5.5.5.5');
      expect(result.anomalyDetected).toBe(true);
      expect(result.reason).toBe('BRUTE_FORCE');
    });

    it('recordWithdrawal retourne AnomalyResult', () => {
      const result = engine.recordWithdrawal('user-02', 100_000);
      expect(anomaly.recordWithdrawal).toHaveBeenCalledWith('user-02', 100_000);
      expect(result.anomalyDetected).toBe(false);
    });

    it('recordPayment est fire-and-forget (pas de retour)', () => {
      expect(() => engine.recordPayment()).not.toThrow();
      expect(anomaly.recordPayment).toHaveBeenCalled();
    });

    it('recordRefund retourne AnomalyResult', () => {
      const result = engine.recordRefund();
      expect(anomaly.recordRefund).toHaveBeenCalled();
      expect(result.anomalyDetected).toBe(false);
    });
  });

  /* ==========================================================
   * 8. CONFORMITÉ
   * ========================================================== */

  describe('Compliance', () => {
    it('getRetentionPolicy retourne la politique active', () => {
      const policy = engine.getRetentionPolicy();
      expect(compliance.getRetentionPolicy).toHaveBeenCalled();
      expect(policy.financialAuditLogsYears).toBe(5);
    });

    it('runRetentionCheck délègue au ComplianceService', async () => {
      const result = await engine.runRetentionCheck();
      expect(compliance.runRetentionCheck).toHaveBeenCalled();
      expect(result.totalRecordsToArchive).toBe(0);
    });

    it('generateComplianceReport utilise la période passée', async () => {
      const from = new Date('2026-01-01');
      const to   = new Date('2026-01-31');
      await engine.generateComplianceReport({ from, to });
      expect(compliance.generateComplianceReport).toHaveBeenCalledWith({ from, to });
    });

    it('generateComplianceReport utilise les 30 derniers jours si aucune période fournie', async () => {
      await engine.generateComplianceReport();
      const call = (compliance.generateComplianceReport as jest.Mock).mock.calls[0][0];
      const diffMs = call.to.getTime() - call.from.getTime();
      expect(diffMs).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -3);
    });
  });

  /* ==========================================================
   * 9. SAUVEGARDES
   * ========================================================== */

  describe('Backup & Recovery', () => {
    it('getBackupStrategy retourne la stratégie RPO/RTO', () => {
      const strategy = engine.getBackupStrategy();
      expect(backup.getStrategy).toHaveBeenCalled();
      expect(strategy.rpo).toBe('24h');
      expect(strategy.rto).toBe('4h');
    });

    it('getDisasterRecoveryPlan retourne le plan en 8 étapes', () => {
      backup.getDisasterRecoveryPlan.mockReturnValue({ steps: new Array(8).fill({}) });
      const plan = engine.getDisasterRecoveryPlan();
      expect(plan.steps).toHaveLength(8);
    });

    it('getBackupChecklist délègue au BackupStrategyService', () => {
      backup.getVerificationChecklist.mockReturnValue(['step1', 'step2', 'step3']);
      const checklist = engine.getBackupChecklist();
      expect(checklist).toHaveLength(3);
    });
  });
});
