/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/AuditPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/AuditPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';
import type { AuditKind } from '../data/types';

interface AuditPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
}

const KIND_ICON: Record<string, string> = {
  code: 'fa-qrcode',
  ok:   'fa-user-check',
  warn: 'fa-triangle-exclamation',
  ban:  'fa-ban',
};

const FILTRES: { id: 'all' | AuditKind; label: string }[] = [
  { id: 'all',  label: 'Toutes' },
  { id: 'ok',   label: 'Validations' },
  { id: 'ban',  label: 'Sanctions' },
  { id: 'code', label: 'Codes' },
];

export default function AuditPage({ onToast }: AuditPageProps) {
  const [filtre,    setFiltre]    = useState<'all' | AuditKind>('all');
  const [recherche, setRecherche] = useState('');
  const [page,      setPage]      = useState(1);
  const [data,      setData]      = useState<{ list: any[]; total: number } | null>(null);
  const [loading,   setLoading]   = useState(true);

  /* Le filtre kind/recherche s'applique sur la page courante (20
   * entrées) — kind est dérivé côté backend d'icon+action (pas une
   * colonne brute), pousser ce filtre en SQL demanderait de dupliquer
   * iconKind() en base ; acceptable ici, page à faible trafic. */
  useEffect(() => {
    apiFetch('/dashboard/admin/audit', { params: { page: String(page), limit: '20' } })
      .then(d => setData(d as any))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const total   = data?.total ?? 0;
  const visibles = (data?.list ?? []).filter((a: any) =>
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
            {f.label} {f.id === 'all' && <span className={styles.n}>{total}</span>}
          </button>
        ))}
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Rechercher une action…" value={recherche}
            onChange={e => setRecherche(e.target.value)} />
        </div>
      </div>

      {/* ── Journal ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}>
            <i className="fas fa-clipboard-list" /> Journal d&apos;audit — toutes vos actions sont consignées
          </div>
          <button className={styles.exportBtn} onClick={() => onToast('📄 Export du journal lancé', 'i')}>
            <i className="fas fa-download" /> Exporter
          </button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        ) : (
          <div className={styles.cb}>
            {visibles.length === 0 && (
              <p style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>Aucune entrée dans le journal.</p>
            )}
            {visibles.map((a: any) => (
              <div key={a.id} className={styles.aud}>
                <div className={`${styles.audIc} ${styles['aud_' + a.kind]}`}>
                  <i className={`fas ${KIND_ICON[a.kind] ?? 'fa-circle-info'}`} />
                </div>
                <div>
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
        )}
        <Pagination page={page} limit={20} total={total} onChange={setPage} />
      </div>
    </div>
  );
}
