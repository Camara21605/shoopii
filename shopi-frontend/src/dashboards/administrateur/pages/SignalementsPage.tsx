/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/SignalementsPage.tsx
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/SignalementsPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';

interface SignalementsPageProps {
  onSanction: (cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const TYPE_LABEL: Record<string, string> = { par: 'Partenaire', ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant' };
const TYPE_ICON:  Record<string, string> = { par: 'fa-handshake', ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };

const GRAVITE_LABEL: Record<string, string> = { low: 'Mineur', med: 'Modéré', high: 'Grave' };

const ST: Record<string, { label: string; icon: string }> = {
  review:   { label: 'Nouveau',          icon: 'fa-clock' },
  invest:   { label: 'Enquête en cours', icon: 'fa-magnifying-glass' },
  resolved: { label: 'Résolu',           icon: 'fa-circle-check' },
  rejected: { label: 'Rejeté',           icon: 'fa-xmark' },
};

type Onglet = 'atraiter' | 'encours' | 'traites';

export default function SignalementsPage({ onSanction, onToast }: SignalementsPageProps) {
  const [onglet,  setOnglet]  = useState<Onglet>('atraiter');
  const [page,    setPage]    = useState(1);
  const [data,    setData]    = useState<{ list: any[]; stats: any; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFetch('/dashboard/admin/signalements', { params: { page: String(page), limit: '20' } })
      .then(d => setData(d as any))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [page]);

  const resolve = async (id: string, titre: string) => {
    try {
      await apiFetch(`/dashboard/admin/signalements/${id}/resolve`, { method: 'PATCH' });
      onToast('✅ Signalement résolu : ' + titre, 's');
      load();
    } catch {
      onToast('Erreur lors de la résolution', 'w');
    }
  };

  const stats = data?.stats ?? { aTraiter: 0, enCours: 0, traites: 0, suspendus: 0 };
  const all   = data?.list  ?? [];
  const total = data?.total ?? 0;

  const visibles = all.filter((s: any) =>
    onglet === 'atraiter' ? s.statut === 'review'
    : onglet === 'encours' ? s.statut === 'invest'
    : s.statut === 'resolved' || s.statut === 'rejected'
  );

  return (
    <div>
      {/* ── Bandeau ── */}
      <div className={styles.banner}>
        <div className={styles.bannerIc}><i className="fas fa-shield-halved" /></div>
        <div>
          <div className={styles.bannerT}>Centre de modération</div>
          <div className={styles.bannerP}>
            Les signalements envoyés par vos partenaires et les utilisateurs arrivent ici.
            Examinez les preuves, ouvrez une enquête, avertissez ou suspendez les comptes malveillants.
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>{stats.aTraiter}</div><div className={styles.cstatL}>À traiter</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>{stats.enCours}</div><div className={styles.cstatL}>Enquêtes en cours</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>{stats.traites}</div><div className={styles.cstatL}>Traités</div></div>
        <div className={styles.cstat}><div className={styles.cstatV}>{stats.suspendus}</div><div className={styles.cstatL}>Comptes suspendus</div></div>
      </div>

      {/* ── Liste ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-flag" /> Signalements reçus</div>
          <div className={styles.chTabs}>
            {(['atraiter', 'encours', 'traites'] as Onglet[]).map(o => (
              <button key={o} className={`${styles.chTab} ${onglet === o ? styles.chTabOn : ''}`}
                onClick={() => setOnglet(o)}>
                {o === 'atraiter' ? 'À traiter' : o === 'encours' ? 'En cours' : 'Traités'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        ) : (
          <div className={styles.cb}>
            {visibles.length === 0 && (
              <p className={styles.empty}>Aucun signalement dans cette catégorie. ✨</p>
            )}
            {visibles.map((s: any) => {
              const stInfo = ST[s.statut] ?? ST.review;
              return (
                <div key={s.id} className={styles.item}>
                  <div className={styles.av}>{s.avatar}</div>
                  <div className={styles.main}>
                    <div className={styles.top}>
                      <span className={styles.nm}>{s.cible}</span>
                      <span className={`${styles.sev} ${styles['sev_' + s.gravite]}`}>{GRAVITE_LABEL[s.gravite] ?? s.gravite}</span>
                      <span className={`${styles.typePill} ${styles['t_' + s.type]}`}>
                        <i className={`fas ${TYPE_ICON[s.type] ?? 'fa-user'}`} /> {TYPE_LABEL[s.type] ?? s.type}
                      </span>
                      <span className={`${styles.st} ${styles['st_' + s.statut]}`}>
                        <i className={`fas ${stInfo.icon}`} /> {stInfo.label}
                      </span>
                    </div>
                    <div className={styles.reason}>{s.raison}</div>
                    <div className={styles.meta}>
                      <span><i className="fas fa-user" /> Signalé par : {s.signalePar}</span>
                      <span><i className="fas fa-tag" /> {s.motifLabel}</span>
                      <span><i className="fas fa-hashtag" /> {s.id.slice(0, 12)}</span>
                      <span><i className="fas fa-calendar" /> {s.quand}</span>
                    </div>
                    <div className={styles.acts}>
                      {s.statut === 'review' && (
                        <>
                          <button className={`${styles.rbtn} ${styles.inv}`}
                            onClick={() => onToast('🔍 Enquête ouverte sur ' + s.cible, 'i')}>
                            <i className="fas fa-magnifying-glass" /> Ouvrir une enquête
                          </button>
                          <button className={`${styles.rbtn} ${styles.warn}`}
                            onClick={() => onToast('⚠️ Avertissement envoyé', 'w')}>
                            <i className="fas fa-triangle-exclamation" /> Avertir
                          </button>
                          <button className={`${styles.rbtn} ${styles.susp}`} onClick={() => onSanction(s.cible)}>
                            <i className="fas fa-ban" /> Suspendre
                          </button>
                          <button className={`${styles.rbtn} ${styles.rej}`}
                            onClick={() => resolve(s.id, s.cible)}>
                            <i className="fas fa-xmark" /> Classer sans suite
                          </button>
                        </>
                      )}
                      {s.statut === 'invest' && (
                        <>
                          <button className={`${styles.rbtn} ${styles.susp}`} onClick={() => onSanction(s.cible)}>
                            <i className="fas fa-ban" /> Suspendre maintenant
                          </button>
                          <button className={`${styles.rbtn} ${styles.rej}`}
                            onClick={() => resolve(s.id, s.cible)}>
                            <i className="fas fa-xmark" /> Clore sans suite
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination page={page} limit={20} total={total} onChange={setPage} />
      </div>
    </div>
  );
}
