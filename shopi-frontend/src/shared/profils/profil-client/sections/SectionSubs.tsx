import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilClient.module.css';
import type { Abonnement } from '../data/profilClientData';
import FollowButton from '../../../components/FollowButton';
import { useAuthGate } from '../../../hooks/useAuthGate';
import type { FollowActorType } from '../../../services/follow';

type SousOnglet = 'boutiques' | 'livreurs' | 'correspondants' | 'masques';

const ONGLETS: { id: SousOnglet; icon: string; label: string; route: string | null }[] = [
  { id: 'boutiques',      icon: 'fa-store',       label: 'Boutiques',      route: '/boutique'       },
  { id: 'livreurs',       icon: 'fa-motorcycle',  label: 'Livreurs',       route: '/livreurs'       },
  { id: 'correspondants', icon: 'fa-handshake',   label: 'Correspondants', route: '/correspondants' },
  { id: 'masques',        icon: 'fa-eye-slash',   label: 'Masqués',        route: null              },
];

/* type d'Abonnement ('boutiques'/'livreurs'/'correspondants') → actorType FollowButton */
function toActorType(type: Abonnement['type']): FollowActorType {
  if (type === 'boutiques') return 'entreprise';
  if (type === 'livreurs')  return 'livreur';
  return 'correspondant';
}

interface Props {
  abonnements: Abonnement[];
  loading?:    boolean;
  onToast:     (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function SectionSubs({ abonnements, loading, onToast }: Props) {
  const navigate = useNavigate();
  const { openAuthModal, authModal } = useAuthGate();
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>('boutiques');

  /* Surcharges locales : un item réaffiché depuis "Masqués" doit
   * réapparaître dans son onglet normal sans attendre un refetch,
   * et inversement un item tout juste masqué doit disparaître d'ici. */
  const [hiddenOverride, setHiddenOverride] = useState<Record<string, boolean>>({});
  const [removedIds,     setRemovedIds]     = useState<Set<string>>(new Set());

  const isHidden = (a: Abonnement) => hiddenOverride[a.id] ?? a.hidden;

  const visibles = abonnements.filter(a => !removedIds.has(a.id));
  const count = (t: SousOnglet) =>
    t === 'masques'
      ? visibles.filter(isHidden).length
      : visibles.filter(a => a.type === t && !isHidden(a)).length;

  const liste = sousOnglet === 'masques'
    ? visibles.filter(isHidden)
    : visibles.filter(a => a.type === sousOnglet && !isHidden(a));

  const cfg = ONGLETS.find(o => o.id === sousOnglet)!;

  const goToProfile = (a: Abonnement) => {
    if (a.type === 'boutiques')           navigate(`/boutique/${a.id}`);
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
          {sousOnglet === 'masques'
            ? 'Aucun élément masqué.'
            : <>Vous ne suivez aucun{
                sousOnglet === 'boutiques' ? 'e boutique'
                : sousOnglet === 'livreurs' ? ' livreur'
                : ' correspondant'
              }.</>
          }
          {cfg.route && (
            <>
              <br />
              <button
                onClick={() => navigate(cfg.route!)}
                style={{
                  marginTop:14, background:'var(--blue)', color:'#fff', border:'none',
                  borderRadius:'var(--pill)', padding:'8px 20px',
                  fontSize:12, fontWeight:700, cursor:'pointer',
                }}>
                Découvrir les {cfg.label.toLowerCase()}
              </button>
            </>
          )}
        </div>
      )}

      {/* Grille de cartes */}
      {!loading && liste.length > 0 && (
        <div className={styles.subGrid}>
          {liste.map(a => (
            <div key={a.id} className={styles.subCard}
              onClick={() => goToProfile(a)}
              style={{ cursor:'pointer', position:'relative' }}>

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

              <div onClick={ev => ev.stopPropagation()}>
                <FollowButton
                  actorType={toActorType(a.type)}
                  id={a.id}
                  name={a.nom}
                  isSuivi={true}
                  hidden={isHidden(a)}
                  onToast={onToast}
                  onRequireAuth={openAuthModal}
                  onChange={next => {
                    if (next.removed) { setRemovedIds(prev => new Set(prev).add(a.id)); return; }
                    if (next.hidden !== undefined) {
                      setHiddenOverride(prev => ({ ...prev, [a.id]: next.hidden! }));
                    }
                    if (!next.isSuivi) setRemovedIds(prev => new Set(prev).add(a.id));
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {authModal}
    </div>
  );
}
