/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/ActeursPage.tsx
 * Mes acteurs : grille filtrable — données réelles.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/ActeursPage.module.css';
import { apiFetch } from '@/shared/services/apiFetch';
import ActeurDetailModal from '../components/ActeurDetailModal';
import type { ActeurType } from '../data/types';

interface Props {
  /* BUG CORRIGÉ — n'envoyait que le nom affiché (texte libre) : l'admin ne
   * pouvait jamais rattacher le signalement à un vrai compte (targetUserId
   * toujours absent), ce qui bloquait aussi l'auto-suspension côté admin
   * (AdminSignalementsService.warnSignalement exige un targetUserId). */
  onReport: (userId: string, cible: string) => void;
  onToast:  (msg: string, type?: 's' | 'i' | 'w') => void;
}

interface ActeurRow {
  id: string;
  type: ActeurType;
  nom: string;
  meta: string;
  avatar: string;
  statut: 'act' | 'pend';
  userId: string;
  createdAt: string;
}

interface ActeursData {
  total: number;
  nbCompanies: number;
  nbDeliveries: number;
  nbCorrespondants: number;
  acteurs: ActeurRow[];
}

type Filter = 'all' | ActeurType;

export default function ActeursPage({ onReport }: Props) {
  const [data, setData]       = useState<ActeursData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>('all');
  const [detailActor, setDetailActor] = useState<{ id: string; type: ActeurType } | null>(null);

  useEffect(() => {
    apiFetch<ActeursData>('/dashboard/partenaire/acteurs')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const filters: { id: Filter; icon?: string; label: string; count: () => number }[] = [
    { id: 'all', label: 'Tous',          count: () => data?.total ?? 0 },
    { id: 'ent', icon: 'fa-store',      label: 'Entreprises',    count: () => data?.nbCompanies ?? 0 },
    { id: 'lvr', icon: 'fa-motorcycle', label: 'Livreurs',       count: () => data?.nbDeliveries ?? 0 },
    { id: 'cor', icon: 'fa-map-pin',    label: 'Correspondants', count: () => data?.nbCorrespondants ?? 0 },
  ];

  const list = (data?.acteurs ?? []).filter(a => filter === 'all' || a.type === filter);

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
    </div>
  );

  return (
    <div>
      <div className={styles.filterBar}>
        {filters.map(f => (
          <button key={f.id}
            className={`${styles.fchip} ${filter === f.id ? styles.on : ''}`}
            onClick={() => setFilter(f.id)}>
            {f.icon && <i className={`fas ${f.icon}`} />} {f.label} <span className={styles.n}>{f.count()}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          <i className="fas fa-users" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.4 }} />
          Aucun acteur dans cette catégorie
        </div>
      ) : (
        <div className={styles.grid}>
          {list.map(a => (
            <div key={a.id} className={styles.acard}>
              <div className={styles.top}>
                <div className={`${styles.av} ${styles['av_' + a.type]}`}>
                  {a.avatar}<span className={`${styles.on2} ${styles['on_' + a.statut]}`} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.nm}>{a.nom}</div>
                  <div className={styles.meta}>{a.meta}</div>
                </div>
                <span className={`${styles.state} ${styles['state_' + a.statut]}`}>
                  {a.statut === 'act' ? 'Actif' : 'En attente'}
                </span>
              </div>

              <div className={styles.foot}>
                <div className={styles.footActs}>
                  <button className={styles.gerer} onClick={() => setDetailActor({ id: a.id, type: a.type })}>Gérer</button>
                  <button className={styles.flag} title="Signaler cet acteur" onClick={() => onReport(a.userId, a.nom)}><i className="fas fa-flag" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detailActor && (
        <ActeurDetailModal
          actorId={detailActor.id}
          type={detailActor.type}
          onClose={() => setDetailActor(null)}
          onReport={onReport}
        />
      )}
    </div>
  );
}
