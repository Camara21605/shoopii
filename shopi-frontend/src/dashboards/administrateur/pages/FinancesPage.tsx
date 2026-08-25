/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/FinancesPage.tsx
 *
 * Finances de la zone : volume d'affaires, commissions admin,
 * taux & ratios depuis PlatformSettings, graphe mensuel.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/FinancesPage.module.css';
import { apiFetch } from '@/shared/services/apiFetch';

interface FinancesPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

interface TauxData {
  tauxCommissionProduit:    number;
  tauxCommissionLivraison:  number;
  ratioAdminProduit:        number;
  ratioAdminLivraison:      number;
  ratioPartenaireProduit:   number;
  ratioPartenaireLivraison: number;
  totalCommissionsAdmin:    number;
  commissionsAdminThisMonth:number;
}

/* Icône + classe CSS selon le sens du flux financier */
const SENS_ICON: Record<string, string> = { in: 'fa-arrow-down', out: 'fa-arrow-up', refund: 'fa-rotate-left' };
const SENS_CLS:  Record<string, string> = { in: 'ok', out: 'code', refund: 'warn' };

interface FinancesData {
  chart: { x: string; a: number; c: number }[];
  flux:  { id: string; sens: string; libelle: string; quand: string; montant: number }[];
}

export default function FinancesPage({ onToast }: FinancesPageProps) {
  const [taux,     setTaux]     = useState<TauxData | null>(null);
  const [finances, setFinances] = useState<FinancesData | null>(null);

  useEffect(() => {
    apiFetch<TauxData>('/dashboard/admin/taux').then(setTaux).catch(() => {});
    apiFetch('/dashboard/admin/finances').then(d => setFinances(d as any)).catch(() => {});
  }, []);

  const finChart = finances?.chart ?? [];
  const finFlux  = finances?.flux  ?? [];
  const max = Math.max(...finChart.map(d => d.a), 1);

  const tauxProd     = taux?.tauxCommissionProduit   ?? 0;
  const tauxLivr     = taux?.tauxCommissionLivraison ?? 0;
  const ratioProd    = taux?.ratioAdminProduit       ?? 0;
  const ratioLivr    = taux?.ratioAdminLivraison     ?? 0;
  const totalAdmin   = taux?.totalCommissionsAdmin   ?? 0;
  const monthAdmin   = taux?.commissionsAdminThisMonth ?? 0;

  const fmtGnf = (v: number) => v === 0 ? '0 GNF' : `${v.toLocaleString('fr-FR')} GNF`;

  return (
    <div>
      {/* ── Héro finances (emerald) ── */}
      <div className={styles.finHero}>
        <div className={styles.glow} />
        <div className={styles.finIn}>
          <div className={styles.finL}>Commissions admin reçues</div>
          <div className={styles.finV}>{fmtGnf(totalAdmin)}</div>
        </div>
        <div className={styles.finSide}>
          <div className={styles.finMini}>
            <b>{monthAdmin > 0 ? fmtGnf(monthAdmin) : '—'}</b>
            <span>Commissions ce mois ({ratioProd}% produits / {ratioLivr}% livraisons)</span>
          </div>
          <div className={styles.finMini}>
            <b>{tauxProd}%</b>
            <span>Taux commission produits (brut Shoneya)</span>
          </div>
          <div className={styles.finMini}>
            <b>{tauxLivr}%</b>
            <span>Taux commission livraisons (brut Shoneya)</span>
          </div>
        </div>
      </div>

      <div className={styles.g2}>
        {/* ── Graphe volume mensuel ── */}
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-chart-column" /> Volume mensuel</div>
          </div>
          <div className={styles.cb}>
            <div className={styles.chart}>
              {finChart.map(d => (
                <div key={d.x} className={styles.cbarWrap}>
                  <div className={styles.cbarPair}>
                    <div className={styles.cbar} style={{ height: `${(d.a / max) * 100}%` }}>
                      <span className={styles.cbarV}>{d.a}M GNF</span>
                    </div>
                    <div className={`${styles.cbar} ${styles.cbarAlt}`} style={{ height: `${(d.c / max) * 100}%` }}>
                      <span className={styles.cbarV}>{(d.c / 10).toFixed(1)}M com.</span>
                    </div>
                  </div>
                  <div className={styles.cbarL}>{d.x}</div>
                </div>
              ))}
            </div>
            <div className={styles.legend}>
              <div className={styles.cleg}><span className={styles.clegD} style={{ background: 'var(--blue)' }} /> Volume (M GNF)</div>
              <div className={styles.cleg}><span className={styles.clegD} style={{ background: 'var(--teal)' }} /> Commissions (×0,1M)</div>
            </div>
          </div>
        </div>

        {/* ── Derniers flux financiers ── */}
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.chT}><i className="fas fa-arrow-right-arrow-left" /> Derniers flux</div>
            <button className={styles.chLink} onClick={() => onToast('📄 Export des flux lancé', 'i')}>
              Exporter <i className="fas fa-download" />
            </button>
          </div>
          <div className={styles.cb}>
            {finFlux.length === 0 && (
              <p style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>Aucun flux financier disponible.</p>
            )}
            {finFlux.map(f => (
              <div key={f.id} className={styles.act}>
                <div className={`${styles.actIc} ${styles['act_' + SENS_CLS[f.sens]]}`}>
                  <i className={`fas ${SENS_ICON[f.sens]}`} />
                </div>
                <div>
                  {/* Libellé avec balise <b> — données internes contrôlées */}
                  <div className={styles.actT} dangerouslySetInnerHTML={{ __html: f.libelle }} />
                  <div className={styles.actW}>{f.quand}</div>
                </div>
                <div className={`${styles.montant} ${f.sens === 'in' ? styles.mIn : f.sens === 'out' ? styles.mOut : styles.mRef}`}>
                  {f.montant > 0 ? '+' : '−'}{Math.abs(f.montant).toLocaleString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
