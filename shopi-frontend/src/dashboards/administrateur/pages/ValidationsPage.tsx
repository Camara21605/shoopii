/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/ValidationsPage.tsx
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import styles from '../styles/ValidationsPage.module.css';
import { apiFetch, ApiError } from '../../../shared/services/apiFetch';

interface ValidationsPageProps {
  onToast: (msg: string, type?: 's' | 'i' | 'w') => void;
  /** Deep-link "clic sur une notification" — id du compte (User.id) à
   * mettre en évidence, s'il est encore en attente de validation. */
  highlightId?: string | null;
}

const TYPE_LABEL: Record<string, string> = { par: 'Partenaire', ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant' };
const TYPE_ICON:  Record<string, string> = { par: 'fa-handshake', ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };

export default function ValidationsPage({ onToast, highlightId }: ValidationsPageProps) {
  const [data,    setData]    = useState<{ list: any[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  const notifiedRef    = useRef<string | null>(null); // évite de re-toaster à chaque re-render

  const load = () => {
    setLoading(true);
    apiFetch('/dashboard/admin/validations')
      .then(d => setData(d as any))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /* Scroll + surlignage de l'élément visé par la notification, une fois
   * la liste chargée. Si le compte a déjà été traité entre-temps (validé/
   * refusé par un autre admin), on le signale plutôt que de rester muet. */
  useEffect(() => {
    if (!highlightId || loading || !data) return;
    if (notifiedRef.current === highlightId) return;

    const found = data.list.some((v: any) => v.id === highlightId);
    if (found) {
      highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      onToast('Ce compte a déjà été traité.', 'i');
    }
    notifiedRef.current = highlightId;
  }, [highlightId, loading, data, onToast]);

  const approve = async (id: string, nom: string) => {
    try {
      await apiFetch(`/dashboard/admin/validations/${id}/approve`, { method: 'PATCH' });
      onToast(`✅ ${nom} validé(e)`, 's');
      load();
    } catch (err) {
      /* BUG CORRIGÉ — le message réel (ex: "documents KYC manquants") était
       * remplacé par un texte générique, l'admin ne savait jamais POURQUOI
       * une validation échouait (voir PlatformSettings.kycRequired). */
      onToast(err instanceof ApiError ? err.message : 'Erreur lors de la validation', 'w');
    }
  };

  const reject = async (id: string, nom: string) => {
    try {
      await apiFetch(`/dashboard/admin/validations/${id}/reject`, { method: 'PATCH' });
      onToast(`❌ Compte de ${nom} refusé`, 'w');
      load();
    } catch {
      onToast('Erreur lors du refus', 'w');
    }
  };

  const stats = data?.stats ?? { pending: 0, validatedMois: 0, refusedMois: 0 };
  const list  = data?.list  ?? [];

  return (
    <div>
      {/* ── Stats ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>{stats.pending}</div><div className={styles.cstatL}>En attente de validation</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>{stats.validatedMois}</div><div className={styles.cstatL}>Validés ce mois</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>{stats.refusedMois}</div><div className={styles.cstatL}>Refusés ce mois</div></div>
        <div className={styles.cstat}><div className={styles.cstatV}>&lt; 24h</div><div className={styles.cstatL}>Délai moyen</div></div>
      </div>

      {/* ── Liste ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-user-check" /> Comptes en attente de validation</div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        ) : (
          <div className={styles.cb}>
            {list.length === 0 && (
              <p style={{ textAlign: 'center', opacity: .5, padding: '2rem' }}>
                <i className="fas fa-circle-check" /> Aucun compte en attente de validation.
              </p>
            )}
            {list.map((v: any) => (
              <div
                key={v.id}
                ref={v.id === highlightId ? highlightedRef : undefined}
                className={`${styles.item} ${v.id === highlightId ? styles.itemHighlight : ''}`}
              >
                <div className={`${styles.av} ${styles['av_' + v.type]}`}>{v.avatar}</div>
                <div className={styles.main}>
                  <div className={styles.top}>
                    <span className={styles.nm}>{v.nom}</span>
                    <span className={`${styles.typePill} ${styles['t_' + v.type]}`}>
                      <i className={`fas ${TYPE_ICON[v.type] ?? 'fa-user'}`} /> {TYPE_LABEL[v.type] ?? v.type}
                    </span>
                  </div>
                  <div className={styles.d}>{v.description}</div>
                  <div className={styles.meta}>
                    <span><i className="fas fa-location-dot" /> {v.commune}</span>
                    <span><i className="fas fa-calendar" /> {v.quand}</span>
                    <span><i className="fas fa-user" /> Recruté par : {v.recrutePar}</span>
                  </div>
                </div>
                <div className={styles.acts}>
                  <button className={`${styles.vbtn} ${styles.doc}`}
                    onClick={() => onToast('📄 Aperçu des documents', 'i')}>
                    <i className="fas fa-file-lines" /> Documents
                  </button>
                  <button className={`${styles.vbtn} ${styles.ok}`}
                    onClick={() => approve(v.id, v.nom)}>
                    <i className="fas fa-check" /> Valider
                  </button>
                  <button className={`${styles.vbtn} ${styles.no}`}
                    onClick={() => reject(v.id, v.nom)}>
                    <i className="fas fa-xmark" /> Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
