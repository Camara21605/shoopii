/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/AuditPage.tsx
 *
 * Journal d'audit : toutes les actions de l'administrateur
 * sont consignées avec une référence unique (AUD-XXXXX).
 * En prod : GET /admin/audit?filtre=…
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/AuditPage.module.css';
import { AUDIT } from '../data/adminData';
import type { AuditKind } from '../data/types';

interface AuditPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Icône par type d'action d'audit */
const KIND_ICON: Record<AuditKind, string> = {
  code: 'fa-qrcode',
  ok:   'fa-user-check',
  warn: 'fa-triangle-exclamation',
  ban:  'fa-ban',
};

/* Filtres disponibles */
const FILTRES: { id: 'all' | AuditKind; label: string }[] = [
  { id: 'all',  label: 'Toutes' },
  { id: 'ok',   label: 'Validations' },
  { id: 'ban',  label: 'Sanctions' },
  { id: 'code', label: 'Codes' },
];

export default function AuditPage({ onToast }: AuditPageProps) {
  const [filtre, setFiltre]       = useState<'all' | AuditKind>('all');
  const [recherche, setRecherche] = useState('');

  const visibles = AUDIT.filter(a =>
    (filtre === 'all' || a.kind === filtre) &&
    a.texte.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      {/* ── Filtres + recherche ── */}
      <div className={styles.filterBar}>
        {FILTRES.map(f => (
          <button key={f.id} className={`${styles.fchip} ${filtre === f.id ? styles.fon : ''}`}
            onClick={() => setFiltre(f.id)}>
            {f.label} {f.id === 'all' && <span className={styles.n}>248</span>}
          </button>
        ))}
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Rechercher une action…" value={recherche}
            onChange={e => setRecherche(e.target.value)} />
        </div>
      </div>

      {/* ── Journal d'audit ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}>
            <i className="fas fa-clipboard-list" /> Journal d&apos;audit — toutes vos actions sont consignées
          </div>
          <button className={styles.exportBtn} onClick={() => onToast('📄 Export du journal lancé', 'i')}>
            <i className="fas fa-download" /> Exporter
          </button>
        </div>
        <div className={styles.cb}>
          {visibles.map(a => (
            <div key={a.id} className={styles.aud}>
              <div className={`${styles.audIc} ${styles['aud_' + a.kind]}`}>
                <i className={`fas ${KIND_ICON[a.kind]}`} />
              </div>
              <div>
                {/* Texte avec balises <b> — données internes contrôlées */}
                <div className={styles.audT} dangerouslySetInnerHTML={{ __html: a.texte }} />
                <div className={styles.audMeta}>
                  <span><i className="fas fa-user" /> {a.auteur}</span>
                  <span><i className="fas fa-clock" /> {a.quand}</span>
                  <span><i className="fas fa-fingerprint" /> {a.id}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
