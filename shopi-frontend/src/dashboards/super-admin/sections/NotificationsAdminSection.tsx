/* ============================================================
 * FICHIER : src/dashboards/super-admin/sections/NotificationsAdminSection.tsx
 *
 * RÔLE : Dashboard analytique du système de notifications
 *        pour les super-admins.
 *
 * DONNÉES : 3 endpoints GET /admin/notifications/*
 *   - stats         → KPIs globaux + volume par type
 *   - delivery-rates → taux de livraison par canal
 *   - dlq           → état de la file morte
 *
 * CHARTS : SVG inline (même pattern que SystemSection.tsx)
 * ============================================================ */

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import s from './NotificationsAdminSection.module.css';

// ─── Types (miroir du backend) ─────────────────────────────────

interface ITypeVolume      { type: string; count: number; }
interface IGlobalStats {
  period:       { days: number; from: string; to: string };
  totalCreated: number;
  totalUnread:  number;
  unreadRate:   number;
  byType:       ITypeVolume[];
}

interface IChannelRate {
  channel:       string;
  total:         number;
  sent:          number;
  failed:        number;
  skipped:       number;
  deliveryRate:  number;
  avgDurationMs: number | null;
}
interface IDeliveryRates {
  overall:   { total: number; sent: number; failed: number; deliveryRate: number };
  byChannel: IChannelRate[];
}

interface IDlqStats {
  pendingRetries:    number;
  permanentFailures: number;
  topErrors:         { errorCode: string; count: number }[];
}

// ─── Config visuelle canaux ────────────────────────────────────

const CHANNEL_CFG: Record<string, { label: string; color: string }> = {
  in_app: { label: 'IN-APP',  color: 'var(--violet)' },
  push:   { label: 'PUSH',   color: 'var(--sky)'    },
  email:  { label: 'EMAIL',  color: 'var(--gold)'   },
  sms:    { label: 'SMS',    color: 'var(--acid)'   },
};

// Couleur par index pour le bar-chart types
const TYPE_COLORS = [
  'var(--sky)', 'var(--acid)', 'var(--gold)', 'var(--violet)',
  'var(--rose)', 'var(--coral, #FF7043)', 'var(--sky)', 'var(--acid)',
];

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function rateColor(rate: number): string {
  if (rate >= 90) return 'var(--acid)';
  if (rate >= 70) return 'var(--gold)';
  return 'var(--rose)';
}

// ─── Sous-composants ──────────────────────────────────────────

interface KpiCardProps {
  label:   string;
  value:   string;
  sub:     string;
  icon:    string;
  iconBg:  string;
}
function KpiCard({ label, value, sub, icon, iconBg }: KpiCardProps) {
  return (
    <div className={s.kpiCard}>
      <div className={s.kpiTop}>
        <span className={s.kpiLabel}>{label}</span>
        <span className={s.kpiIcon} style={{ background: iconBg }}>{icon}</span>
      </div>
      <div className={s.kpiValue}>{value}</div>
      <div className={s.kpiSub}>{sub}</div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────

interface Props { isActive: boolean; }

export default function NotificationsAdminSection({ isActive }: Props) {

  const [days,      setDays]      = useState(30);
  const [stats,     setStats]     = useState<IGlobalStats | null>(null);
  const [rates,     setRates]     = useState<IDeliveryRates | null>(null);
  const [dlq,       setDlq]       = useState<IDlqStats | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const fetchAll = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const [g, r, q] = await Promise.all([
        apiFetch<IGlobalStats>(`/admin/notifications/stats?days=${d}`),
        apiFetch<IDeliveryRates>(`/admin/notifications/delivery-rates?days=${d}`),
        apiFetch<IDlqStats>('/admin/notifications/dlq'),
      ]);
      setStats(g);
      setRates(r);
      setDlq(q);
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) fetchAll(days);
  }, [isActive, days, fetchAll]);

  const handleDays = (d: number) => {
    setDays(d);
    if (isActive) fetchAll(d);
  };

  // ── Données dérivées ────────────────────────────────────
  const maxTypeCount = stats?.byType?.[0]?.count ?? 1;

  return (
    <div className={`${s.section}${isActive ? ` ${s.active}` : ''}`}>

      {/* ── En-tête ── */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <h2 className={s.title}>Analytiques Notifications</h2>
          <p className={s.subtitle}>
            Taux de livraison, volume par type et état de la file morte
          </p>
        </div>
        <div className={s.periodPicker}>
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              className={`${s.periodBtn}${days === d ? ` ${s.active}` : ''}`}
              onClick={() => handleDays(d)}
            >
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* ── Loader ── */}
      {loading && (
        <div className={s.loader}>
          <span className={s.spinIcon}>⟳</span>
        </div>
      )}

      {/* ── Erreur ── */}
      {error && !loading && (
        <div className={s.loader} style={{ color: 'var(--rose)', fontSize: 14 }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Contenu ── */}
      {!loading && !error && stats && rates && dlq && (
        <>
          {/* ── KPI cards ── */}
          <div className={s.kpiGrid}>
            <KpiCard
              label="Notifications créées"
              value={fmt(stats.totalCreated)}
              sub={`sur ${days} jours`}
              icon="🔔"
              iconBg="rgba(56,191,255,.15)"
            />
            <KpiCard
              label="Taux de livraison global"
              value={`${rates.overall.deliveryRate}%`}
              sub={`${fmt(rates.overall.sent)} livrées / ${fmt(rates.overall.total - rates.byChannel.reduce((a, c) => a + c.skipped, 0))} tentatives`}
              icon="✅"
              iconBg={`${rateColor(rates.overall.deliveryRate)}22`}
            />
            <KpiCard
              label="Taux de non-lecture"
              value={`${stats.unreadRate}%`}
              sub={`${fmt(stats.totalUnread)} non lues / ${fmt(stats.totalCreated)} créées`}
              icon="👁"
              iconBg="rgba(191,127,255,.15)"
            />
            <KpiCard
              label="File morte (DLQ)"
              value={fmt(dlq.pendingRetries + dlq.permanentFailures)}
              sub={`${fmt(dlq.pendingRetries)} en retry · ${fmt(dlq.permanentFailures)} permanent`}
              icon="🚨"
              iconBg={dlq.permanentFailures > 0 ? 'rgba(255,68,100,.15)' : 'rgba(0,200,138,.15)'}
            />
          </div>

          {/* ── Charts row 1 ── */}
          <div className={s.chartsGrid}>

            {/* Volume par type */}
            <div className={s.chartCard}>
              <div className={s.chartTitle}>Volume par type (top 10)</div>
              <div className={s.barList}>
                {stats.byType.length === 0 && (
                  <span style={{ color: 'var(--txt-3)', fontSize: 13 }}>Aucune donnée</span>
                )}
                {stats.byType.map((t, i) => (
                  <div className={s.barRow} key={t.type}>
                    <span className={s.barLabel} title={t.type}>{t.type}</span>
                    <div className={s.barTrack}>
                      <div
                        className={s.barFill}
                        style={{
                          width:      `${Math.round((t.count / maxTypeCount) * 100)}%`,
                          background: TYPE_COLORS[i % TYPE_COLORS.length],
                        }}
                      />
                    </div>
                    <span className={s.barCount}>{fmt(t.count)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Taux de livraison par canal */}
            <div className={s.chartCard}>
              <div className={s.chartTitle}>Taux de livraison par canal</div>
              <div className={s.channelGrid}>
                {(['in_app', 'push', 'email', 'sms'] as const).map(ch => {
                  const cfg  = CHANNEL_CFG[ch];
                  const data = rates.byChannel.find(c => c.channel === ch);
                  const rate = data?.deliveryRate ?? 0;
                  const total = data?.total ?? 0;
                  return (
                    <div className={s.channelCard} key={ch}>
                      <div className={s.channelName} style={{ color: cfg.color }}>
                        {cfg.label}
                      </div>
                      <div
                        className={s.channelRate}
                        style={{ color: total > 0 ? rateColor(rate) : 'var(--txt-3)' }}
                      >
                        {total > 0 ? `${rate}%` : '—'}
                      </div>
                      <div className={s.channelBar}>
                        <div
                          className={s.channelBarFill}
                          style={{ width: `${rate}%`, background: cfg.color }}
                        />
                      </div>
                      <div className={s.channelMeta}>
                        {total > 0
                          ? `${fmt(data!.sent)} / ${fmt(total)} · ${data!.avgDurationMs != null ? `${data!.avgDurationMs}ms` : '—'}`
                          : 'Pas de données'
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── DLQ ── */}
          <div className={s.chartCard}>
            <div className={s.chartTitle}>
              État de la file morte (DLQ)
              {dlq.permanentFailures > 0 && (
                <span
                  className={s.pill}
                  style={{ marginLeft: 10, background: 'rgba(255,68,100,.15)', color: 'var(--rose)' }}
                >
                  ⚠ {dlq.permanentFailures} permanent{dlq.permanentFailures > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className={s.dlqGrid}>

              <div className={s.dlqStat}>
                <div className={s.dlqStatLabel}>En attente de retry</div>
                <div
                  className={s.dlqStatValue}
                  style={{ color: dlq.pendingRetries > 0 ? 'var(--gold)' : 'var(--acid)' }}
                >
                  {dlq.pendingRetries}
                </div>
                <div className={s.dlqStatSub}>
                  Livraisons échouées avec retry possible
                </div>
              </div>

              <div className={s.dlqStat}>
                <div className={s.dlqStatLabel}>Échecs permanents</div>
                <div
                  className={s.dlqStatValue}
                  style={{ color: dlq.permanentFailures > 0 ? 'var(--rose)' : 'var(--acid)' }}
                >
                  {dlq.permanentFailures}
                </div>
                <div className={s.dlqStatSub}>
                  Tokens invalides, emails bouncés, etc.
                </div>
              </div>

              {dlq.topErrors.length > 0 && (
                <div className={s.dlqStat} style={{ gridColumn: '1 / -1' }}>
                  <div className={s.dlqStatLabel} style={{ marginBottom: 10 }}>Top codes d'erreur</div>
                  <table className={s.errorTable}>
                    <thead>
                      <tr>
                        <th>Code d'erreur</th>
                        <th style={{ textAlign: 'right' }}>Occurrences</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dlq.topErrors.map(e => (
                        <tr key={e.errorCode}>
                          <td>{e.errorCode}</td>
                          <td>{e.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {dlq.topErrors.length === 0 && (
                <div className={s.dlqStat} style={{ gridColumn: '1 / -1', alignItems: 'center' }}>
                  <div className={s.dlqStatValue} style={{ color: 'var(--acid)', fontSize: 20 }}>
                    ✓ Aucune erreur enregistrée
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
