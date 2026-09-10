/* ================================================================
 * FICHIER : pages/parametres/SanteSection.tsx
 * Section — Tableau de santé du système.
 * Données réelles via GET /platform-security/health|summary|alerts
 * (moteur PlatformSecurityEngine, backend/src/modules/platform-security) —
 * l'ancien commentaire de ce fichier disait "en prod : GET /admin/health",
 * ce endpoint existait déjà, il n'était simplement jamais appelé ici.
 * Le rôle ADMIN a explicitement accès à ces routes (@Roles(ADMIN,
 * SUPER_ADMIN) côté PlatformSecurityController) — seuls les événements
 * de sécurité détaillés, la conformité et les sauvegardes restent
 * réservés au Super Admin (voir le dashboard Super-Admin pour ceux-là).
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';
import { apiFetch, ApiError } from '../../../../shared/services/apiFetch';

type ComponentStatus = 'healthy' | 'degraded' | 'down';

interface ComponentHealth {
  name: string; status: ComponentStatus; latencyMs: number | null;
  details?: Record<string, unknown>; checkedAt: string; error?: string;
}

interface HealthReport {
  overall: ComponentStatus; components: ComponentHealth[]; totalCheckMs: number; timestamp: string;
}

interface SecuritySummary {
  last24hEvents: number; criticalEvents: number; activeAlerts: number;
  openIncidents: number; bruteForceBlocks: number; anomaliesDetected: number;
}

type PSSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
interface ActiveAlert {
  id: string; ruleId: string; severity: PSSeverity; component: string; message: string;
  triggeredAt: string; lastSeenAt: string; count: number; acknowledgedAt?: string;
}

const CARD_CLS: Record<ComponentStatus, string>  = { healthy: 'hCardOk', degraded: 'hCardWarn', down: 'hCardErr' };
const IC_CLS:   Record<ComponentStatus, string>  = { healthy: 'hIcOk',   degraded: 'hIcWarn',   down: 'hIcErr' };
const STATUT_LABEL: Record<ComponentStatus, string> = { healthy: 'Opérationnel', degraded: 'Dégradé', down: 'Hors service' };
const BADGE_CLS: Record<ComponentStatus, string>  = { healthy: 'bdgGreen', degraded: 'bdgAmber', down: 'bdgRed' };

/** Icône Font Awesome selon le nom du composant (les noms viennent du backend, ex: 'database', 'redis', 'email'). */
function iconFor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('data') || n.includes('db') || n.includes('postgres')) return 'fa-database';
  if (n.includes('redis') || n.includes('cache'))                      return 'fa-server';
  if (n.includes('email') || n.includes('mail'))                       return 'fa-envelope';
  if (n.includes('sms'))                                               return 'fa-comment-sms';
  if (n.includes('pay') || n.includes('paiement'))                     return 'fa-mobile-screen-button';
  if (n.includes('storage') || n.includes('cloudinary'))               return 'fa-hard-drive';
  if (n.includes('queue') || n.includes('event'))                      return 'fa-list-check';
  return 'fa-server';
}

function relTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1)  return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)}h`;
}

export default function SanteSection({ onToast }: SectionProps) {
  const [health,  setHealth]  = useState<HealthReport | null>(null);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [alerts,  setAlerts]  = useState<ActiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const [h, s, a] = await Promise.all([
        apiFetch<HealthReport>('/platform-security/health'),
        apiFetch<SecuritySummary>('/platform-security/summary'),
        apiFetch<{ count: number; alerts: ActiveAlert[] }>('/platform-security/alerts'),
      ]);
      setHealth(h); setSummary(s); setAlerts(a.alerts);
      if (silent) onToast('Vérification de santé relancée', 'i');
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : 'Impossible de charger la santé du système', 'w');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const ackAlert = async (ruleId: string) => {
    try {
      await apiFetch(`/platform-security/alerts/${encodeURIComponent(ruleId)}/ack`, { method: 'POST' });
      await load();
    } catch { onToast('Échec de l\'acquittement', 'w'); }
  };
  const resolveAlert = async (ruleId: string) => {
    try {
      await apiFetch(`/platform-security/alerts/${encodeURIComponent(ruleId)}/resolve`, { method: 'POST' });
      await load();
      onToast('Alerte résolue', 's');
    } catch { onToast('Échec de la résolution', 'w'); }
  };

  if (loading) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={styles.cardBody} style={{ textAlign: 'center', padding: '2rem', color: 'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" /> Vérification de la santé du système…
          </div>
        </div>
      </div>
    );
  }

  const global = health?.overall ?? 'healthy';
  const uptime = health?.components.filter(c => c.status === 'healthy').length ?? 0;
  const degraded = health?.components.filter(c => c.status === 'degraded').length ?? 0;
  const down = health?.components.filter(c => c.status === 'down').length ?? 0;

  return (
    <div className={styles.secBody}>

      {/* ── Statut global ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-heart-pulse" /> Statut global</div>
            <div className={styles.cardSub}>{health ? `Dernière vérification : ${relTime(health.timestamp)} (${health.totalCheckMs}ms)` : '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className={`${styles.bdg} ${styles[BADGE_CLS[global] as keyof typeof styles]}`}>
              <i className="fas fa-circle" /> {STATUT_LABEL[global]}
            </span>
            <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => load(true)} disabled={refreshing}>
              <i className={`fas ${refreshing ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> Actualiser
            </button>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.miniKpis}>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--emerald)' }} />
              <i className="fas fa-circle-check" style={{ color: 'var(--emerald)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{uptime}</div>
              <div className={styles.mkpiL}>Composants OK</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--amber)' }} />
              <i className="fas fa-triangle-exclamation" style={{ color: 'var(--amber)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{degraded}</div>
              <div className={styles.mkpiL}>Dégradés</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: '#ef4444' }} />
              <i className="fas fa-circle-xmark" style={{ color: '#ef4444', fontSize: 13 }} />
              <div className={styles.mkpiV}>{down}</div>
              <div className={styles.mkpiL}>Hors service</div>
            </div>
            <div className={styles.mkpi}>
              <div className={styles.mkpiStripe} style={{ background: 'var(--blue)' }} />
              <i className="fas fa-bell" style={{ color: 'var(--blue)', fontSize: 13 }} />
              <div className={styles.mkpiV}>{summary?.activeAlerts ?? 0}</div>
              <div className={styles.mkpiL}>Alertes actives</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Grille des composants ── */}
      <div className={styles.healthGrid}>
        {(health?.components ?? []).map(c => (
          <div key={c.name} className={`${styles.hCard} ${styles[CARD_CLS[c.status] as keyof typeof styles]}`}>
            <div className={styles.hTop}>
              <div className={`${styles.hIc} ${styles[IC_CLS[c.status] as keyof typeof styles]}`}>
                <i className={`fas ${iconFor(c.name)}`} />
              </div>
              <span className={`${styles.bdg} ${styles[BADGE_CLS[c.status] as keyof typeof styles]}`} style={{ fontSize: 9, padding: '2px 7px' }}>
                {STATUT_LABEL[c.status]}
              </span>
            </div>
            <div className={styles.hName}>{c.name}</div>
            <div className={styles.hPct}>{c.latencyMs != null ? `${c.latencyMs} ms` : '—'}</div>
            <div className={styles.hCheck}>{c.error ?? `Vérifié ${relTime(c.checkedAt)}`}</div>
          </div>
        ))}
        {!health?.components.length && (
          <div style={{ padding: 24, color: 'var(--t3)', textAlign: 'center' }}>Aucune donnée de santé disponible.</div>
        )}
      </div>

      {/* ── Alertes actives ── */}
      {alerts.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}><i className="fas fa-bell" /> Alertes actives</div>
              <div className={styles.cardSub}>{alerts.length} alerte{alerts.length > 1 ? 's' : ''} du moteur de sécurité — distinctes des signalements de modération</div>
            </div>
          </div>
          <div className={styles.cardBody}>
            {alerts.map(a => (
              <div key={a.id} className={styles.toggleRow}>
                <div className={styles.tIc} style={{ background: 'rgba(245,158,11,.1)', color: 'var(--amber)' }}>
                  <i className="fas fa-triangle-exclamation" />
                </div>
                <div className={styles.tMain}>
                  <div className={styles.tTitle}>{a.component} — {a.message}</div>
                  <div className={styles.tDesc}>Déclenchée {relTime(a.triggeredAt)} · ×{a.count}{a.acknowledgedAt ? ' · acquittée' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!a.acknowledgedAt && (
                    <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => ackAlert(a.ruleId)}>Acquitter</button>
                  )}
                  <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`} onClick={() => resolveAlert(a.ruleId)}>Résoudre</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
