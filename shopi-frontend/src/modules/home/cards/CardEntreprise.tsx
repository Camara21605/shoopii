import { useNavigate } from 'react-router-dom';
import styles from './Cards.module.css';
import type { BoutiqueCardData } from '../data/types';
import { useBoutiqueFollow } from '../hooks/useBoutiqueFollow';

const DOMAIN_COLORS: Record<string, { bg: string; bg2: string; color: string }> = {
  'Électronique': { bg:'rgba(37,99,235,.18)',   bg2:'rgba(37,99,235,.08)',  color:'#1D4ED8' },
  'Mode':         { bg:'rgba(190,24,93,.18)',    bg2:'rgba(190,24,93,.08)',  color:'#BE185D' },
  'Restaurant':   { bg:'rgba(217,119,6,.18)',    bg2:'rgba(217,119,6,.08)',  color:'#B45309' },
  'Pharmacie':    { bg:'rgba(5,150,105,.18)',    bg2:'rgba(5,150,105,.08)',  color:'#047857' },
  'High-Tech':    { bg:'rgba(109,40,217,.18)',   bg2:'rgba(109,40,217,.08)', color:'#6D28D9' },
  'Alimentaire':  { bg:'rgba(14,116,144,.18)',   bg2:'rgba(14,116,144,.08)', color:'#0E7490' },
  'Sport':        { bg:'rgba(220,38,38,.18)',    bg2:'rgba(220,38,38,.08)',  color:'#DC2626' },
};

function domainStyle(dom: string | null) {
  return DOMAIN_COLORS[dom ?? ''] ?? { bg:'rgba(26,79,196,.18)', bg2:'rgba(26,79,196,.08)', color:'#1D4ED8' };
}

function initials(nom: string): string {
  return nom.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

interface Props {
  e:       BoutiqueCardData;
  onToast: (m: string) => void;
}

export default function CardEntreprise({ e, onToast }: Props) {
  const navigate = useNavigate();
  const ds = domainStyle(e.domaine);
  const {
    suivi, pending, isLoggedIn, canFollow,
    requestFollowLogin, toggleFollow,
  } = useBoutiqueFollow({
    boutiqueId: e.id,
    companyName: e.companyName,
    initialIsSuivi: e.isSuivi,
    onToast,
  });

  const rating = e.averageRating > 0 ? e.averageRating.toFixed(1) : '—';
  const orders = e.totalOrders  > 0 ? `${e.totalOrders}+` : '0';
  const avis   = e.totalRatings > 0 ? e.totalRatings.toString() : '—';

  return (
    <div className={styles.coCard}>

      {/* ── Bannière colorée ── */}
      <div
        className={styles.coBanner}
        style={{ background: `linear-gradient(135deg, ${ds.bg}, ${ds.bg2})` }}
      />

      {/* ── Badge vérifié ── */}
      {e.verified && (
        <div className={styles.coVerif}>
          <i className="fas fa-circle-check" /> Vérifié
        </div>
      )}

      {/* ── Body ── */}
      <div className={styles.coBody}>

        {/* Logo débordant */}
        <div
          className={`${styles.coLogo} ${e.logo ? styles.coLogoImage : ''}`}
          style={{ background: e.logo ? undefined : ds.bg }}
        >
          {e.logo
            ? <img className={styles.coLogoImg} src={e.logo} alt={e.companyName} />
            : <span className={styles.coInitials} style={{ color: ds.color }}>
                {initials(e.companyName)}
              </span>
          }
        </div>

        {/* Titre + domaine */}
        <div className={styles.coHead}>
          <div className={styles.coName}>{e.companyName}</div>
          {e.domaine && (
            <span className={styles.coDom} style={{ color: ds.color, background: ds.bg }}>
              {e.domaine}
            </span>
          )}
        </div>

        {/* Ville */}
        <div className={styles.coType}>
          <i className={`fas fa-location-dot ${styles.coTypeIcon}`} />
          {e.ville ?? 'Conakry'}
        </div>

        {/* Description */}
        {e.description && (
          <div className={styles.coDesc}>{e.description}</div>
        )}

        {/* Stats */}
        <div className={styles.coStats}>
          <div className={styles.coStat}>
            <span className={styles.coStatVal}>{orders}</span>
            <span className={styles.coStatLbl}>Commandes</span>
          </div>
          <div className={styles.coStat}>
            <span className={styles.coStatVal}>{rating}</span>
            <span className={styles.coStatLbl}>Note ⭐</span>
          </div>
          <div className={styles.coStat}>
            <span className={styles.coStatVal}>{avis}</span>
            <span className={styles.coStatLbl}>Avis</span>
          </div>
        </div>

        {/* Boutons */}
        <div className={`${styles.coBtns} ${!isLoggedIn || canFollow ? '' : styles.coBtns1}`}>
          <button className={styles.coV} onClick={() => navigate(`/boutique/${e.id}`)}>
            <i className="fas fa-store" /> Voir boutique
          </button>

          {!isLoggedIn && (
            <button className={styles.coF} onClick={requestFollowLogin}>
              <i className="fas fa-plus" /> S'abonner
            </button>
          )}

          {canFollow && (
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
        </div>
      </div>
    </div>
  );
}
