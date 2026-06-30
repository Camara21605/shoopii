/*
 * RetourStats.tsx — KPI strip + graphiques des retours.
 */
import React from 'react';
import type { ReturnStats } from '../../hooks/useRetours';
import s from './RetoursPage.module.css';

const REASON_LABELS: Record<string, string> = {
  defective:      'Produit défectueux',
  not_matching:   'Ne correspond pas',
  change_of_mind: 'Changement d\'avis',
  wrong_item:     'Mauvais article',
  damaged:        'Endommagé',
  expired:        'Produit périmé',
  other:          'Autre',
};

const REASON_COLORS: Record<string, string> = {
  defective:      '#DC2626',
  not_matching:   '#7C3AED',
  change_of_mind: '#F59E0B',
  wrong_item:     '#1A4FC4',
  damaged:        '#0E7490',
  expired:        '#B45309',
  other:          '#64748B',
};

interface Props {
  stats:   ReturnStats | null;
  loading: boolean;
}

function fmt(n: number) { return n.toLocaleString('fr-FR'); }
function fmtGNF(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function RetourStats({ stats, loading }: Props) {
  const kpis = [
    {
      ico: '🔄', label: 'Total ce mois', color: '#1A4FC4',
      val: loading ? '—' : fmt(stats?.thisMonth ?? 0),
      badge: stats ? `+${stats.today} auj.` : null, badgeBg: '#DBEAFE', badgeColor: '#1A4FC4',
    },
    {
      ico: '⏳', label: 'En attente', color: '#F59E0B',
      val: loading ? '—' : fmt(stats?.pending ?? 0),
      badge: stats && stats.pending > 0 ? 'Urgents' : null, badgeBg: '#FEF3C7', badgeColor: '#B45309',
    },
    {
      ico: '✅', label: 'Acceptés', color: '#047857',
      val: loading ? '—' : `${stats?.tauxAcceptation ?? 0}%`,
      badge: stats ? `${fmt(stats.accepted)} retours` : null, badgeBg: '#D1FAE5', badgeColor: '#047857',
    },
    {
      ico: '💸', label: 'Remboursé (GNF)', color: '#7C3AED',
      val: loading ? '—' : fmtGNF(stats?.totalMontantRembourse ?? 0),
      badge: stats ? `${fmt(stats.refunded)} remb.` : null, badgeBg: '#EDE9FE', badgeColor: '#6D28D9',
    },
  ];

  return (
    <>
      {/* ── KPI Cards ── */}
      <div className={s.kpiStrip}>
        {kpis.map((k, i) => (
          <div key={i} className={s.kpiCard}>
            <div className={s.kpiStripe} style={{ background: k.color }} />
            {k.badge && (
              <span className={s.kpiBadge} style={{ background: k.badgeBg, color: k.badgeColor }}>
                {k.badge}
              </span>
            )}
            <div className={s.kpiIcon}>{k.ico}</div>
            <div className={s.kpiVal}>{k.val}</div>
            <div className={s.kpiLbl}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Graphique motifs + évolution ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>

          {/* Top motifs */}
          <div className="card">
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-pie" /> Top motifs de retour</div>
            </div>
            <div className="cb">
              <div className={s.barChart}>
                {stats.topMotifs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '20px 0', fontSize: 13 }}>
                    Aucune donnée
                  </div>
                ) : stats.topMotifs.map(m => (
                  <div key={m.reason} className={s.barItem}>
                    <div className={s.barLabel}>
                      <span className={s.barLabelName}>{REASON_LABELS[m.reason] ?? m.reason}</span>
                      <span className={s.barLabelValue} style={{ color: REASON_COLORS[m.reason] ?? '#64748B' }}>
                        {m.count} ({m.percentage}%)
                      </span>
                    </div>
                    <div className={s.barBg}>
                      <div
                        className={s.barFill}
                        style={{ width: `${m.percentage}%`, background: REASON_COLORS[m.reason] ?? '#64748B' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats rapides */}
          <div className="card">
            <div className="ch">
              <div className="ch-t"><i className="fas fa-gauge-high" /> Performance</div>
            </div>
            <div className="cb">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Taux d\'acceptation', val: `${stats.tauxAcceptation}%`, color: '#047857', bg: '#D1FAE5' },
                  { label: 'Délai moyen traitement', val: `${stats.delaiMoyenHeures}h`, color: '#1A4FC4', bg: '#DBEAFE' },
                  { label: 'Retours refusés', val: `${fmt(stats.refused)}`, color: '#DC2626', bg: '#FEE2E2' },
                  { label: 'Remboursements effectués', val: `${fmt(stats.refunded)}`, color: '#7C3AED', bg: '#EDE9FE' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--t2)' }}>{item.label}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 999,
                      background: item.bg, color: item.color,
                      fontSize: 12, fontWeight: 800,
                    }}>
                      {item.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
