/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/FinancesPage.tsx
 *
 * Finances de la zone : volume d'affaires, commissions Shopi,
 * reversements partenaires, graphe mensuel, derniers flux.
 * ================================================================ */

import styles from '../styles/FinancesPage.module.css';
import { FIN_CHART, FLUX } from '../data/adminData';

interface FinancesPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Icône + classe CSS selon le sens du flux financier */
const SENS_ICON: Record<string, string> = { in: 'fa-arrow-down', out: 'fa-arrow-up', refund: 'fa-rotate-left' };
const SENS_CLS:  Record<string, string> = { in: 'ok', out: 'code', refund: 'warn' };

export default function FinancesPage({ onToast }: FinancesPageProps) {
  const max = Math.max(...FIN_CHART.map(d => d.a), 1);

  return (
    <div>
      {/* ── Héro finances (emerald) ── */}
      <div className={styles.finHero}>
        <div className={styles.glow} />
        <div className={styles.finIn}>
          <div className={styles.finL}>Volume d&apos;affaires de la zone (mois)</div>
          <div className={styles.finV}>342 <small>M GNF</small></div>
        </div>
        <div className={styles.finSide}>
          <div className={styles.finMini}><b>10,3M</b><span>Commissions Shopi (3%)</span></div>
          <div className={styles.finMini}><b>4,8M</b><span>Reversé aux partenaires</span></div>
          <div className={styles.finMini}><b>1 240</b><span>Transactions</span></div>
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
              {FIN_CHART.map(d => (
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
            {FLUX.map(f => (
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
