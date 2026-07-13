/* ================================================================
 * FICHIER : pages/parametres/FinancesSection.tsx
 * Section 9 — Paramètres financiers de la zone.
 * Devise, taxes, limites de retrait, méthodes de paiement.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';

const DEVISES = ['GNF – Franc Guinéen', 'USD – Dollar américain', 'EUR – Euro'];
const METHODES_PAIEMENT = [
  { id: 'orange', label: 'Orange Money',  icon: 'fa-mobile-screen-button', color: '#FF6600', actif: true  },
  { id: 'mtn',    label: 'MTN Mobile',    icon: 'fa-mobile-screen-button', color: '#FFCC00', actif: true  },
  { id: 'wave',   label: 'Wave',          icon: 'fa-wave-square',          color: '#1AC5DC', actif: false },
  { id: 'cash',   label: 'Cash à la livraison', icon: 'fa-money-bill-wave', color: 'var(--emerald)', actif: true  },
];

export default function FinancesSection({ onToast }: SectionProps) {
  const [devise,       setDevise]       = useState('GNF – Franc Guinéen');
  const [tva,          setTva]          = useState(18);
  const [tvaActif,     setTvaActif]     = useState(false);
  const [retraitMin,   setRetraitMin]   = useState(50000);
  const [retraitMax,   setRetraitMax]   = useState(5000000);
  const [retraitDelay, setRetraitDelay] = useState(2);
  const [methodes,     setMethodes]     = useState(METHODES_PAIEMENT);

  const toggleMethode = (id: string) =>
    setMethodes(ms => ms.map(m => m.id === id ? { ...m, actif: !m.actif } : m));

  return (
    <div className={styles.secBody}>

      {/* ── Devise ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-coins" /> Devise</div>
            <div className={styles.cardSub}>Devise officielle pour toutes les transactions de la zone</div>
          </div>
          <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
            onClick={() => onToast('Paramètres financiers enregistrés', 's')}>
            <i className="fas fa-check" /> Sauvegarder
          </button>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.formGrid}>
            <div className={styles.fld}>
              <label className={styles.fldL}>Devise principale</label>
              <select className={styles.fldSel} value={devise} onChange={e => setDevise(e.target.value)}>
                {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Taxes ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-receipt" /> Taxes</div>
            <div className={styles.cardSub}>Application de la TVA sur les transactions Shopi</div>
          </div>
          <div className={`${styles.sw} ${tvaActif ? styles.swOn : ''}`}
            onClick={() => { setTvaActif(v => !v); onToast(`TVA ${tvaActif ? 'désactivée' : 'activée'}`, 's'); }} />
        </div>
        {tvaActif && (
          <div className={styles.cardBody}>
            <div className={styles.sliderWrap}>
              <div className={styles.sliderRow}>
                <input type="range" className={styles.sliderInput}
                  min={0} max={30} step={0.5} value={tva}
                  onChange={e => setTva(+e.target.value)} />
                <span className={styles.sliderVal}>{tva}%</span>
              </div>
            </div>
            <span className={styles.fldHint}>Taux de TVA applicable en Guinée : 18% (standard).</span>
          </div>
        )}
      </div>

      {/* ── Limites de retrait ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-money-bill-transfer" /> Limites de retrait</div>
            <div className={styles.cardSub}>Contrôle des retraits de solde par les acteurs</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.formGrid3}>
            <div className={styles.fld}>
              <label className={styles.fldL}>Minimum (GNF)</label>
              <input type="number" className={styles.fldIn}
                min={5000} max={200000} step={5000} value={retraitMin}
                onChange={e => setRetraitMin(+e.target.value)} />
              <span className={styles.fldHint}>Montant minimum pour initier un retrait.</span>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Maximum par jour (GNF)</label>
              <input type="number" className={styles.fldIn}
                min={100000} max={50000000} step={100000} value={retraitMax}
                onChange={e => setRetraitMax(+e.target.value)} />
              <span className={styles.fldHint}>Plafond journalier par utilisateur.</span>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Délai de traitement (j)</label>
              <input type="number" className={styles.fldIn}
                min={0} max={7} step={1} value={retraitDelay}
                onChange={e => setRetraitDelay(+e.target.value)} />
              <span className={styles.fldHint}>0 = instantané.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Méthodes de paiement ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-credit-card" /> Méthodes de paiement</div>
            <div className={styles.cardSub}>Canaux de paiement acceptés dans votre zone</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {methodes.map(m => (
            <div key={m.id} className={styles.toggleRow}>
              <div className={styles.tIc} style={{ background: `${m.color}18`, color: m.color }}>
                <i className={`fas ${m.icon}`} />
              </div>
              <div className={styles.tMain}>
                <div className={styles.tTitle}>{m.label}</div>
                <span className={`${styles.bdg} ${m.actif ? styles.bdgGreen : styles.bdgGray}`}>
                  {m.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className={`${styles.sw} ${m.actif ? styles.swOn : ''}`}
                onClick={() => { toggleMethode(m.id); onToast(`${m.label} ${m.actif ? 'désactivé' : 'activé'}`, 's'); }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
