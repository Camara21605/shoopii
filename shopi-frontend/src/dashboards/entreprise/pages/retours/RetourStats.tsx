/*
 * RetourStats.tsx — KPI strip + graphiques des retours.
 */
import { useTranslation } from 'react-i18next';
import type { ReturnStats } from '../../hooks/useRetours';
import s from './RetoursPage.module.css';

const REASON_COLORS: Record<string, string> = {
  defective:      'var(--t1)',
  not_matching:   'var(--btn)',
  change_of_mind: 'var(--t2)',
  wrong_item:     'var(--t2)',
  damaged:        'var(--t2)',
  expired:        'var(--t2)',
  other:          'var(--t2)',
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
  const { t } = useTranslation();
  const REASON_LABELS: Record<string, string> = {
    defective:      t('retours.reasons.defective'),
    not_matching:   t('retours.reasons.not_matching'),
    change_of_mind: t('retours.reasons.change_of_mind'),
    wrong_item:     t('retours.reasons.wrong_item'),
    damaged:        t('retours.reasons.damaged'),
    expired:        t('retours.reasons.expired'),
    other:          t('retours.reasons.other'),
  };

  const kpis = [
    {
      ico: '🔄', label: t('retours.stats.totalMois'), color: 'var(--t2)',
      val: loading ? '—' : fmt(stats?.thisMonth ?? 0),
      badge: stats ? t('retours.stats.badgeAuj', { count: stats.today }) : null, badgeBg: 'var(--g100)', badgeColor: 'var(--t2)',
    },
    {
      ico: '⏳', label: t('retours.stats.enAttente'), color: 'var(--amber)',
      val: loading ? '—' : fmt(stats?.pending ?? 0),
      badge: stats && stats.pending > 0 ? t('retours.stats.urgents') : null, badgeBg: 'var(--rs-bg)', badgeColor: 'var(--red)',
    },
    {
      ico: '✅', label: t('retours.stats.acceptes'), color: 'var(--emerald)',
      val: loading ? '—' : `${stats?.tauxAcceptation ?? 0}%`,
      badge: stats ? t('retours.stats.badgeRetours', { count: stats.accepted }) : null, badgeBg: 'var(--em-bg)', badgeColor: 'var(--emerald)',
    },
    {
      ico: '💸', label: t('retours.stats.rembourseGnf'), color: 'var(--teal)',
      val: loading ? '—' : fmtGNF(stats?.totalMontantRembourse ?? 0),
      badge: stats ? t('retours.stats.badgeRemb', { count: stats.refunded }) : null, badgeBg: 'var(--tl-bg)', badgeColor: 'var(--teal)',
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
        <div className="gridR2" style={{ gap: 12, marginBottom: 20 }}>

          {/* Top motifs */}
          <div className="card">
            <div className="ch">
              <div className="ch-t"><i className="fas fa-chart-pie" /> {t('retours.stats.topMotifs')}</div>
            </div>
            <div className="cb">
              <div className={s.barChart}>
                {stats.topMotifs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '20px 0', fontSize: 13 }}>
                    {t('retours.stats.aucuneDonnee')}
                  </div>
                ) : stats.topMotifs.map(m => (
                  <div key={m.reason} className={s.barItem}>
                    <div className={s.barLabel}>
                      <span className={s.barLabelName}>{REASON_LABELS[m.reason] ?? m.reason}</span>
                      <span className={s.barLabelValue} style={{ color: REASON_COLORS[m.reason] ?? 'var(--t2)' }}>
                        {m.count} ({m.percentage}%)
                      </span>
                    </div>
                    <div className={s.barBg}>
                      <div
                        className={s.barFill}
                        style={{ width: `${m.percentage}%`, background: REASON_COLORS[m.reason] ?? 'var(--t2)' }}
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
              <div className="ch-t"><i className="fas fa-gauge-high" /> {t('retours.stats.performance')}</div>
            </div>
            <div className="cb">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: t('retours.stats.tauxAcceptation'), val: `${stats.tauxAcceptation}%`, color: 'var(--t2)', bg: 'var(--g100)' },
                  { label: t('retours.stats.delaiMoyen'), val: `${stats.delaiMoyenHeures}h`, color: 'var(--t2)', bg: 'var(--g100)' },
                  { label: t('retours.stats.retoursRefuses'), val: `${fmt(stats.refused)}`, color: 'var(--t1)', bg: 'var(--g100)' },
                  { label: t('retours.stats.remboursementsEffectues'), val: `${fmt(stats.refunded)}`, color: 'var(--t2)', bg: 'var(--g100)' },
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
