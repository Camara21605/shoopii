// src/dashboards/entreprise/sections/parametres/CommissionsSection.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface Props { onDirty: () => void; onToast: (m: string, t?: string) => void; }

interface GrilleEntry { taux: number; label: string; }
interface CommissionsData {
  planActuel: string;
  tauxActuel: GrilleEntry;
  grille:     Record<string, GrilleEntry>;
  plans:      string[];
}

const PLAN_EM:  Record<string, string> = { standard: '🟢', pro: '⭐', premium: '🏆' };

export default function CommissionsSection({ onDirty, onToast }: Props) {
  const { t } = useTranslation();
  const PLAN_SUB: Record<string, string> = {
    standard: t('parametres.commissions.planStandardSub'),
    pro:      t('parametres.commissions.planProSub'),
    premium:  t('parametres.commissions.planPremiumSub'),
  };
  const [data,    setData]    = useState<CommissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CommissionsData>('/parametres/commissions')
      .then(d => { setData(d); setSelected(d.planActuel); })
      .catch(() => onToast(t('parametres.commissions.loadErrorToast'), 'w'))
      .finally(() => setLoading(false));
  }, []);

  const grille  = data?.grille ?? {};
  const plans   = data?.plans  ?? ['STANDARD', 'PRO', 'PREMIUM'];
  const current = data?.planActuel ?? 'STANDARD';
  const tauxActuel = data?.tauxActuel?.taux ?? '—';

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
    </div>
  );

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-percent" /> {t('parametres.commissions.title')}</h1>
        <p>{t('parametres.commissions.subtitle')}</p>
      </div>
      <FormCard title={t('parametres.commissions.grilleTitle')} icon="fa-table-list" subtitle={t('parametres.commissions.grilleSubtitle', { plan: current })}
        action={<span className={`${s.badge} ${s.blue}`} style={{ fontSize:11, padding:'4px 12px' }}>{current}</span>}
      >
        <div className="tbl-wrap">
          <table className={s.commTable}>
            <thead><tr><th>{t('parametres.commissions.typeTransaction')}</th><th>{t('parametres.commissions.commissionShopi')}</th><th>{t('parametres.commissions.fraisLivreurCorresp')}</th><th>{t('parametres.commissions.retraitImmediat')}</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ fontWeight:600 }}>{t('parametres.commissions.venteDirecte')}</td>
                <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>0</span></td>
                <td><i className="fas fa-check-circle" style={{ color:'var(--emerald)' }} /></td>
              </tr>
              <tr>
                <td style={{ fontWeight:600 }}>{t('parametres.commissions.venteLivreurShopi')}</td>
                <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>{t('parametres.commissions.selonLivreur')}</span></td>
                <td><i className="fas fa-check-circle" style={{ color:'var(--emerald)' }} /></td>
              </tr>
              <tr>
                <td style={{ fontWeight:600 }}>{t('parametres.commissions.venteCorrespondant')}</td>
                <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>{t('parametres.commissions.selonCorresp')}</span></td>
                <td><i className="fas fa-check-circle" style={{ color:'var(--emerald)' }} /></td>
              </tr>
              <tr>
                <td style={{ fontWeight:600 }}>{t('parametres.commissions.abonnementMensuel')}</td>
                <td><span className={`${s.badge} ${s.blue}`}>{t('parametres.commissions.inclus')}</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>—</span></td>
                <td><i className="fas fa-xmark" style={{ color:'var(--t4)' }} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </FormCard>
      <FormCard title={t('parametres.commissions.upgradeTitle')} icon="fa-crown" subtitle={t('parametres.commissions.upgradeSubtitle')}>
        <div className={s.radioGroup}>
          {plans.map(plan => {
            const entry = grille[plan];
            return (
              <div
                key={plan}
                className={`${s.radioOpt} ${selected === plan ? s.selected : ''}`}
                onClick={() => { setSelected(plan); onDirty(); }}
              >
                <div className={s.roDot} />
                <span className={s.roEm}>{PLAN_EM[plan] ?? '📦'}</span>
                <div>
                  <div className={s.roTtl}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</div>
                  <div className={s.roSub}>{PLAN_SUB[plan] ?? plan}</div>
                </div>
                <div className={s.roBadge}>{entry ? t('parametres.commissions.tauxParVente', { taux: entry.taux }) : '—'}</div>
              </div>
            );
          })}
        </div>
      </FormCard>
    </>
  );
}
