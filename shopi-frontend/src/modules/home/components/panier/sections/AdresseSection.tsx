/*
 * ============================================================
 * FICHIER : src/modules/home/components/panier/sections/AdresseSection.tsx
 *
 * RÔLE    : Section "Adresse de livraison" — étape 2.
 *           - Chips d'adresses enregistrées (Domicile / Bureau / + Nouvelle)
 *           - Formulaire complet : Prénom, Nom, Téléphone (🇬🇳 +224)
 *           - Sélecteurs Ville + Commune (liés dynamiquement)
 *           - Adresse précise + Instructions optionnelles
 * ============================================================
 */
import React, { useState } from 'react';
import { ADRESSES, VILLES, COMMUNES } from '../data/panierData';
import styles from '../styles/AdresseSection.module.css';

interface Props {
  onVilleChange: (v: string) => void;
  onToast:       (m: string) => void;
}

export default function AdresseSection({ onVilleChange, onToast }: Props) {
  const [activeAddr, setActiveAddr] = useState('home');
  const [ville,      setVille]      = useState('conakry');

  function handleAddr(id: string, villeLabel: string) {
    setActiveAddr(id);
    onVilleChange(villeLabel);
    onToast(`📍 Adresse sélectionnée : ${villeLabel}`);
  }

  function handleVille(v: string) {
    setVille(v);
    const label = VILLES.find(x => x.value === v)?.label || v;
    onVilleChange(label);
  }

  return (
    <div className={`${styles.sc} ${styles.lit}`}>

      {/* ── En-tête ── */}
      <div className={styles.scHd}>
        <div className={styles.scNum}>2</div>
        <div>
          <div className={styles.scTitre}>Adresse de livraison</div>
          <div className={styles.scSub}>Où souhaitez-vous être livré ?</div>
        </div>
      </div>

      <div className={styles.scBody}>

        {/* ── Chips adresses enregistrées ── */}
        <div className={styles.addrChips}>
          {ADRESSES.map(a => (
            <div
              key={a.id}
              className={`${styles.addrChip} ${activeAddr === a.id ? styles.addrChipSel : ''}`}
              onClick={() => handleAddr(a.id, a.ville)}
            >
              <div className={styles.chipLabel}>
                <i className={`fas ${a.icon}`} /> {a.label}
              </div>
              <div className={styles.chipVille}>{a.ville}</div>
              <div className={styles.chipDetail}>{a.detail}</div>
            </div>
          ))}
          {/* Nouvelle adresse */}
          <div className={styles.addrNew} onClick={() => onToast('➕ Nouvelle adresse')}>
            <i className="fas fa-plus" /> Nouvelle
          </div>
        </div>

        {/* ── Prénom + Nom ── */}
        <div className={styles.fr}>
          <div className={styles.fg}>
            <div className={styles.fl}>Prénom <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-user ${styles.fi}`} />
              <input className={`${styles.fin} ${styles.finOk}`} type="text" defaultValue="Mamadou" />
            </div>
          </div>
          <div className={styles.fg}>
            <div className={styles.fl}>Nom <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-user ${styles.fi}`} />
              <input className={`${styles.fin} ${styles.finOk}`} type="text" defaultValue="Kouyaté" />
            </div>
          </div>
        </div>

        {/* ── Téléphone ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>Téléphone <span>*</span></div>
            <div className={styles.fw}>
              <div className={styles.dialCode}>🇬🇳 +224</div>
              <input
                className={`${styles.fin} ${styles.finTel} ${styles.finOk}`}
                type="tel"
                defaultValue="620 123 456"
              />
            </div>
          </div>
        </div>

        {/* ── Ville + Commune ── */}
        <div className={styles.fr}>
          <div className={styles.fg}>
            <div className={styles.fl}>Ville <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-city ${styles.fi}`} />
              <select
                className={styles.fin}
                value={ville}
                onChange={e => handleVille(e.target.value)}
              >
                {VILLES.map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.fg}>
            <div className={styles.fl}>Commune <span>*</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-map-pin ${styles.fi}`} />
              <select className={styles.fin}>
                {(COMMUNES[ville] || []).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Adresse précise ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>Adresse précise <span className={styles.flOpt}>* (rue, repère)</span></div>
            <div className={styles.fw}>
              <i className={`fas fa-location-dot ${styles.fi}`} />
              <input
                className={`${styles.fin} ${styles.finOk}`}
                type="text"
                defaultValue="Quartier Almamya, Rue KA-012, près de la pharmacie"
              />
            </div>
          </div>
        </div>

        {/* ── Instructions optionnelles ── */}
        <div className={`${styles.fr} ${styles.frFull}`}>
          <div className={styles.fg}>
            <div className={styles.fl}>
              Instructions de livraison
              <span className={styles.flOpt}>optionnel</span>
            </div>
            <div className={styles.fw}>
              <i className={`fas fa-comment ${styles.fi}`} />
              <input
                className={styles.fin}
                type="text"
                placeholder="Ex : Appeler avant d'arriver…"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
