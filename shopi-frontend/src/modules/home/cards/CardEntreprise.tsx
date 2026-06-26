import { useNavigate } from 'react-router-dom';
import styles from './Cards.module.css';
import type { BoutiqueCardData } from '../data/types';
import { useBoutiqueFollow } from '../hooks/useBoutiqueFollow';

/* Couleur de fond selon le domaine */
const DOMAIN_COLORS: Record<string, { bg: string; color: string }> = {
  'Électronique':  { bg:'rgba(37,99,235,.08)',  color:'#1D4ED8' },
  'Mode':          { bg:'rgba(190,24,93,.08)',   color:'#BE185D' },
  'Restaurant':    { bg:'rgba(217,119,6,.08)',   color:'#B45309' },
  'Pharmacie':     { bg:'rgba(5,150,105,.08)',   color:'#047857' },
  'High-Tech':     { bg:'rgba(109,40,217,.08)',  color:'#6D28D9' },
  'Alimentaire':   { bg:'rgba(14,116,144,.08)',  color:'#0E7490' },
  'Sport':         { bg:'rgba(220,38,38,.08)',   color:'#DC2626' },
};
function domainStyle(dom: string | null) {
  return DOMAIN_COLORS[dom ?? ''] ?? { bg:'rgba(37,99,235,.08)', color:'#1D4ED8' };
}

/* Initiales depuis le nom */
function initials(nom: string): string {
  return nom.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

interface Props {
  e:       BoutiqueCardData;
  onToast: (m: string) => void;
}

export default function CardEntreprise({ e, onToast }: Props) {
  const navigate  = useNavigate();
  const domStyle  = domainStyle(e.domaine);
  const {
    suivi,
    pending,
    isLoggedIn,
    canFollow,
    requestFollowLogin,
    toggleFollow,
  } = useBoutiqueFollow({
    boutiqueId: e.id,
    companyName: e.companyName,
    initialIsSuivi: e.isSuivi,
    onToast,
  });

  return (
    <div className={styles.coCard}>

      {/* Badge vérifié */}
      {e.verified && (
        <div className={styles.coVerif}>
          <i className="fas fa-circle-check" /> Vérifié
        </div>
      )}

      {/* Logo ou initiales */}
      <div
        className={`${styles.coLogo} ${e.logo ? styles.coLogoImage : ''}`}
        style={{ background: domStyle.bg }}
      >
        {e.logo
          ? <img className={styles.coLogoImg} src={e.logo} alt={e.companyName} />
          : <span className={styles.coInitials} style={{ color: domStyle.color }}>
              {initials(e.companyName)}
            </span>
        }
      </div>

      {/* Badge domaine */}
      {e.domaine && (
        <span className={styles.coDom} style={{ color:domStyle.color, background:domStyle.bg }}>
          {e.domaine}
        </span>
      )}

      {/* Ville */}
      <div className={styles.coType}>
        <i className={`fas fa-location-dot ${styles.coTypeIcon}`} />
        {e.ville ?? 'Conakry'}
      </div>

      {/* Nom */}
      <div className={styles.coName}>{e.companyName}</div>

      {/* Description */}
      {e.description && (
        <div className={styles.coDesc}>{e.description}</div>
      )}

      {/* Stats */}
      <div className={styles.coMeta}>
        <span><i className="fas fa-box" /> {e.totalOrders > 0 ? `${e.totalOrders}+` : '0'}</span>
        <span><i className={`fas fa-star ${styles.coStarIcon}`} /> {e.averageRating > 0 ? e.averageRating.toFixed(1) : '—'}</span>
        {e.totalRatings > 0 && <span className={styles.coRatings}>({e.totalRatings} avis)</span>}
      </div>

      {/* Boutons */}
      <div className={styles.coBtns}>
        <button className={styles.coV} onClick={() => navigate(`/boutique/${e.id}`)}>
          <i className="fas fa-store" /> Voir boutique
        </button>

        {/* S'abonner — visible uniquement pour les clients ou les non-connectés */}
        {!isLoggedIn && (
          /* Non connecté → inviter à se connecter */
          <button className={styles.coF} onClick={requestFollowLogin}>
            <i className="fas fa-plus" /> S'abonner
          </button>
        )}

        {canFollow && (
          /* Client connecté → toggle suivi réel */
          <button
            className={`${styles.coF} ${suivi ? styles.coFOn : ''}`}
            disabled={pending}
            onClick={toggleFollow}
          >
            {pending
              ? <><i className="fas fa-spinner fa-spin" /> …</>
              : suivi
                ? <><i className="fas fa-check" /> Abonné</>
                : <><i className="fas fa-plus" /> S'abonner</>
            }
          </button>
        )}

        {/* Autres rôles (entreprise, livreur, correspondant…) → rien */}
      </div>
    </div>
  );
}
