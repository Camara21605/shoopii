/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/PartenairesPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/PartenairesPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';
import type { PartenaireTier } from '../data/types';

interface PartenairesPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const TIER_LABEL: Record<string, string> = { or: 'Or', arg: 'Argent', brz: 'Bronze' };

export default function PartenairesPage({ onSanction, onToast }: PartenairesPageProps) {
  const [filtre,    setFiltre]    = useState<'all' | PartenaireTier>('all');
  const [recherche, setRecherche] = useState('');
  const [page,      setPage]      = useState(1);
  const [data,      setData]      = useState<{ list: any[]; top3: any[]; counts: Record<string, number>; total: number } | null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch('/dashboard/admin/partenaires', {
        params: {
          tier:   filtre !== 'all' ? filtre : undefined,
          search: recherche.trim() || undefined,
          page:   String(page),
          limit:  '20',
        },
      })
        .then(d => setData(d as any))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [filtre, recherche, page]);

  const changeFiltre = (f: 'all' | PartenaireTier) => { setFiltre(f); setPage(1); };
  const changeRecherche = (v: string) => { setRecherche(v); setPage(1); };

  const top3     = data?.top3 ?? [];
  const visibles = data?.list ?? [];
  const total    = data?.total ?? 0;
  const counts   = data?.counts ?? { all: 0, or: 0, arg: 0, brz: 0 };

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
        <button className={`${styles.fchip} ${filtre === 'all' ? styles.fon : ''}`} onClick={() => changeFiltre('all')}>
          Tous <span className={styles.n}>{counts.all}</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'or' ? styles.fon : ''}`} onClick={() => changeFiltre('or')}>
          <i className="fas fa-crown" style={{ color: 'var(--gold)' }} /> Or <span className={styles.n}>{counts.or}</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'arg' ? styles.fon : ''}`} onClick={() => changeFiltre('arg')}>
          Argent <span className={styles.n}>{counts.arg}</span>
        </button>
        <button className={`${styles.fchip} ${filtre === 'brz' ? styles.fon : ''}`} onClick={() => changeFiltre('brz')}>
          Bronze <span className={styles.n}>{counts.brz}</span>
        </button>
        <div className={styles.searchIn}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Rechercher un partenaire…" value={recherche}
            onChange={e => changeRecherche(e.target.value)} />
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
      <Pagination page={page} limit={20} total={total} onChange={setPage} />
    </div>
  );
}
