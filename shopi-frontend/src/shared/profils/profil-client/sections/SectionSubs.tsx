import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilClient.module.css';
import type { Abonnement } from '../data/profilClientData';
import { apiFetch } from '../../../services/apiFetch';

type SousOnglet = 'boutiques' | 'livreurs' | 'correspondants';

const ONGLETS: { id: SousOnglet; icon: string; label: string; route: string }[] = [
  { id: 'boutiques',      icon: 'fa-store',      label: 'Boutiques',      route: '/boutique'       },
  { id: 'livreurs',       icon: 'fa-motorcycle', label: 'Livreurs',       route: '/livreurs'       },
  { id: 'correspondants', icon: 'fa-handshake',  label: 'Correspondants', route: '/correspondants' },
];

/* Endpoint toggle selon le type */
function toggleEndpoint(type: SousOnglet, id: string): string {
  if (type === 'livreurs')       return `/suivis/livreurs/${id}`;
  if (type === 'correspondants') return `/suivis/correspondants/${id}`;
  return `/suivis/boutiques/${id}`;
}

interface Props {
  abonnements: Abonnement[];
  loading?:    boolean;
  onToast:     (m: string) => void;
}

export default function SectionSubs({ abonnements, loading, onToast }: Props) {
  const navigate = useNavigate();
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>('boutiques');

  /* État local suivi : surcharge la valeur initiale après un toggle */
  const [suiviMap, setSuiviMap] = useState<Record<string, boolean>>({});
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const count = (t: SousOnglet) => abonnements.filter(a => a.type === t).length;
  const liste  = abonnements.filter(a => a.type === sousOnglet);
  const cfg    = ONGLETS.find(o => o.id === sousOnglet)!;

  /* Valeur suivi réelle : surcharge locale prioritaire, sinon donnée API */
  const isSuivi = (a: Abonnement) =>
    suiviMap[a.id] !== undefined ? suiviMap[a.id] : a.suivi;

  const handleToggle = useCallback(async (a: Abonnement) => {
    if (pendingIds.has(a.id)) return;           // éviter double clic
    const wasFollowing = isSuivi(a);

    /* Mise à jour optimiste */
    setSuiviMap(prev => ({ ...prev, [a.id]: !wasFollowing }));
    setPendingIds(prev => new Set(prev).add(a.id));

    try {
      const res = await apiFetch<{ isSuivi: boolean }>(
        toggleEndpoint(a.type, a.id),
        { method: 'POST' },
      );
      /* Confirmer avec la valeur serveur */
      const confirmed = res?.isSuivi ?? !wasFollowing;
      setSuiviMap(prev => ({ ...prev, [a.id]: confirmed }));
      onToast(confirmed ? `✅ Abonné à ${a.nom}` : `👋 Désabonné de ${a.nom}`);
    } catch {
      /* Rollback si erreur */
      setSuiviMap(prev => ({ ...prev, [a.id]: wasFollowing }));
      onToast(`❌ Erreur lors du suivi de ${a.nom}`);
    } finally {
      setPendingIds(prev => { const s = new Set(prev); s.delete(a.id); return s; });
    }
  }, [pendingIds, suiviMap, abonnements, onToast]);

  const goToProfile = (a: Abonnement) => {
    if (a.type === 'boutiques')      navigate(`/boutique/${a.id}`);
    else if (a.type === 'livreurs')       navigate(`/livreurs/${a.id}`);
    else if (a.type === 'correspondants') navigate(`/correspondants/${a.id}`);
  };

  return (
    <div className={styles.card}>

      {/* Sous-onglets */}
      <div className={styles.subsTabs}>
        {ONGLETS.map(o => (
          <button key={o.id}
            className={`${styles.stab} ${sousOnglet === o.id ? styles.stabOn : ''}`}
            onClick={() => setSousOnglet(o.id)}>
            <i className={`fas ${o.icon}`} /> {o.label} ({count(o.id)})
          </button>
        ))}
      </div>

      {/* Chargement */}
      {loading && (
        <div style={{ padding:'32px 0', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize:20, display:'block', marginBottom:8 }} />
          Chargement…
        </div>
      )}

      {/* Vide */}
      {!loading && liste.length === 0 && (
        <div style={{ padding:'32px 0', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
          <i className={`fas ${cfg.icon}`} style={{ fontSize:28, display:'block', marginBottom:10, color:'var(--t4)' }} />
          Vous ne suivez aucun{
            sousOnglet === 'boutiques' ? 'e boutique'
            : sousOnglet === 'livreurs' ? ' livreur'
            : ' correspondant'
          }.
          <br />
          <button
            onClick={() => navigate(cfg.route)}
            style={{
              marginTop:14, background:'var(--blue)', color:'#fff', border:'none',
              borderRadius:'var(--pill)', padding:'8px 20px',
              fontSize:12, fontWeight:700, cursor:'pointer',
            }}>
            Découvrir les {cfg.label.toLowerCase()}
          </button>
        </div>
      )}

      {/* Grille de cartes */}
      {!loading && liste.length > 0 && (
        <div className={styles.subGrid}>
          {liste.map(a => {
            const followed = isSuivi(a);
            const pending  = pendingIds.has(a.id);
            return (
              <div key={a.id} className={styles.subCard}
                onClick={() => goToProfile(a)}
                style={{ cursor:'pointer' }}>

                {/* Avatar */}
                <div
                  className={a.type === 'boutiques'
                    ? `${styles.subAva} ${styles.subAvaSq}`
                    : styles.subAva}
                  style={{ overflow:'hidden', padding: a.emoji?.startsWith('http') ? 0 : undefined }}
                >
                  {a.emoji?.startsWith('http')
                    ? <img src={a.emoji} alt={a.nom}
                        style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'inherit' }} />
                    : (a.emoji || '🏪')}
                </div>

                <div className={styles.subNm2}>
                  {a.nom} {a.international && '🌍'}
                </div>
                <div className={styles.subCat}>{a.categorie}</div>

                <div className={styles.subInfo}>
                  <span className={styles.subSi}>
                    <i className="fas fa-users" /> {a.abonnes} abonnés
                  </span>
                  {a.note !== '—' && (
                    <span className={styles.subSi}>
                      <i className="fas fa-star" style={{ color:'#F59E0B' }} /> {a.note}
                    </span>
                  )}
                </div>

                {/* Bouton Suivre / Abonné */}
                <button
                  disabled={pending}
                  className={`${styles.fbtn} ${followed ? styles.fbtnOn : styles.fbtnOff}`}
                  onClick={e => { e.stopPropagation(); handleToggle(a); }}
                  style={{ opacity: pending ? .6 : 1 }}
                >
                  {pending
                    ? <><i className="fas fa-spinner fa-spin" /> …</>
                    : followed
                      ? <><i className="fas fa-check" /> Abonné</>
                      : <><i className="fas fa-plus" /> Suivre</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
