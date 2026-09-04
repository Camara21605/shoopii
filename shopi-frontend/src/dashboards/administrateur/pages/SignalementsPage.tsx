/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/SignalementsPage.tsx
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import styles from '../styles/SignalementsPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';

interface SignalementsPageProps {
  onSanction: (targetUserId: string, cible: string) => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
  /** Deep-link "clic sur une notification" — id du signalement à afficher
   * en priorité, qu'il soit ou non sur la page/onglet actuellement chargé. */
  highlightId?: string | null;
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

export default function SignalementsPage({ onSanction, onToast, highlightId }: SignalementsPageProps) {
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

  /* ── Signalement ciblé par une notification ──
   * Fetch dédié (indépendant de la pagination/l'onglet actifs) — l'élément
   * visé n'est pas forcément déjà chargé dans `data.list`. */
  const [targeted, setTargeted] = useState<any | null>(null);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!highlightId) { setTargeted(null); fetchedForRef.current = null; return; }
    if (fetchedForRef.current === highlightId) return;
    fetchedForRef.current = highlightId;

    apiFetch(`/dashboard/admin/signalements/${highlightId}`)
      .then(d => setTargeted(d as any))
      .catch(() => {
        setTargeted(null);
        onToast('Ce signalement est introuvable (peut-être déjà supprimé).', 'i');
      });
  }, [highlightId, onToast]);

  const investigate = async (id: string, titre: string) => {
    try {
      await apiFetch(`/dashboard/admin/signalements/${id}/investigate`, { method: 'PATCH' });
      onToast('🔍 Enquête ouverte sur ' + titre, 'i');
      load();
    } catch (e: any) {
      onToast(e?.message ?? "Erreur lors de l'ouverture de l'enquête", 'w');
    }
  };

  const warn = async (id: string, titre: string) => {
    try {
      await apiFetch(`/dashboard/admin/signalements/${id}/warn`, { method: 'PATCH' });
      onToast('⚠️ Avertissement envoyé à ' + titre, 'w');
      load();
    } catch (e: any) {
      onToast(e?.message ?? "Erreur lors de l'envoi de l'avertissement", 'w');
    }
  };

  /* BUG CORRIGÉ — "Classer sans suite" appelait resolve() : un signalement
   * jugé infondé portait le même statut RESOLVED qu'un signalement
   * réellement traité (avertissement/suspension), rendant les deux
   * indiscernables. Le statut REJECTED (déjà anticipé dans ST ci-dessus,
   * jamais atteignable jusqu'ici) est maintenant réellement utilisé. */
  const reject = async (id: string, titre: string) => {
    try {
      await apiFetch(`/dashboard/admin/signalements/${id}/reject`, { method: 'PATCH' });
      onToast('🗑️ Signalement rejeté : ' + titre, 'i');
      load();
    } catch (e: any) {
      onToast(e?.message ?? 'Erreur lors du rejet', 'w');
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

      {/* ── Signalement ciblé par une notification ── */}
      {targeted && (() => {
        const stInfo = ST[targeted.statut] ?? ST.review;
        return (
          <div className={styles.targeted}>
            <div className={styles.targetedHead}>
              <i className="fas fa-bell" /> Signalement visé par la notification
              <button className={styles.targetedClose} onClick={() => setTargeted(null)} title="Fermer">
                <i className="fas fa-xmark" />
              </button>
            </div>
            <div className={styles.item} style={{ paddingTop: 0, borderBottom: 'none' }}>
              <div className={styles.av}>{targeted.avatar}</div>
              <div className={styles.main}>
                <div className={styles.top}>
                  <span className={styles.nm}>{targeted.cible}</span>
                  <span className={`${styles.sev} ${styles['sev_' + targeted.gravite]}`}>{GRAVITE_LABEL[targeted.gravite] ?? targeted.gravite}</span>
                  <span className={`${styles.typePill} ${styles['t_' + targeted.type]}`}>
                    <i className={`fas ${TYPE_ICON[targeted.type] ?? 'fa-user'}`} /> {TYPE_LABEL[targeted.type] ?? targeted.type}
                  </span>
                  <span className={`${styles.st} ${styles['st_' + targeted.statut]}`}>
                    <i className={`fas ${stInfo.icon}`} /> {stInfo.label}
                  </span>
                </div>
                <div className={styles.reason}>{targeted.raison}</div>
                <div className={styles.meta}>
                  <span><i className="fas fa-user" /> Signalé par : {targeted.signalePar}</span>
                  <span><i className="fas fa-tag" /> {targeted.motifLabel}</span>
                  <span><i className="fas fa-calendar" /> {targeted.quand}</span>
                </div>
                {targeted.statut === 'review' && (
                  <div className={styles.acts}>
                    <button className={`${styles.rbtn} ${styles.inv}`}
                      onClick={() => { investigate(targeted.id, targeted.cible); setTargeted(null); }}>
                      <i className="fas fa-magnifying-glass" /> Ouvrir une enquête
                    </button>
                    {targeted.targetUserId ? (
                      <>
                        <button className={`${styles.rbtn} ${styles.warn}`}
                          onClick={() => warn(targeted.id, targeted.cible)}>
                          <i className="fas fa-triangle-exclamation" /> Avertir
                        </button>
                        <button className={`${styles.rbtn} ${styles.susp}`} onClick={() => onSanction(targeted.targetUserId, targeted.cible)}>
                          <i className="fas fa-ban" /> Suspendre
                        </button>
                      </>
                    ) : (
                      <span className={styles.noTarget} title="Ce signalement ne référence pas de compte identifié — impossible d'avertir ou de suspendre directement.">
                        <i className="fas fa-circle-question" /> Compte non identifié
                      </span>
                    )}
                    <button className={`${styles.rbtn} ${styles.rej}`}
                      onClick={() => { reject(targeted.id, targeted.cible); setTargeted(null); }}>
                      <i className="fas fa-xmark" /> Classer sans suite
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
                            onClick={() => investigate(s.id, s.cible)}>
                            <i className="fas fa-magnifying-glass" /> Ouvrir une enquête
                          </button>
                          {s.targetUserId ? (
                            <>
                              <button className={`${styles.rbtn} ${styles.warn}`}
                                onClick={() => warn(s.id, s.cible)}>
                                <i className="fas fa-triangle-exclamation" /> Avertir
                              </button>
                              <button className={`${styles.rbtn} ${styles.susp}`} onClick={() => onSanction(s.targetUserId, s.cible)}>
                                <i className="fas fa-ban" /> Suspendre
                              </button>
                            </>
                          ) : (
                            <span className={styles.noTarget} title="Ce signalement ne référence pas de compte identifié — impossible d'avertir ou de suspendre directement.">
                              <i className="fas fa-circle-question" /> Compte non identifié
                            </span>
                          )}
                          <button className={`${styles.rbtn} ${styles.rej}`}
                            onClick={() => reject(s.id, s.cible)}>
                            <i className="fas fa-xmark" /> Classer sans suite
                          </button>
                        </>
                      )}
                      {s.statut === 'invest' && (
                        <>
                          {s.targetUserId ? (
                            <button className={`${styles.rbtn} ${styles.susp}`} onClick={() => onSanction(s.targetUserId, s.cible)}>
                              <i className="fas fa-ban" /> Suspendre maintenant
                            </button>
                          ) : (
                            <span className={styles.noTarget} title="Ce signalement ne référence pas de compte identifié — impossible de suspendre directement.">
                              <i className="fas fa-circle-question" /> Compte non identifié
                            </span>
                          )}
                          <button className={`${styles.rbtn} ${styles.rej}`}
                            onClick={() => reject(s.id, s.cible)}>
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
