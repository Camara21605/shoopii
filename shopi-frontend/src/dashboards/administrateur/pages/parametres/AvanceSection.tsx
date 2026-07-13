/* ================================================================
 * FICHIER : pages/parametres/AvanceSection.tsx
 * Section 15 — Paramètres avancés du système.
 * Mode maintenance, urgence, cache, logs, diagnostics.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps } from './types';

export default function AvanceSection({ onToast }: SectionProps) {
  const [maintenance,  setMaintenance]  = useState(false);
  const [urgence,      setUrgence]      = useState(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState('La plateforme est en maintenance. Retour prévu dans 30 minutes.');
  const [debugLogs,    setDebugLogs]    = useState(false);
  const [logLevel,     setLogLevel]     = useState('warn');
  const [cacheActif,   setCacheActif]   = useState(true);
  const [cacheTtl,     setCacheTtl]     = useState(300);

  const activateMaintenance = () => {
    setMaintenance(v => !v);
    onToast(maintenance ? 'Mode maintenance désactivé' : 'Mode maintenance activé — les utilisateurs voient un message', maintenance ? 's' : 'w');
  };

  const activateUrgence = () => {
    if (!urgence) {
      const confirm = window.confirm('Activer le mode urgence ? Toutes les nouvelles transactions seront bloquées.');
      if (!confirm) return;
    }
    setUrgence(v => !v);
    onToast(urgence ? 'Mode urgence désactivé' : 'MODE URGENCE ACTIVÉ — Transactions bloquées', urgence ? 's' : 'w');
  };

  return (
    <div className={styles.secBody}>

      {/* ── Mode maintenance ── */}
      <div className={styles.card} style={{ borderColor: maintenance ? 'var(--amber)' : undefined }}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-wrench" /> Mode maintenance</div>
            <div className={styles.cardSub}>Affiche un message de maintenance aux utilisateurs de la zone</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {maintenance && <span className={`${styles.bdg} ${styles.bdgAmber}`}><i className="fas fa-triangle-exclamation" /> Actif</span>}
            <div className={`${styles.sw} ${maintenance ? styles.swAmber + ' ' + styles.swOn : ''}`}
              onClick={activateMaintenance} />
          </div>
        </div>
        {maintenance && (
          <div className={styles.cardBody}>
            <div className={styles.fld}>
              <label className={styles.fldL}>Message affiché aux utilisateurs</label>
              <textarea className={styles.fldArea} rows={3} value={maintenanceMsg}
                onChange={e => setMaintenanceMsg(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* ── Mode urgence ── */}
      <div className={styles.card} style={{ borderColor: urgence ? '#ef4444' : undefined }}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-circle-exclamation" /> Mode urgence</div>
            <div className={styles.cardSub}>Bloque toutes les nouvelles transactions et commandes</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {urgence && <span className={`${styles.bdg} ${styles.bdgRed}`}><i className="fas fa-ban" /> URGENCE</span>}
            <div className={`${styles.sw} ${urgence ? styles.swOn : ''}`}
              style={urgence ? { background: '#ef4444' } : {}}
              onClick={activateUrgence} />
          </div>
        </div>
        {urgence && (
          <div className={styles.cardBody}>
            <p style={{ fontSize: 12.5, color: '#b91c1c', lineHeight: 1.6 }}>
              Le mode urgence est actif. Toutes les nouvelles transactions, commandes et inscriptions sont bloquées.
              Seules les opérations administratives restent disponibles.
            </p>
            <button className={`${styles.btn} ${styles.btnRed}`} style={{ marginTop: 12 }}
              onClick={activateUrgence}>
              <i className="fas fa-power-off" /> Désactiver le mode urgence
            </button>
          </div>
        )}
      </div>

      {/* ── Cache ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-server" /> Cache système</div>
            <div className={styles.cardSub}>Optimisation des performances par mise en cache</div>
          </div>
          <div className={`${styles.sw} ${cacheActif ? styles.swOn : ''}`}
            onClick={() => { setCacheActif(v => !v); onToast(`Cache ${cacheActif ? 'désactivé' : 'activé'}`, 's'); }} />
        </div>
        {cacheActif && (
          <div className={styles.cardBody}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div className={styles.fld} style={{ flex: 1 }}>
                <label className={styles.fldL}>TTL du cache (secondes)</label>
                <input type="number" className={styles.fldIn}
                  min={30} max={3600} step={30} value={cacheTtl}
                  onChange={e => setCacheTtl(+e.target.value)} />
                <span className={styles.fldHint}>{Math.round(cacheTtl / 60)} min — durée de vie des données en cache.</span>
              </div>
              <button className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => onToast('Cache vidé avec succès', 's')}>
                <i className="fas fa-trash-can" /> Vider le cache
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Logs système ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-terminal" /> Logs système</div>
            <div className={styles.cardSub}>Niveau de verbosité des journaux applicatifs</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.formGrid}>
            <div className={styles.fld}>
              <label className={styles.fldL}>Niveau de log</label>
              <select className={styles.fldSel} value={logLevel} onChange={e => setLogLevel(e.target.value)}>
                <option value="error">Error (minimal)</option>
                <option value="warn">Warn (recommandé)</option>
                <option value="info">Info</option>
                <option value="debug">Debug (verbeux)</option>
              </select>
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.toggleRow}>
            <div className={`${styles.tIc} ${styles.tIcViolet}`}><i className="fas fa-bug" /></div>
            <div className={styles.tMain}>
              <div className={styles.tTitle}>Logs de débogage avancés</div>
              <div className={styles.tDesc}>Active les traces détaillées pour le débogage en développement.</div>
            </div>
            <div className={`${styles.sw} ${debugLogs ? styles.swOn : ''}`}
              onClick={() => { setDebugLogs(v => !v); onToast(`Logs debug ${debugLogs ? 'désactivés' : 'activés'}`, 's'); }} />
          </div>

          <div className={styles.divider} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => onToast('Téléchargement des logs système', 'i')}>
              <i className="fas fa-download" /> Télécharger les logs
            </button>
            <button className={`${styles.btn} ${styles.btnRed} ${styles.btnSm}`}
              onClick={() => onToast('Logs système effacés', 'w')}>
              <i className="fas fa-trash" /> Effacer les logs
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
