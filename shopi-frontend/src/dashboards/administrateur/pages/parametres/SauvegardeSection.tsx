/* ================================================================
 * FICHIER : pages/parametres/SauvegardeSection.tsx
 * Section 13 — Sauvegarde et restauration des données.
 * Sauvegarde auto/manuelle, historique, import/export/restauration.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps, Backup } from './types';

const BACKUPS_MOCK: Backup[] = [
  { id: 'B001', nom: 'backup_2026-07-05_14h00',  taille: '2,3 Mo',  quand: "Aujourd'hui 14:00",  auto: true  },
  { id: 'B002', nom: 'backup_2026-07-04_14h00',  taille: '2,1 Mo',  quand: 'Hier 14:00',          auto: true  },
  { id: 'B003', nom: 'backup_manuel_2026-07-03',  taille: '2,0 Mo',  quand: '03/07/2026 10:22',   auto: false },
  { id: 'B004', nom: 'backup_2026-07-02_14h00',  taille: '1,9 Mo',  quand: '02/07/2026 14:00',   auto: true  },
  { id: 'B005', nom: 'backup_2026-07-01_14h00',  taille: '1,8 Mo',  quand: '01/07/2026 14:00',   auto: true  },
];

export default function SauvegardeSection({ onToast }: SectionProps) {
  const [autoBackup,  setAutoBackup]  = useState(true);
  const [freq,        setFreq]        = useState('24h');
  const [retention,   setRetention]   = useState(30);
  const [backups,     setBackups]     = useState<Backup[]>(BACKUPS_MOCK);
  const [loading,     setLoading]     = useState(false);

  const lancerBackup = () => {
    setLoading(true);
    setTimeout(() => {
      const b: Backup = {
        id:     `B${String(backups.length + 1).padStart(3, '0')}`,
        nom:    `backup_manuel_${new Date().toISOString().slice(0, 10)}`,
        taille: '2,3 Mo',
        quand:  'À l\'instant',
        auto:   false,
      };
      setBackups([b, ...backups]);
      setLoading(false);
      onToast('Sauvegarde manuelle effectuée', 's');
    }, 1200);
  };

  const supprimer = (id: string) => {
    setBackups(bs => bs.filter(b => b.id !== id));
    onToast('Sauvegarde supprimée', 'w');
  };

  return (
    <div className={styles.secBody}>

      {/* ── Sauvegarde automatique ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-rotate" /> Sauvegarde automatique</div>
            <div className={styles.cardSub}>Sauvegarde régulière de la configuration de la zone</div>
          </div>
          <div className={`${styles.sw} ${autoBackup ? styles.swEmerald + ' ' + styles.swOn : ''}`}
            onClick={() => { setAutoBackup(v => !v); onToast(`Sauvegarde auto ${autoBackup ? 'désactivée' : 'activée'}`, 's'); }} />
        </div>
        {autoBackup && (
          <div className={styles.cardBody}>
            <div className={styles.formGrid}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Fréquence</label>
                <select className={styles.fldSel} value={freq} onChange={e => setFreq(e.target.value)}>
                  <option value="6h">Toutes les 6 heures</option>
                  <option value="12h">Toutes les 12 heures</option>
                  <option value="24h">Quotidienne (recommandé)</option>
                  <option value="7j">Hebdomadaire</option>
                </select>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Rétention (jours)</label>
                <input type="number" className={styles.fldIn}
                  min={7} max={365} value={retention}
                  onChange={e => setRetention(+e.target.value)} />
                <span className={styles.fldHint}>Les sauvegardes plus anciennes seront supprimées.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions manuelles ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-database" /> Actions manuelles</div>
            <div className={styles.cardSub}>Créer, importer ou exporter des données</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={lancerBackup}
              style={{ opacity: loading ? .6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-database'}`} />
              {loading ? 'Sauvegarde en cours…' : 'Sauvegarder maintenant'}
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => onToast('Export des données lancé (JSON)', 'i')}>
              <i className="fas fa-file-export" /> Exporter en JSON
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => onToast('Sélectionnez un fichier de sauvegarde à importer', 'i')}>
              <i className="fas fa-file-import" /> Importer
            </button>
          </div>
        </div>
      </div>

      {/* ── Historique des sauvegardes ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-history" /> Historique</div>
            <div className={styles.cardSub}>{backups.length} sauvegarde{backups.length > 1 ? 's' : ''} disponible{backups.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {backups.map(b => (
            <div key={b.id} className={styles.backupItem}>
              <div className={styles.backupIc}><i className="fas fa-hard-drive" /></div>
              <div className={styles.backupInfo}>
                <div className={styles.backupName}>{b.nom}</div>
                <div className={styles.backupMeta}>{b.taille} · {b.quand} · {b.auto ? 'Automatique' : 'Manuelle'}</div>
              </div>
              <span className={`${styles.bdg} ${b.auto ? styles.bdgBlue : styles.bdgAmber}`}>
                {b.auto ? 'Auto' : 'Manuel'}
              </span>
              <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                onClick={() => onToast(`Restauration depuis ${b.nom}…`, 'w')}>
                <i className="fas fa-rotate-left" /> Restaurer
              </button>
              <button className={`${styles.btn} ${styles.btnRed} ${styles.btnSm}`}
                onClick={() => supprimer(b.id)}>
                <i className="fas fa-trash" />
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
