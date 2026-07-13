/* ================================================================
 * FICHIER : pages/parametres/ConfidentialiteSection.tsx
 * Section 14 — Confidentialité et conformité RGPD.
 * Cookies, rétention des données, droits des utilisateurs.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';

export default function ConfidentialiteSection({ onToast }: SectionProps) {
  const [cookies, setCookies]       = useState({ essentiels: true, analytiques: false, marketing: false });
  const [retention, setRetention]   = useState({ comptes: 36, commandes: 60, audit: 24, logs: 12 });
  const [anonymise, setAnonymise]   = useState(true);
  const [partageData, setPartageData] = useState(false);

  const toggleCookie = (k: keyof typeof cookies) => {
    if (k === 'essentiels') { onToast('Les cookies essentiels sont obligatoires', 'w'); return; }
    setCookies(c => ({ ...c, [k]: !c[k] }));
    onToast('Préférence cookies mise à jour', 's');
  };

  return (
    <div className={styles.secBody}>

      {/* ── Politique cookies ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-cookie-bite" /> Politique des cookies</div>
            <div className={styles.cardSub}>Gérez les types de cookies utilisés par la plateforme</div>
          </div>
          <button className={`${styles.btn} ${styles.btnBlue} ${styles.btnSm}`}
            onClick={() => onToast('Préférences cookies enregistrées', 's')}>
            <i className="fas fa-check" /> Sauvegarder
          </button>
        </div>
        <div className={styles.cardBody}>
          {[
            { k: 'essentiels',  l: 'Cookies essentiels',   d: 'Authentification, sessions, sécurité. Obligatoires.',               ic: 'fa-shield-halved', col: 'tIcEmerald' },
            { k: 'analytiques', l: 'Cookies analytiques',  d: 'Mesure d\'audience et performance. Anonymisés.',                    ic: 'fa-chart-line',    col: 'tIcBlue' },
            { k: 'marketing',   l: 'Cookies marketing',    d: 'Personnalisation publicitaire. Non utilisés actuellement.',          ic: 'fa-bullseye',      col: 'tIcAmber' },
          ].map(({ k, l, d, ic, col }) => (
            <div key={k} className={styles.toggleRow}>
              <div className={`${styles.tIc} ${styles[col as keyof typeof styles]}`}><i className={`fas ${ic}`} /></div>
              <div className={styles.tMain}>
                <div className={styles.tTitle}>{l}</div>
                <div className={styles.tDesc}>{d}</div>
              </div>
              <div className={`${styles.sw} ${cookies[k as keyof typeof cookies] ? styles.swOn : ''}`}
                onClick={() => toggleCookie(k as keyof typeof cookies)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Rétention des données ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-calendar-xmark" /> Rétention des données</div>
            <div className={styles.cardSub}>Durée de conservation avant suppression automatique</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.formGrid4}>
            {[
              { k: 'comptes',   l: 'Comptes inactifs', hint: 'mois' },
              { k: 'commandes', l: 'Historique commandes', hint: 'mois' },
              { k: 'audit',     l: 'Journal d\'audit',  hint: 'mois' },
              { k: 'logs',      l: 'Logs système',      hint: 'mois' },
            ].map(({ k, l, hint }) => (
              <div key={k} className={styles.fld}>
                <label className={styles.fldL}>{l}</label>
                <input type="number" className={styles.fldIn}
                  min={1} max={120} value={retention[k as keyof typeof retention]}
                  onChange={e => setRetention(r => ({ ...r, [k]: +e.target.value }))} />
                <span className={styles.fldHint}>{hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Droits des utilisateurs ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-scale-balanced" /> Droits des utilisateurs (RGPD)</div>
            <div className={styles.cardSub}>Conformité aux droits d&apos;accès, rectification et suppression</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {/* Toggle : anonymisation automatique */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc} ${styles.tIcViolet}`}><i className="fas fa-mask" /></div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Anonymisation automatique</div>
              <div className={styles.tDesc}>Les données personnelles des comptes supprimés sont anonymisées (email, téléphone masqués).</div>
            </div>
            <div className={`${styles.sw} ${anonymise ? styles.swOn : ''}`}
              onClick={() => { setAnonymise(v => !v); onToast(`Anonymisation ${anonymise ? 'désactivée' : 'activée'}`, 's'); }} />
          </div>

          {/* Toggle : partage de données */}
          <div className={styles.toggleRow}>
            <div className={`${styles.tIc} ${styles.tIcAmber}`}><i className="fas fa-share-nodes" /></div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Partage anonyme de données avec Shopi Central</div>
              <div className={styles.tDesc}>Statistiques agrégées pour améliorer la plateforme (aucune donnée personnelle).</div>
            </div>
            <div className={`${styles.sw} ${partageData ? styles.swOn : ''}`}
              onClick={() => { setPartageData(v => !v); onToast(`Partage de données ${partageData ? 'désactivé' : 'activé'}`, 's'); }} />
          </div>

          <div className={styles.divider} />

          {/* Actions manuelles RGPD */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => onToast('Rapport de conformité RGPD généré', 'i')}>
              <i className="fas fa-file-pdf" /> Rapport RGPD
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => onToast('Export de toutes les données personnelles lancé', 'i')}>
              <i className="fas fa-download" /> Exporter mes données
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
