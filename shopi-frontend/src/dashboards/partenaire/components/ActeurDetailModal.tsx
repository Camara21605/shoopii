/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/ActeurDetailModal.tsx
 *
 * Fiche détail d'un acteur recruté — bouton "Gérer" (ActeursPage.tsx).
 *
 * Terminé — remplaçait un faux toast "Profil de {nom}" sans aucune vraie
 * donnée. Affiche maintenant les coordonnées réelles de l'acteur et la
 * commande/commission réellement générées pour ce partenaire par cet
 * acteur précis (GET /dashboard/partenaire/acteurs/:type/:id).
 * ================================================================ */

import { useEffect, useState } from 'react';
import styles from '../styles/GenerateCodeModal.module.css';
import { apiFetch } from '@/shared/services/apiFetch';
import { fmtGnf, TYPE_LABEL } from '../data/partenaireData';
import type { ActeurType } from '../data/types';

interface Props {
  actorId:   string;
  type:      ActeurType;
  onClose:   () => void;
  onReport:  (userId: string, nom: string) => void;
}

interface ActeurDetail {
  id:                 string;
  userId:             string;
  type:               string;
  nom:                string;
  statut:             'act' | 'pend';
  avatar:             string;
  memberSince:        string;
  telephone:          string | null;
  email:              string | null;
  ville:              string | null;
  adresse:            string | null;
  photoUrl:           string | null;
  nbCommandes:        number;
  commissionGeneree:  number;
}

const TYPE_ICON: Record<string, string> = { ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };

export default function ActeurDetailModal({ actorId, type, onClose, onReport }: Props) {
  const [data,    setData]    = useState<ActeurDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<ActeurDetail>(`/dashboard/partenaire/acteurs/${type}/${actorId}`)
      .then(setData)
      .catch(err => setError(err?.message ?? "Impossible de charger la fiche de cet acteur."))
      .finally(() => setLoading(false));
  }, [actorId, type]);

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        {loading && (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted, #6B7280)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 22 }} />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <i className="fas fa-circle-exclamation" style={{ fontSize: 22, color: 'var(--rose, #E11D48)', marginBottom: 10, display: 'block' }} />
            <div style={{ fontSize: 13, color: 'var(--t2, #6B7280)' }}>{error}</div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className={styles.head}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--navy, #0B1F3A)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 15,
                }}>
                  {data.avatar}
                </div>
                <div>
                  <div className={styles.title}>{data.nom}</div>
                  <div className={styles.sub}>
                    <i className={`fas ${TYPE_ICON[data.type] ?? 'fa-user'}`} /> {TYPE_LABEL[data.type] ?? data.type}
                    {' · '}
                    <span style={{ color: data.statut === 'act' ? '#059669' : '#D97706', fontWeight: 700 }}>
                      {data.statut === 'act' ? 'Actif' : 'En attente'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.body}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div style={{ background: 'var(--g50, #F9FAFB)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3, #9CA3AF)', textTransform: 'uppercase', letterSpacing: .5 }}>Commandes</div>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 800, color: 'var(--navy, #0B1F3A)', marginTop: 4 }}>{data.nbCommandes}</div>
                </div>
                <div style={{ background: 'var(--g50, #F9FAFB)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3, #9CA3AF)', textTransform: 'uppercase', letterSpacing: .5 }}>Commission générée</div>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800, color: '#059669', marginTop: 4 }}>{fmtGnf(data.commissionGeneree)}</div>
                </div>
              </div>

              <div className={styles.fld}>
                <label className={styles.lbl}>Coordonnées</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--t1, #111827)' }}>
                  <div><i className="fas fa-phone" style={{ width: 18, color: 'var(--t3, #9CA3AF)' }} /> {data.telephone ?? '—'}</div>
                  <div><i className="fas fa-envelope" style={{ width: 18, color: 'var(--t3, #9CA3AF)' }} /> {data.email ?? '—'}</div>
                  <div><i className="fas fa-location-dot" style={{ width: 18, color: 'var(--t3, #9CA3AF)' }} /> {[data.adresse, data.ville].filter(Boolean).join(', ') || '—'}</div>
                  <div><i className="fas fa-calendar" style={{ width: 18, color: 'var(--t3, #9CA3AF)' }} /> Membre depuis le {new Date(data.memberSince).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              </div>

              <button className={styles.btn} style={{ marginTop: 8, background: 'var(--rose, #E11D48)' }}
                onClick={() => { onReport(data.userId, data.nom); onClose(); }}>
                <i className="fas fa-flag" /> Signaler cet acteur
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
