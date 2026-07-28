/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/PartenairesPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/PartenairesPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import type { PartenaireTier } from '../data/types';

interface PartenairesPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const TIER_LABEL: Record<string, string> = { or: 'Or', arg: 'Argent', brz: 'Bronze' };

export default function PartenairesPage({ onSanction, onToast }: PartenairesPageProps) {
  const [filtre,    setFiltre]    = useState<'all' | PartenaireTier>('all');
  const [recherche, setRecherche] = useState('');
  const [data,      setData]      = useState<{ list: any[]; top3: any[] } | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    apiFetch('/dashboard/admin/partenaires')
      .then(d => setData(d as any))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const top3       = data?.top3 ?? [];
  const partenaires = data?.list ?? [];

  const counts = {
    all: partenaires.length,
    or:  partenaires.filter((p: any) => p.tier === 'or').length,
    arg: partenaires.filter((p: any) => p.tier === 'arg').length,
    brz: partenaires.filter((p: any) => p.tier === 'brz').length,
  };

  const visibles = partenaires.filter((p: any) =>
    (filtre === 'all' || p.tier === filtre) &&
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      {/* ── Podium Top 3 ── */}
      {top3.length > 0 && (
        <div className={styles.top3}>
          {top3.map((t: any, i: number) => (
            <div key={t.nom} className={`${styles.top3Card} ${i === 0 ? styles.first : ''}`}>
              <div className={`${styles.rank} ${styles['r' + (i + 1)]}`}>{i + 1}</div>
              <div className={styles.top3Av} style={{ background: t.grad }}>{t.avatar}</div>
              <div className={styles.top3Nm}>{t.nom}</div>
              <div className={styles.top3V}>{t.v}</div>
              <div className={styles.top3L}>{t.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtres ── */}
      <div className={styles.filterBar}>
        <button className={`${styles.fchip} ${filtre === 'all' ? styles.fon : ''}`} onClick={() => setFiltre('all')}>
          Tous <span className={styles.n}>{counts.all}</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'or' ? styles.fon : ''}`} onClick={() => setFiltre('or')}>
          <i className="fas fa-crown" style={{ color: 'var(--gold)' }} /> Or <span className={styles.n}>{counts.or}</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'arg' ? styles.fon : ''}`} onClick={() => setFiltre('arg')}>
          Argent <span className={styles.n}>{counts.arg}</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'brz' ? styles.fon : ''}`} onClick={() => setFiltre('brz')}>
          Bronze <span className={styles.n}>{counts.brz}</span>
        </button>
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Rechercher un partenaire…" value={recherche}
            onChange={e => setRecherche(e.target.value)} />
        </div>
      </div>

      {/* ── Grille ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
          <i className="fas fa-spinner fa-spin fa-2x" />
        </div>
      ) : (
        <div className={styles.grid}>
          {visibles.length === 0 && (
            <p style={{ opacity: .5 }}>Aucun partenaire trouvé.</p>
          )}
          {visibles.map((p: any) => (
            <div key={p.id} className={styles.pcard}>
              <div className={styles.top}>
                <div className={styles.av}>{p.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div className={styles.nm}>{p.nom}</div>
                  <div className={styles.meta}>{p.commune} · depuis {p.depuis}</div>
                </div>
                <span className={`${styles.tier} ${styles['tier_' + p.tier]}`}>
                  {p.tier === 'or' && <i className="fas fa-crown" />} {TIER_LABEL[p.tier] ?? p.tier}
                </span>
              </div>
              <div className={styles.body}>
                <div className={styles.stat}><div className={styles.sv}>{p.recrues}</div><div className={styles.sl}>Recrues</div></div>
                <div className={styles.stat}><div className={styles.sv}>{p.conversion}%</div><div className={styles.sl}>Conversion</div></div>
                <div className={styles.stat}><div className={styles.sv}>{p.confiance}</div><div className={styles.sl}>Confiance</div></div>
              </div>
              <div className={styles.foot}>
                <span className={`${styles.state} ${p.statut === 'act' ? styles.stateAct : styles.statePend}`}>
                  {p.statut === 'act' ? 'Actif' : 'En observation'}
                </span>
                <div className={styles.footBtns}>
                  <button className={styles.btn} onClick={() => onToast('👤 Profil de ' + p.nom, 'i')}>Gérer</button>
                  <button className={styles.banBtn} title="Suspendre" onClick={() => onSanction(p.nom)}>
                    <i className="fas fa-ban" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
