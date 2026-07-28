// src/dashboards/entreprise/sections/parametres/CommissionsSection.tsx
import React, { useState, useEffect } from 'react';
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
const PLAN_SUB: Record<string, string> = {
  standard: 'Plan de base · Inclus dans votre inscription',
  pro:      'Pour les boutiques à fort volume de ventes',
  premium:  'Commissions réduites + outils marketing avancés',
};

export default function CommissionsSection({ onDirty, onToast }: Props) {
  const [data,    setData]    = useState<CommissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CommissionsData>('/parametres/commissions')
      .then(d => { setData(d); setSelected(d.planActuel); })
      .catch(() => onToast('Erreur chargement commissions', 'w'))
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
        <h1><i className="fas fa-percent" /> Commissions Shopi</h1>
        <p>Détail des commissions appliquées sur vos ventes selon le type de transaction.</p>
      </div>
      <FormCard title="Grille de commissions" icon="fa-table-list" subtitle={`Votre plan actuel : ${current}`}
        action={<span className={`${s.badge} ${s.blue}`} style={{ fontSize:11, padding:'4px 12px' }}>{current}</span>}
      >
        <table className={s.commTable}>
          <thead><tr><th>Type de transaction</th><th>Commission Shopi</th><th>Frais livreur/corresp.</th><th>Retrait immédiat</th></tr></thead>
          <tbody>
            <tr>
              <td style={{ fontWeight:600 }}>Vente directe via Shopi</td>
              <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
              <td><span className={`${s.badge} ${s.blue}`}>0</span></td>
              <td><i className="fas fa-check-circle" style={{ color:'#047857' }} /></td>
            </tr>
            <tr>
              <td style={{ fontWeight:600 }}>Vente avec livreur Shopi</td>
              <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
              <td><span className={`${s.badge} ${s.blue}`}>selon livreur</span></td>
              <td><i className="fas fa-check-circle" style={{ color:'#047857' }} /></td>
            </tr>
            <tr>
              <td style={{ fontWeight:600 }}>Vente via correspondant</td>
              <td><span className={`${s.badge} ${s.green}`}>{tauxActuel}%</span></td>
              <td><span className={`${s.badge} ${s.blue}`}>selon corresp.</span></td>
              <td><i className="fas fa-check-circle" style={{ color:'#047857' }} /></td>
            </tr>
            <tr>
              <td style={{ fontWeight:600 }}>Abonnement mensuel boutique</td>
              <td><span className={`${s.badge} ${s.blue}`}>— (inclus)</span></td>
              <td><span className={`${s.badge} ${s.blue}`}>—</span></td>
              <td><i className="fas fa-xmark" style={{ color:'var(--t4)' }} /></td>
            </tr>
          </tbody>
        </table>
      </FormCard>
      <FormCard title="Passer à un plan supérieur" icon="fa-crown" subtitle="Réduisez vos commissions et accédez à des fonctionnalités avancées">
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
                <div className={s.roBadge}>{entry ? `${entry.taux}% / vente` : '—'}</div>
              </div>
            );
          })}
        </div>
      </FormCard>
    </>
  );
}
