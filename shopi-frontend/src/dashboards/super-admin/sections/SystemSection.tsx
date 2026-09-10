/* ============================================================
 * FICHIER  : src/dashboards/super-admin/sections/SystemSection.tsx
 * ROLE     : Centre de supervision — santé, métriques, alertes,
 *            incidents et conformité de la plateforme Shoneya.
 *
 * Relié au moteur PlatformSecurityEngine (src/modules/platform-security
 * côté backend) via les routes /platform-security/* — health, metrics,
 * summary, alerts, incidents, compliance, backup. Ce moteur existait
 * déjà côté backend mais n'était appelé par aucune page frontend :
 * cette section remplace l'ancienne version 100% simulée (CPU/RAM/
 * services/logs générés par Math.random()) par les vraies données.
 * ============================================================ */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '../../../shared/services/apiFetch';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

/* ─────────────────────────────────────────────────────────────
 * TYPES — miroir de src/modules/platform-security/types/security.types.ts
 * ───────────────────────────────────────────────────────────── */

type ComponentStatus = 'healthy' | 'degraded' | 'down';

interface ComponentHealth {
  name:      string;
  status:    ComponentStatus;
  latencyMs: number | null;
  details?:  Record<string, unknown>;
  checkedAt: string;
  error?:    string;
}

interface HealthReport {
  overall:      ComponentStatus;
  components:   ComponentHealth[];
  totalCheckMs: number;
  timestamp:    string;
}

interface MetricsSnapshot {
  timestamp: string;
  process: {
    uptimeMs: number; memoryUsedMb: number; memoryHeapTotalMb: number;
    memoryUsedPct: number; rssMb: number;
  };
  http: {
    totalRequests: number; activeRequests: number; errorCount: number;
    errorRatePct: number; avgDurationMs: number;
  };
  events: {
    published: number; consumed: number; failed: number;
    dlqSize: number; failureRatePct: number;
  };
}

interface SecuritySummary {
  last24hEvents:     number;
  criticalEvents:    number;
  activeAlerts:      number;
  openIncidents:     number;
  bruteForceBlocks:  number;
  anomaliesDetected: number;
}

type PSSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface ActiveAlert {
  id: string; ruleId: string; severity: PSSeverity; component: string;
  message: string; metadata?: Record<string, unknown>;
  triggeredAt: string; lastSeenAt: string; count: number;
  acknowledgedAt?: string; acknowledgedBy?: string;
}

type IncidentSeverity = 'p1_critical' | 'p2_high' | 'p3_medium' | 'p4_low';
type IncidentStatus   = 'open' | 'investigating' | 'mitigated' | 'resolved' | 'closed' | 'post_mortem';

interface IncidentTimelineEntry {
  timestamp: string; actor?: string; message: string; status?: IncidentStatus;
}

interface PlatformIncident {
  id: string; reference: string; title: string; description: string;
  severity: IncidentSeverity; status: IncidentStatus;
  affectedComponents: string[]; timeline: IncidentTimelineEntry[];
  rootCause: string | null; remediation: string | null;
  createdBy: string | null; resolvedBy: string | null;
  detectedAt: string; resolvedAt: string | null; closedAt: string | null;
  createdAt: string; updatedAt: string;
}

interface RetentionPolicy {
  financialAuditLogsYears: number; securityEventsYears: number;
  metricsRetentionDays: number; incidentsRetentionYears: number;
  generalAuditLogsYears: number;
}

interface RetentionCheckResult {
  checkedAt: string;
  tables: Array<{ name: string; retentionYears: number; recordsToArchive: number; oldestRecord?: string }>;
  totalRecordsToArchive: number;
}

interface ComplianceReport {
  generatedAt: string;
  period: { from: string; to: string };
  securityEvents: { total: number; bySeverity: Record<string, number>; byType: Record<string, number>; topIps: Array<{ ip: string; count: number }> };
  incidents: { total: number; bySeverity: Record<string, number>; avgResolutionHours: number | null; openCount: number };
  retention: RetentionCheckResult;
  recommendations: string[];
}

interface BackupStrategy {
  database: { frequency: string; type: string; retentionDays: number; tool: string; location: string; description: string };
  files:    { frequency: string; retentionDays: number; tool: string; location: string; description: string };
  rpoHours: number; rtoHours: number; contacts: string[]; lastUpdated: string;
}

interface DisasterRecoveryPlan {
  steps: Array<{ order: number; title: string; description: string; responsible: string; estimatedMinutes: number }>;
  escalation: { level1: string; level2: string; level3: string };
  communicationTemplate: string;
}

interface ChecklistItem { check: string; status: 'manual' | 'automated'; notes: string }

/* ─────────────────────────────────────────────────────────────
 * CONFIGURATION VISUELLE
 * ───────────────────────────────────────────────────────────── */

const HEALTH_CFG: Record<ComponentStatus, { label: string; color: string; bg: string }> = {
  healthy:  { label: 'Opérationnel', color: '#10b981', bg: 'rgba(16,185,129,.14)' },
  degraded: { label: 'Dégradé',      color: '#f59e0b', bg: 'rgba(245,158,11,.14)' },
  down:     { label: 'Hors service', color: '#ef4444', bg: 'rgba(239,68,68,.14)' },
};

const PS_SEV_CFG: Record<PSSeverity, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critique', color: '#ef4444', bg: 'rgba(239,68,68,.12)' },
  high:     { label: 'Élevée',   color: '#f97316', bg: 'rgba(249,115,22,.12)' },
  medium:   { label: 'Moyenne',  color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  low:      { label: 'Faible',   color: '#38bdf8', bg: 'rgba(56,189,248,.12)' },
  info:     { label: 'Info',     color: '#64748b', bg: 'rgba(100,116,139,.12)' },
};

const INC_SEV_CFG: Record<IncidentSeverity, { label: string; color: string }> = {
  p1_critical: { label: 'P1 — Critique', color: '#ef4444' },
  p2_high:     { label: 'P2 — Élevée',   color: '#f97316' },
  p3_medium:   { label: 'P3 — Moyenne',  color: '#f59e0b' },
  p4_low:      { label: 'P4 — Faible',   color: '#38bdf8' },
};

const INC_STATUS_CFG: Record<IncidentStatus, { label: string; color: string }> = {
  open:          { label: 'Ouvert',       color: '#ef4444' },
  investigating: { label: 'Investigation', color: '#f59e0b' },
  mitigated:     { label: 'Atténué',       color: '#38bdf8' },
  resolved:      { label: 'Résolu',        color: '#10b981' },
  closed:        { label: 'Clôturé',       color: '#64748b' },
  post_mortem:   { label: 'Post-mortem',   color: '#a78bfa' },
};

function fmtDT(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}j ${h}h ${m}min` : h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function dl(content: string, name: string, mime: string): void {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: mime })), download: name });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANTS
 * ───────────────────────────────────────────────────────────── */

const StatusDot = ({ status }: { status: ComponentStatus }) => {
  const cfg = HEALTH_CFG[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase' as const, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}40`, whiteSpace: 'nowrap' as const }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

const MetricCard = ({ label, value, unit, icon, color, sub, warning }: {
  label: string; value: number | string; unit?: string; icon: string; color: string; sub?: string; warning?: boolean;
}) => (
  <div style={{ flex: '1 1 150px', minWidth: 140, background: 'var(--surface)', border: `1px solid ${warning ? '#f59e0b40' : 'var(--border)'}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, letterSpacing: '.5px', lineHeight: 1.4 }}>{label}</span>
      <span style={{ fontSize: 20 }}>{icon}</span>
    </div>
    <div>
      <span style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'var(--font-m)', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString('fr') : value}
      </span>
      {unit && <span style={{ fontSize: 12, color: 'var(--txt-3)', marginLeft: 4 }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{sub}</div>}
  </div>
);

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ───────────────────────────────────────────────────────────── */

interface Props { store: SuperAdminStore; isActive: boolean }

type Tab = 'monitoring' | 'alerts' | 'incidents' | 'compliance';

export default function SystemSection({ isActive }: Props) {
  const [tab, setTab] = useState<Tab>('monitoring');

  /* ── Monitoring : santé + métriques + résumé sécurité ── */
  const [health,   setHealth]   = useState<HealthReport | null>(null);
  const [metrics,  setMetrics]  = useState<MetricsSnapshot | null>(null);
  const [summary,  setSummary]  = useState<SecuritySummary | null>(null);
  const [monLoading, setMonLoading] = useState(true);
  const [monError,   setMonError]   = useState<string | null>(null);
  const [paused,   setPaused]   = useState(false);
  const [lastUpd,  setLastUpd]  = useState<Date | null>(null);

  const loadMonitoring = useCallback(async () => {
    setMonError(null);
    try {
      const [h, m, s] = await Promise.all([
        apiFetch<HealthReport>('/platform-security/health'),
        apiFetch<MetricsSnapshot>('/platform-security/metrics'),
        apiFetch<SecuritySummary>('/platform-security/summary'),
      ]);
      setHealth(h); setMetrics(m); setSummary(s); setLastUpd(new Date());
    } catch (err) {
      setMonError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.');
    } finally {
      setMonLoading(false);
    }
  }, []);

  useEffect(() => { if (isActive) loadMonitoring(); }, [isActive, loadMonitoring]);

  useEffect(() => {
    if (!isActive || paused) return;
    const id = setInterval(loadMonitoring, 30_000);
    return () => clearInterval(id);
  }, [isActive, paused, loadMonitoring]);

  /* ── Alertes actives (platform-security, distinctes des signalements de modération) ── */
  const [psAlerts,     setPsAlerts]     = useState<ActiveAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError,   setAlertsError]   = useState<string | null>(null);

  const loadPsAlerts = useCallback(async () => {
    setAlertsLoading(true); setAlertsError(null);
    try {
      const data = await apiFetch<{ count: number; alerts: ActiveAlert[] }>('/platform-security/alerts');
      setPsAlerts(data.alerts);
    } catch (err) {
      setAlertsError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.');
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => { if (isActive) loadPsAlerts(); }, [isActive, loadPsAlerts]);
  useEffect(() => {
    if (!isActive || paused) return;
    const id = setInterval(loadPsAlerts, 30_000);
    return () => clearInterval(id);
  }, [isActive, paused, loadPsAlerts]);

  const ackAlert = async (ruleId: string) => {
    try {
      await apiFetch(`/platform-security/alerts/${encodeURIComponent(ruleId)}/ack`, { method: 'POST' });
      await loadPsAlerts();
    } catch { /* toast géré au niveau du bouton via l'état d'erreur global */ }
  };
  const resolvePsAlert = async (ruleId: string) => {
    try {
      await apiFetch(`/platform-security/alerts/${encodeURIComponent(ruleId)}/resolve`, { method: 'POST' });
      await loadPsAlerts();
    } catch { /* silencieux — la liste ne bougera simplement pas */ }
  };

  /* ── Incidents ── */
  const [incidents,        setIncidents]        = useState<PlatformIncident[]>([]);
  const [incidentsLoading, setIncidentsLoading]  = useState(false);
  const [incidentsError,   setIncidentsError]    = useState<string | null>(null);
  const [statusFilter,     setStatusFilter]      = useState<IncidentStatus | 'all'>('all');
  const [expandedId,       setExpandedId]        = useState<string | null>(null);
  const [showOpenModal,    setShowOpenModal]     = useState(false);

  const loadIncidents = useCallback(async () => {
    setIncidentsLoading(true); setIncidentsError(null);
    try {
      const data = await apiFetch<PlatformIncident[]>('/platform-security/incidents', {
        params: { status: statusFilter !== 'all' ? statusFilter : undefined, limit: 100 },
      });
      setIncidents(data);
    } catch (err) {
      setIncidentsError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.');
    } finally {
      setIncidentsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { if (isActive && tab === 'incidents') loadIncidents(); }, [isActive, tab, loadIncidents]);

  /* ── Conformité (rétention + rapport) et sauvegarde ── */
  const [retentionPolicy, setRetentionPolicy] = useState<RetentionPolicy | null>(null);
  const [retentionCheck,  setRetentionCheck]  = useState<RetentionCheckResult | null>(null);
  const [checkRunning,    setCheckRunning]    = useState(false);
  const [report,          setReport]          = useState<ComplianceReport | null>(null);
  const [reportRunning,   setReportRunning]   = useState(false);
  const [reportFrom,      setReportFrom]      = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [reportTo,        setReportTo]        = useState(() => new Date().toISOString().slice(0, 10));
  const [backupStrategy,  setBackupStrategy]  = useState<BackupStrategy | null>(null);
  const [recoveryPlan,    setRecoveryPlan]    = useState<DisasterRecoveryPlan | null>(null);
  const [checklist,       setChecklist]       = useState<ChecklistItem[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError,   setComplianceError]   = useState<string | null>(null);

  const loadCompliance = useCallback(async () => {
    setComplianceLoading(true); setComplianceError(null);
    try {
      const [pol, strat, plan, list] = await Promise.all([
        apiFetch<RetentionPolicy>('/platform-security/compliance/retention'),
        apiFetch<BackupStrategy>('/platform-security/backup/strategy'),
        apiFetch<DisasterRecoveryPlan>('/platform-security/backup/recovery-plan'),
        apiFetch<ChecklistItem[]>('/platform-security/backup/checklist'),
      ]);
      setRetentionPolicy(pol); setBackupStrategy(strat); setRecoveryPlan(plan); setChecklist(list);
    } catch (err) {
      setComplianceError(err instanceof ApiError ? err.message : 'Erreur de connexion au serveur.');
    } finally {
      setComplianceLoading(false);
    }
  }, []);

  useEffect(() => { if (isActive && tab === 'compliance') loadCompliance(); }, [isActive, tab, loadCompliance]);

  const runCheck = async () => {
    setCheckRunning(true);
    try {
      const res = await apiFetch<RetentionCheckResult>('/platform-security/compliance/check');
      setRetentionCheck(res);
    } catch (err) {
      setComplianceError(err instanceof ApiError ? err.message : 'Échec de la vérification.');
    } finally {
      setCheckRunning(false);
    }
  };

  const generateReport = async () => {
    setReportRunning(true);
    try {
      const res = await apiFetch<ComplianceReport>('/platform-security/compliance/report', {
        params: { from: new Date(reportFrom).toISOString(), to: new Date(reportTo + 'T23:59:59').toISOString() },
      });
      setReport(res);
    } catch (err) {
      setComplianceError(err instanceof ApiError ? err.message : 'Échec de la génération du rapport.');
    } finally {
      setReportRunning(false);
    }
  };

  /* ── Ouverture d'incident ── */
  const [incForm, setIncForm] = useState({ title: '', description: '', severity: 'p3_medium' as IncidentSeverity, affectedComponents: '' });
  const [incSubmitting, setIncSubmitting] = useState(false);

  const submitIncident = async () => {
    if (!incForm.title.trim() || !incForm.description.trim()) return;
    setIncSubmitting(true);
    try {
      await apiFetch('/platform-security/incidents', {
        method: 'POST',
        body: {
          title: incForm.title.trim(),
          description: incForm.description.trim(),
          severity: incForm.severity,
          affectedComponents: incForm.affectedComponents.split(',').map(s => s.trim()).filter(Boolean),
        },
      });
      setShowOpenModal(false);
      setIncForm({ title: '', description: '', severity: 'p3_medium', affectedComponents: '' });
      await loadIncidents();
    } catch (err) {
      setIncidentsError(err instanceof ApiError ? err.message : 'Échec de la création de l\'incident.');
    } finally {
      setIncSubmitting(false);
    }
  };

  const patchIncidentStatus = async (id: string, status: IncidentStatus) => {
    try {
      await apiFetch(`/platform-security/incidents/${id}`, { method: 'PATCH', body: { status } });
      await loadIncidents();
    } catch (err) {
      setIncidentsError(err instanceof ApiError ? err.message : 'Échec de la mise à jour.');
    }
  };

  const [timelineDraft, setTimelineDraft] = useState('');
  const addTimeline = async (id: string) => {
    if (!timelineDraft.trim()) return;
    try {
      await apiFetch(`/platform-security/incidents/${id}/timeline`, { method: 'POST', body: { message: timelineDraft.trim() } });
      setTimelineDraft('');
      await loadIncidents();
    } catch (err) {
      setIncidentsError(err instanceof ApiError ? err.message : 'Échec de l\'ajout à la timeline.');
    }
  };

  const [resolveDraft, setResolveDraft] = useState({ rootCause: '', remediation: '' });
  const resolveIncidentAction = async (id: string) => {
    if (!resolveDraft.rootCause.trim() || !resolveDraft.remediation.trim()) return;
    try {
      await apiFetch(`/platform-security/incidents/${id}/resolve`, { method: 'POST', body: resolveDraft });
      setResolveDraft({ rootCause: '', remediation: '' });
      await loadIncidents();
    } catch (err) {
      setIncidentsError(err instanceof ApiError ? err.message : 'Échec de la résolution.');
    }
  };

  const closeIncidentAction = async (id: string) => {
    try {
      await apiFetch(`/platform-security/incidents/${id}/close`, { method: 'POST' });
      await loadIncidents();
    } catch (err) {
      setIncidentsError(err instanceof ApiError ? err.message : 'Échec de la clôture.');
    }
  };

  const openIncidentsCount = useMemo(
    () => incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length,
    [incidents],
  );

  const exportSnapshot = () => {
    dl(JSON.stringify({ generatedAt: new Date().toISOString(), health, metrics, summary, alerts: psAlerts }, null, 2),
      `platform-security-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  if (!isActive) return null;

  return (
    <div className="section active">

      {/* ── En-tête ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {health && (
            <span style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: HEALTH_CFG[health.overall].color,
              boxShadow: `0 0 0 3px ${HEALTH_CFG[health.overall].bg}`,
            }} />
          )}
          <div>
            <div className="ph-title">Sécurité <mark>&amp; Conformité</mark></div>
            <div className="ph-sub">
              {paused ? '⏸ Auto-refresh suspendu' : lastUpd ? `Monitoring actif — dernière mise à jour ${lastUpd.toLocaleTimeString('fr-FR')}` : 'Chargement…'}
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={loadMonitoring} title="Actualiser">🔄</button>
          <button className={`btn btn-sm ${paused ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPaused(p => !p)}>
            {paused ? '▶ Reprendre' : '⏸ Pause'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exportSnapshot}>⬇ Export JSON</button>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          { id: 'monitoring', label: '📊 Monitoring' },
          { id: 'alerts',     label: `🚨 Alertes${psAlerts.filter(a => !a.acknowledgedAt).length ? ` (${psAlerts.filter(a => !a.acknowledgedAt).length})` : ''}` },
          { id: 'incidents',  label: `🧯 Incidents${openIncidentsCount ? ` (${openIncidentsCount})` : ''}` },
          { id: 'compliance', label: '📋 Conformité & Sauvegarde' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 10, border: `1px solid ${tab === t.id ? 'var(--acid)' : 'var(--border)'}`, background: tab === t.id ? 'var(--acid-dim)' : 'none', color: tab === t.id ? 'var(--acid)' : 'var(--txt-3)', cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ MONITORING ═══════════════════ */}
      {tab === 'monitoring' && (
        <>
          {monError && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 8, fontSize: 12, color: 'var(--rose,#dc2626)' }}>
              ⚠️ {monError}
            </div>
          )}

          {summary && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <MetricCard label="Événements 24h"     value={summary.last24hEvents}     icon="📡" color="var(--sky)" />
              <MetricCard label="Événements critiques" value={summary.criticalEvents}  icon="🔴" color="#ef4444" warning={summary.criticalEvents > 0} />
              <MetricCard label="Alertes actives"     value={summary.activeAlerts}      icon="🚨" color="#f59e0b" warning={summary.activeAlerts > 0} />
              <MetricCard label="Incidents ouverts"   value={summary.openIncidents}     icon="🧯" color="#f97316" warning={summary.openIncidents > 0} />
              <MetricCard label="Brute-force bloqués" value={summary.bruteForceBlocks}  icon="🛡️" color="var(--violet)" />
              <MetricCard label="Anomalies détectées" value={summary.anomaliesDetected} icon="👁️" color="var(--acid)" />
            </div>
          )}

          {/* Santé des composants */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div>
                <div className="card-title">Santé des composants</div>
                <div className="card-sub">{health ? `${health.components.filter(c => c.status === 'healthy').length} / ${health.components.length} opérationnels — vérifié en ${health.totalCheckMs}ms` : 'Chargement…'}</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 560 }}>
                <thead><tr>
                  <th style={{ fontWeight: 700, fontSize: 11 }}>Composant</th>
                  <th style={{ fontWeight: 700, fontSize: 11 }}>Statut</th>
                  <th style={{ fontWeight: 700, fontSize: 11 }}>Latence</th>
                  <th style={{ fontWeight: 700, fontSize: 11 }}>Détails</th>
                </tr></thead>
                <tbody>
                  {(health?.components ?? []).map(c => (
                    <tr key={c.name}>
                      <td style={{ fontWeight: 600, fontSize: 12.5 }}>{c.name}</td>
                      <td><StatusDot status={c.status} /></td>
                      <td style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>{c.latencyMs != null ? `${c.latencyMs} ms` : '—'}</td>
                      <td style={{ fontSize: 11, color: c.error ? '#ef4444' : 'var(--txt-3)' }}>{c.error ?? (c.details ? JSON.stringify(c.details) : '—')}</td>
                    </tr>
                  ))}
                  {monLoading && !health && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--txt-3)' }}>Chargement…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Métriques process / http / events */}
          {metrics && (
            <div className="grid-collapse-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="card">
                <div className="card-head"><div className="card-title">Processus</div></div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <div>Uptime : <b>{fmtDur(metrics.process.uptimeMs)}</b></div>
                  <div>Mémoire utilisée : <b>{metrics.process.memoryUsedMb} Mo</b> ({metrics.process.memoryUsedPct}%)</div>
                  <div>Heap total : <b>{metrics.process.memoryHeapTotalMb} Mo</b></div>
                  <div>RSS : <b>{metrics.process.rssMb} Mo</b></div>
                </div>
              </div>
              <div className="card">
                <div className="card-head"><div className="card-title">HTTP</div></div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <div>Requêtes totales : <b>{metrics.http.totalRequests.toLocaleString('fr')}</b></div>
                  <div>Requêtes actives : <b>{metrics.http.activeRequests}</b></div>
                  <div>Taux d'erreur : <b style={{ color: metrics.http.errorRatePct > 5 ? '#ef4444' : undefined }}>{metrics.http.errorRatePct}%</b> ({metrics.http.errorCount})</div>
                  <div>Durée moyenne : <b>{metrics.http.avgDurationMs} ms</b></div>
                </div>
              </div>
              <div className="card">
                <div className="card-head"><div className="card-title">Événements</div></div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                  <div>Publiés : <b>{metrics.events.published.toLocaleString('fr')}</b></div>
                  <div>Consommés : <b>{metrics.events.consumed.toLocaleString('fr')}</b></div>
                  <div>Échoués : <b style={{ color: metrics.events.failed > 0 ? '#ef4444' : undefined }}>{metrics.events.failed}</b></div>
                  <div>File morte (DLQ) : <b>{metrics.events.dlqSize}</b> — taux d'échec {metrics.events.failureRatePct}%</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ ALERTES ═══════════════════ */}
      {tab === 'alerts' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Alertes actives — moteur de sécurité</div>
              <div className="card-sub">Distinctes des signalements de modération (voir l'onglet Signalements)</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadPsAlerts} disabled={alertsLoading}>{alertsLoading ? '⏳' : '🔄'}</button>
          </div>
          {alertsError && <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--rose,#dc2626)' }}>⚠️ {alertsError}</div>}
          <div>
            {psAlerts.map(a => {
              const cfg = PS_SEV_CFG[a.severity];
              return (
                <div key={a.id} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: cfg.bg }}>
                  <div style={{ width: 4, flexShrink: 0, borderRadius: 4, background: cfg.color, alignSelf: 'stretch' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5 }}>{a.component}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, color: cfg.color, padding: '1px 6px', borderRadius: 10, border: `1px solid ${cfg.color}40` }}>{cfg.label}</span>
                      {a.count > 1 && <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>×{a.count}</span>}
                      {a.acknowledgedAt && <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>✓ Acquittée</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt-2)', lineHeight: 1.5 }}>{a.message}</div>
                    <div style={{ marginTop: 5, display: 'flex', gap: 12, fontSize: 10, color: 'var(--txt-3)' }}>
                      <span>🕐 Déclenchée {fmtDT(a.triggeredAt)}</span>
                      <span>👁 Vue {fmtDT(a.lastSeenAt)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexShrink: 0 }}>
                    {!a.acknowledgedAt && <button className="btn btn-ghost btn-xs" onClick={() => ackAlert(a.ruleId)}>Acquitter</button>}
                    <button className="btn btn-ghost btn-xs" onClick={() => resolvePsAlert(a.ruleId)}>✅ Résoudre</button>
                  </div>
                </div>
              );
            })}
            {!alertsLoading && psAlerts.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--txt-3)' }}>✅ Aucune alerte active</div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ INCIDENTS ═══════════════════ */}
      {tab === 'incidents' && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Incidents plateforme</div>
              <div className="card-sub">{incidents.length} incident{incidents.length > 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="sel" value={statusFilter} onChange={e => setStatusFilter(e.target.value as IncidentStatus | 'all')}>
                <option value="all">Tous statuts</option>
                {(Object.keys(INC_STATUS_CFG) as IncidentStatus[]).map(s => <option key={s} value={s}>{INC_STATUS_CFG[s].label}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={loadIncidents} disabled={incidentsLoading}>{incidentsLoading ? '⏳' : '🔄'}</button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowOpenModal(true)}>+ Ouvrir un incident</button>
            </div>
          </div>
          {incidentsError && <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--rose,#dc2626)' }}>⚠️ {incidentsError}</div>}

          <div>
            {incidents.map(inc => {
              const isOpen = expandedId === inc.id;
              return (
                <div key={inc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div onClick={() => setExpandedId(isOpen ? null : inc.id)} style={{ display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--txt-3)' }}>{inc.reference}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, color: INC_SEV_CFG[inc.severity].color, border: `1px solid ${INC_SEV_CFG[inc.severity].color}40` }}>{INC_SEV_CFG[inc.severity].label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, color: INC_STATUS_CFG[inc.status].color, border: `1px solid ${INC_STATUS_CFG[inc.status].color}40` }}>{INC_STATUS_CFG[inc.status].label}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 12.5 }}>{inc.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{fmtDT(inc.detectedAt)}</span>
                    <span style={{ fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '4px 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.6 }}>{inc.description}</div>
                      {inc.affectedComponents.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>Composants affectés : {inc.affectedComponents.join(', ')}</div>
                      )}

                      {/* Timeline */}
                      <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const }}>Timeline</div>
                        {inc.timeline.map((t, i) => (
                          <div key={i} style={{ fontSize: 11.5, display: 'flex', gap: 8 }}>
                            <span style={{ color: 'var(--txt-3)', flexShrink: 0 }}>{fmtDT(t.timestamp)}</span>
                            <span>{t.message}{t.actor ? ` — ${t.actor}` : ''}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                          <input className="input-field" style={{ flex: 1 }} placeholder="Ajouter une note à la timeline…" value={timelineDraft} onChange={e => setTimelineDraft(e.target.value)} />
                          <button className="btn btn-ghost btn-xs" onClick={() => addTimeline(inc.id)}>Ajouter</button>
                        </div>
                      </div>

                      {/* Actions statut */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>Changer le statut :</span>
                        {(['open', 'investigating', 'mitigated'] as IncidentStatus[]).map(s => (
                          <button key={s} className="btn btn-ghost btn-xs" disabled={inc.status === s} onClick={() => patchIncidentStatus(inc.id, s)}>{INC_STATUS_CFG[s].label}</button>
                        ))}
                      </div>

                      {/* Résolution */}
                      {inc.status !== 'resolved' && inc.status !== 'closed' && (
                        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const }}>Résoudre l'incident</div>
                          <textarea className="input-field" placeholder="Cause racine" rows={2} value={resolveDraft.rootCause} onChange={e => setResolveDraft(d => ({ ...d, rootCause: e.target.value }))} />
                          <textarea className="input-field" placeholder="Remédiation appliquée" rows={2} value={resolveDraft.remediation} onChange={e => setResolveDraft(d => ({ ...d, remediation: e.target.value }))} />
                          <button className="btn btn-primary btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => resolveIncidentAction(inc.id)}>✅ Marquer résolu</button>
                        </div>
                      )}
                      {inc.status === 'resolved' && (
                        <div>
                          {inc.rootCause && <div style={{ fontSize: 11.5, marginBottom: 4 }}><b>Cause racine :</b> {inc.rootCause}</div>}
                          {inc.remediation && <div style={{ fontSize: 11.5, marginBottom: 8 }}><b>Remédiation :</b> {inc.remediation}</div>}
                          <button className="btn btn-ghost btn-xs" onClick={() => closeIncidentAction(inc.id)}>🔒 Clôturer</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {!incidentsLoading && incidents.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--txt-3)' }}>Aucun incident{statusFilter !== 'all' ? ' pour ce statut' : ''}</div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ CONFORMITÉ & SAUVEGARDE ═══════════════════ */}
      {tab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {complianceError && <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 8, fontSize: 12, color: 'var(--rose,#dc2626)' }}>⚠️ {complianceError}</div>}

          {/* Politique de rétention */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Politique de rétention des données</div>
                <div className="card-sub">Fixée par obligation légale — non modifiable via l'interface</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={runCheck} disabled={checkRunning}>{checkRunning ? '⏳ Vérification…' : '🔍 Lancer une vérification'}</button>
            </div>
            {retentionPolicy && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: '12px 16px' }}>
                {[
                  ['Logs financiers', `${retentionPolicy.financialAuditLogsYears} ans`],
                  ['Événements de sécurité', `${retentionPolicy.securityEventsYears} ans`],
                  ['Métriques système', `${retentionPolicy.metricsRetentionDays} jours`],
                  ['Incidents', `${retentionPolicy.incidentsRetentionYears} ans`],
                  ["Journal d'audit général", `${retentionPolicy.generalAuditLogsYears} ans`],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {retentionCheck && (
              <div style={{ padding: '0 16px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: retentionCheck.totalRecordsToArchive > 0 ? '#f59e0b' : '#10b981' }}>
                  {retentionCheck.totalRecordsToArchive > 0 ? `⚠️ ${retentionCheck.totalRecordsToArchive} enregistrement(s) dépassent la rétention` : '✅ Toutes les tables sont conformes'}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl">
                    <thead><tr><th>Table</th><th>Rétention</th><th>À archiver</th><th>Plus ancien</th></tr></thead>
                    <tbody>
                      {retentionCheck.tables.map(t => (
                        <tr key={t.name}>
                          <td style={{ fontFamily: 'var(--font-m)', fontSize: 11.5 }}>{t.name}</td>
                          <td style={{ fontSize: 11.5 }}>{t.retentionYears.toFixed(2)} ans</td>
                          <td style={{ fontSize: 11.5, fontWeight: 700, color: t.recordsToArchive > 0 ? '#f59e0b' : undefined }}>{t.recordsToArchive}</td>
                          <td style={{ fontSize: 11.5 }}>{fmtDT(t.oldestRecord)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Rapport de conformité */}
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Rapport de conformité</div>
                <div className="card-sub">Sécurité, incidents et rétention sur une période</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input-field" type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ padding: '4px 8px' }} />
                <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>→</span>
                <input className="input-field" type="date" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ padding: '4px 8px' }} />
                <button className="btn btn-primary btn-sm" onClick={generateReport} disabled={reportRunning}>{reportRunning ? '⏳' : '📄 Générer'}</button>
              </div>
            </div>
            {report && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  <MetricCard label="Événements sécurité" value={report.securityEvents.total} icon="📡" color="var(--sky)" />
                  <MetricCard label="Incidents"            value={report.incidents.total}      icon="🧯" color="#f97316" />
                  <MetricCard label="Incidents ouverts"    value={report.incidents.openCount}   icon="🔓" color="#ef4444" warning={report.incidents.openCount > 0} />
                  <MetricCard label="Résolution moy."      value={report.incidents.avgResolutionHours != null ? report.incidents.avgResolutionHours.toFixed(1) : '—'} unit="h" icon="⏱️" color="var(--acid)" />
                </div>
                {report.securityEvents.topIps.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>IPs les plus actives</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {report.securityEvents.topIps.map(ip => (
                        <span key={ip.ip} style={{ fontSize: 11, fontFamily: 'var(--font-m)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>{ip.ip} — {ip.count}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Recommandations</div>
                  {report.recommendations.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: i < report.recommendations.length - 1 ? '1px solid var(--border)' : undefined }}>• {r}</div>
                  ))}
                </div>
                <button className="btn btn-ghost btn-xs" style={{ alignSelf: 'flex-start' }}
                  onClick={() => dl(JSON.stringify(report, null, 2), `rapport-conformite-${reportFrom}-${reportTo}.json`, 'application/json')}>
                  ⬇ Exporter le rapport JSON
                </button>
              </div>
            )}
          </div>

          {/* Stratégie de sauvegarde */}
          {backupStrategy && (
            <div className="card">
              <div className="card-head"><div className="card-title">Stratégie de sauvegarde</div></div>
              <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Base de données</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                    Fréquence : <b>{backupStrategy.database.frequency}</b> · Type : <b>{backupStrategy.database.type}</b> · Rétention : <b>{backupStrategy.database.retentionDays}j</b><br />
                    Outil : {backupStrategy.database.tool}<br />
                    <span style={{ color: 'var(--txt-3)' }}>{backupStrategy.database.description}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Fichiers</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                    Fréquence : <b>{backupStrategy.files.frequency}</b> · Rétention : <b>{backupStrategy.files.retentionDays}j</b><br />
                    Outil : {backupStrategy.files.tool}<br />
                    <span style={{ color: 'var(--txt-3)' }}>{backupStrategy.files.description}</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 16px 16px', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12.5 }}>
                <div>RPO : <b>{backupStrategy.rpoHours}h</b></div>
                <div>RTO : <b>{backupStrategy.rtoHours}h</b></div>
                <div>Mis à jour : <b>{backupStrategy.lastUpdated}</b></div>
              </div>
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, marginBottom: 6 }}>Contacts d'urgence</div>
                {backupStrategy.contacts.map(c => <div key={c} style={{ fontSize: 12 }}>• {c}</div>)}
              </div>
            </div>
          )}

          {/* Plan de reprise */}
          {recoveryPlan && (
            <div className="card">
              <div className="card-head"><div className="card-title">Plan de reprise après incident</div></div>
              <div style={{ padding: '0 16px 16px' }}>
                {recoveryPlan.steps.map(s => (
                  <div key={s.order} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--acid-dim)', color: 'var(--acid)', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.order}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{s.title} <span style={{ fontWeight: 400, color: 'var(--txt-3)', fontSize: 11 }}>— {s.responsible} · ~{s.estimatedMinutes}min</span></div>
                      <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginTop: 2 }}>{s.description}</div>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, fontSize: 12 }}>
                  <div><b>Escalade niveau 1 :</b> {recoveryPlan.escalation.level1}</div>
                  <div><b>Escalade niveau 2 :</b> {recoveryPlan.escalation.level2}</div>
                  <div><b>Escalade niveau 3 :</b> {recoveryPlan.escalation.level3}</div>
                </div>
              </div>
            </div>
          )}

          {/* Checklist de vérification */}
          {checklist.length > 0 && (
            <div className="card">
              <div className="card-head"><div className="card-title">Checklist de vérification</div></div>
              <div style={{ padding: '0 16px 16px' }}>
                {checklist.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < checklist.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, height: 'fit-content', textTransform: 'uppercase' as const, background: c.status === 'automated' ? 'var(--acid-dim)' : 'var(--gold-dim)', color: c.status === 'automated' ? 'var(--acid)' : 'var(--gold)' }}>{c.status === 'automated' ? 'Auto' : 'Manuel'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{c.check}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{c.notes}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {complianceLoading && <div style={{ textAlign: 'center', padding: 24, color: 'var(--txt-3)' }}>Chargement…</div>}
        </div>
      )}

      {/* ── Modal : ouvrir un incident ── */}
      {showOpenModal && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget && !incSubmitting) setShowOpenModal(false); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <div style={{ fontFamily: 'var(--font-h)', fontWeight: 900, fontSize: 17 }}>🧯 Ouvrir un incident</div>
              <button className="modal-close" onClick={() => setShowOpenModal(false)} disabled={incSubmitting}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="mf" style={{ marginBottom: 0 }}>
                <label>Titre <span style={{ color: 'var(--rose)' }}>*</span></label>
                <input className="input-field" value={incForm.title} onChange={e => setIncForm(f => ({ ...f, title: e.target.value }))} disabled={incSubmitting} />
              </div>
              <div className="mf" style={{ marginBottom: 0 }}>
                <label>Description <span style={{ color: 'var(--rose)' }}>*</span></label>
                <textarea className="input-field" rows={3} value={incForm.description} onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))} disabled={incSubmitting} />
              </div>
              <div className="mf" style={{ marginBottom: 0 }}>
                <label>Sévérité</label>
                <select className="input-field" value={incForm.severity} onChange={e => setIncForm(f => ({ ...f, severity: e.target.value as IncidentSeverity }))} disabled={incSubmitting}>
                  {(Object.keys(INC_SEV_CFG) as IncidentSeverity[]).map(s => <option key={s} value={s}>{INC_SEV_CFG[s].label}</option>)}
                </select>
              </div>
              <div className="mf" style={{ marginBottom: 0 }}>
                <label>Composants affectés (séparés par des virgules)</label>
                <input className="input-field" placeholder="paiement, wallet, notifications" value={incForm.affectedComponents} onChange={e => setIncForm(f => ({ ...f, affectedComponents: e.target.value }))} disabled={incSubmitting} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-primary" disabled={incSubmitting || !incForm.title.trim() || !incForm.description.trim()} onClick={submitIncident}>
                {incSubmitting ? 'Création…' : 'Ouvrir l\'incident'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
