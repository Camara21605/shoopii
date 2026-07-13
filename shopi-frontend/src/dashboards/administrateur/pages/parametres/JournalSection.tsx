/* ================================================================
 * FICHIER : pages/parametres/JournalSection.tsx
 * Section 11 — Journal d'activité de l'administrateur.
 * Timeline IP/device/action/résultat, filtres, export.
 * ================================================================ */

import { useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps, JournalEntry, JournalKind } from './types';

/* Données mock du journal (en prod : GET /admin/journal) */
const JOURNAL_MOCK: JournalEntry[] = [
  { id: 'J001', kind: 'ok',   texte: '<b>Validation</b> du dossier partenaire <b>Mamadou Bah</b>',    auteur: 'Aïssatou Condé', ip: '41.211.8.12', device: 'Chrome / Windows', quand: "Aujourd'hui 14:32" },
  { id: 'J002', kind: 'code', texte: '<b>Génération</b> d\'un code d\'invitation <b>Livreur</b>',     auteur: 'Aïssatou Condé', ip: '41.211.8.12', device: 'Chrome / Windows', quand: "Aujourd'hui 13:15" },
  { id: 'J003', kind: 'ban',  texte: '<b>Suspension</b> de l\'entreprise <b>Electro Conakry</b>',    auteur: 'Aïssatou Condé', ip: '41.211.8.14', device: 'Safari / iPhone', quand: "Hier 09:47" },
  { id: 'J004', kind: 'warn', texte: '<b>Avertissement</b> envoyé au livreur <b>Ibrahima Diallo</b>',auteur: 'Aïssatou Condé', ip: '41.211.8.12', device: 'Chrome / Windows', quand: "Hier 08:22" },
  { id: 'J005', kind: 'ok',   texte: '<b>Rejet</b> du signalement <b>#SIG-00124</b> (infondé)',       auteur: 'Aïssatou Condé', ip: '41.211.8.12', device: 'Chrome / Windows', quand: '03/07/2026' },
  { id: 'J006', kind: 'ok',   texte: '<b>Modification</b> des paramètres de notifications',           auteur: 'Aïssatou Condé', ip: '41.211.8.12', device: 'Chrome / Windows', quand: '02/07/2026' },
  { id: 'J007', kind: 'code', texte: '<b>Génération</b> d\'un code d\'invitation <b>Entreprise</b>',  auteur: 'Aïssatou Condé', ip: '41.211.8.12', device: 'Chrome / Windows', quand: '01/07/2026' },
];

const FILTRES: { id: 'all' | JournalKind; label: string; icon: string }[] = [
  { id: 'all',  label: 'Toutes',      icon: 'fa-list' },
  { id: 'ok',   label: 'Validations', icon: 'fa-check' },
  { id: 'ban',  label: 'Sanctions',   icon: 'fa-ban' },
  { id: 'code', label: 'Codes',       icon: 'fa-qrcode' },
  { id: 'warn', label: 'Alertes',     icon: 'fa-triangle-exclamation' },
];

const DOT_CLS: Record<JournalKind, string> = {
  ok:   'tlOk',
  code: 'tlCode',
  ban:  'tlBan',
  warn: 'tlWarn',
};

const DOT_ICON: Record<JournalKind, string> = {
  ok:   'fa-check',
  code: 'fa-qrcode',
  ban:  'fa-ban',
  warn: 'fa-triangle-exclamation',
};

export default function JournalSection({ onToast }: SectionProps) {
  const [filtre,    setFiltre]    = useState<'all' | JournalKind>('all');
  const [recherche, setRecherche] = useState('');

  const visibles = JOURNAL_MOCK.filter(e =>
    (filtre === 'all' || e.kind === filtre) &&
    e.texte.toLowerCase().includes(recherche.toLowerCase()),
  );

  return (
    <div className={styles.secBody}>

      {/* ── Barre filtres + export ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Filtres par type */}
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {FILTRES.map(f => (
            <button key={f.id}
              className={`${styles.btn} ${filtre === f.id ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => setFiltre(f.id)}>
              <i className={`fas ${f.icon}`} /> {f.label}
            </button>
          ))}
        </div>
        {/* Recherche */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--white)', border: '1.5px solid var(--bdr2)', borderRadius: 'var(--r-md)', padding: '8px 14px', minWidth: 200 }}>
          <i className="fas fa-magnifying-glass" style={{ color: 'var(--t3)', fontSize: 12 }} />
          <input style={{ border: 'none', outline: 'none', background: 'none', fontSize: 12.5, color: 'var(--t1)', fontFamily: 'var(--fb)', width: '100%' }}
            placeholder="Rechercher dans le journal…"
            value={recherche} onChange={e => setRecherche(e.target.value)} />
        </div>
        {/* Export */}
        <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
          onClick={() => onToast('Export du journal lancé (CSV)', 'i')}>
          <i className="fas fa-download" /> Exporter
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-clipboard-list" /> Journal d&apos;activité</div>
            <div className={styles.cardSub}>{visibles.length} entrée{visibles.length > 1 ? 's' : ''} — toutes les actions de l&apos;administrateur sont consignées</div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {visibles.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--t3)', padding: '24px 0', fontSize: 13 }}>
              Aucune entrée correspondant à votre recherche.
            </p>
          )}
          <div className={styles.timeline}>
            {visibles.map(e => (
              <div key={e.id} className={styles.tlItem}>
                {/* Dot coloré selon le type */}
                <div className={`${styles.tlDot} ${styles[DOT_CLS[e.kind] as keyof typeof styles]}`}>
                  <i className={`fas ${DOT_ICON[e.kind]}`} />
                </div>
                <div className={styles.tlBody}>
                  {/* Texte de l'action — données internes contrôlées */}
                  <div className={styles.tlText} dangerouslySetInnerHTML={{ __html: e.texte }} />
                  <div className={styles.tlMeta}>
                    <span className={styles.tlMetaItem}><i className="fas fa-user" /> {e.auteur}</span>
                    <span className={styles.tlMetaItem}><i className="fas fa-network-wired" /> {e.ip}</span>
                    <span className={styles.tlMetaItem}><i className="fas fa-laptop" /> {e.device}</span>
                    <span className={styles.tlMetaItem}><i className="fas fa-clock" /> {e.quand}</span>
                    <span className={styles.tlMetaItem}><i className="fas fa-fingerprint" /> {e.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
