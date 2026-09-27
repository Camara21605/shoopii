// src/dashboards/entreprise/sections/parametres/CommissionsSection.tsx
/*
 * Section 7 — Commissions Shoneya.
 *
 * Données réelles : grille calculée par le serveur (taux de base + multiplicateurs
 * de plan du super-admin), exactement ce qu'applique le CommissionEngine à chaque
 * vente, et délai de règlement réel avant retrait (PlatformSettings).
 *
 * FAILLE CORRIGÉE — une entreprise pouvait se passer ELLE-MÊME en Pro / Premium
 * (commission Shoneya ×0,75 / ×0,5) gratuitement, en un clic. Le passage à un plan
 * supérieur se demande désormais à l'équipe Shoneya (ticket de support pré-rempli) ;
 * seul le retour au plan Standard reste libre (le serveur applique la même règle).
 * Retirés aussi : « retrait immédiat » (faux dès qu'un délai de règlement existe) et
 * la ligne « abonnement mensuel — inclus » (aucun abonnement n'existe).
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import s from '../../styles/parametres/ParametresPage.module.css';
import { apiFetch } from '@/shared/services/apiFetch';
import type { ToastType } from '../../types';

interface Props {
  onDirty: () => void;
  onToast: (m: string, t?: ToastType) => void;
  saving:  boolean;
  savePlan: (plan: string) => Promise<void>;
}

interface GrilleEntry { taux: number; label: string; }
interface CommissionsData {
  planActuel: string;
  tauxActuel: GrilleEntry;
  grille:     Record<string, GrilleEntry>;
  plans:      string[];
  settlementDelayDays?: number;
}

const PLAN_EM:  Record<string, string> = { standard: '🟢', pro: '⭐', premium: '🏆' };
const RANG:     Record<string, number> = { standard: 0, pro: 1, premium: 2 };
const nomPlan = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

export default function CommissionsSection({ onToast, saving, savePlan }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const PLAN_SUB: Record<string, string> = {
    standard: t('parametres.commissions.planStandardSub'),
    pro:      t('parametres.commissions.planProSub'),
    premium:  t('parametres.commissions.planPremiumSub'),
  };
  const [data,    setData]    = useState<CommissionsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CommissionsData>('/dashboard/entreprise/parametres/commissions')
      .then(setData)
      .catch(() => onToast(t('parametres.commissions.loadErrorToast'), 'w'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grille  = data?.grille ?? {};
  const plans   = data?.plans  ?? ['standard', 'pro', 'premium'];
  const current = data?.planActuel ?? 'standard';
  const tauxActuel = data?.tauxActuel?.taux ?? '—';
  const delai = data?.settlementDelayDays ?? 0;

  function demanderPlan(plan: string) {
    const sujet = t('parametres.commissions.sujetDemande', { plan: nomPlan(plan) });
    navigate(`/support/nouveau?sujet=${encodeURIComponent(sujet)}`);
  }

  async function revenirStandard() {
    if (!window.confirm(t('parametres.commissions.confirmerStandard'))) return;
    try {
      await savePlan('standard');
      setData(prev => prev ? { ...prev, planActuel: 'standard', tauxActuel: prev.grille.standard ?? prev.tauxActuel } : prev);
      onToast(t('parametres.commissions.planChangedToast', { plan: 'Standard' }), 's');
    } catch (e: unknown) {
      onToast(e instanceof Error && e.message ? `❌ ${e.message}` : t('parametres.commissions.planChangeErrorToast'), 'e');
    }
  }

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
    </div>
  );

  const retraitCell = (
    <span style={{ fontSize:12, fontWeight:600, color:'var(--t2)' }}>
      {delai > 0 ? t('parametres.commissions.apresJours', { count: delai }) : t('parametres.commissions.immediat')}
    </span>
  );

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-percent" /> {t('parametres.commissions.title')}</h1>
        <p>{t('parametres.commissions.subtitle')}</p>
      </div>
      <FormCard title={t('parametres.commissions.grilleTitle')} icon="fa-table-list" subtitle={t('parametres.commissions.grilleSubtitle', { plan: nomPlan(current) })}
        action={<span className={`${s.badge} ${s.blue}`} style={{ fontSize:11, padding:'4px 12px' }}>{nomPlan(current)}</span>}
      >
        <div className="tbl-wrap">
          <table className={s.commTable}>
            <thead><tr><th>{t('parametres.commissions.typeTransaction')}</th><th>{t('parametres.commissions.commissionShopi')}</th><th>{t('parametres.commissions.fraisLivraisonClient')}</th><th>{t('parametres.commissions.disponibleRetrait')}</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ fontWeight:600 }}>{t('parametres.commissions.venteDirecte')}</td>
                <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>{t('parametres.commissions.aucun')}</span></td>
                <td>{retraitCell}</td>
              </tr>
              <tr>
                <td style={{ fontWeight:600 }}>{t('parametres.commissions.venteLivreurShopi')}</td>
                <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>{t('parametres.commissions.tarifZone')}</span></td>
                <td>{retraitCell}</td>
              </tr>
              <tr>
                <td style={{ fontWeight:600 }}>{t('parametres.commissions.venteCorrespondant')}</td>
                <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
                <td><span className={`${s.badge} ${s.blue}`}>{t('parametres.commissions.tarifZone')}</span></td>
                <td>{retraitCell}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={s.hint} style={{ marginTop:10 }}>
          <i className="fas fa-circle-info" /> {t('parametres.commissions.grilleHint')}
        </div>
      </FormCard>

      <FormCard title={t('parametres.commissions.upgradeTitle')} icon="fa-crown" subtitle={t('parametres.commissions.upgradeSubtitleDemande')}>
        <div className={s.radioGroup}>
          {plans.map(plan => {
            const entry = grille[plan];
            const actuel = plan === current;
            const superieur = (RANG[plan] ?? 0) > (RANG[current] ?? 0);
            return (
              <div key={plan} className={`${s.radioOpt} ${actuel ? s.selected : ''}`} style={{ cursor:'default', flexWrap:'wrap' }}>
                <span className={s.roEm}>{PLAN_EM[plan] ?? '📦'}</span>
                <div style={{ flex:'1 1 160px' }}>
                  <div className={s.roTtl}>{nomPlan(plan)} {actuel && <span className={`${s.badge} ${s.green}`} style={{ marginLeft:6 }}>{t('parametres.commissions.planActuel')}</span>}</div>
                  <div className={s.roSub}>{PLAN_SUB[plan] ?? plan}</div>
                </div>
                <div className={s.roBadge}>{entry ? t('parametres.commissions.tauxParVente', { taux: entry.taux }) : '—'}</div>
                {superieur && (
                  <button type="button" className={s.saveBtn} style={{ margin:0 }} onClick={() => demanderPlan(plan)}>
                    <i className="fas fa-paper-plane" /> {t('parametres.commissions.demanderPlan')}
                  </button>
                )}
                {!actuel && plan === 'standard' && (
                  <button type="button" className={s.saveBtn} style={{ margin:0 }} onClick={revenirStandard} disabled={saving}>
                    {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-arrow-rotate-left" />} {t('parametres.commissions.revenirStandard')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </FormCard>
    </>
  );
}
