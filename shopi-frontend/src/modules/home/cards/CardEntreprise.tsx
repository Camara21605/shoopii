import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Cards.module.css';
import type { BoutiqueCardData } from '../data/types';
import { useAuthGate } from '../../../shared/hooks/useAuthGate';
import FollowButton from '../../../shared/components/FollowButton';
import { locationLabel } from '../../../shared/location/utils/locationLabel';
import ActorLocation from '../../../shared/location/components/ActorLocation';
import ActorDistance from '../../../shared/location/components/ActorDistance';

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
  e:          BoutiqueCardData;
  onToast:    (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
  /** Appelé quand l'utilisateur choisit "Supprimer" dans le menu ⋮ —
   *  le parent doit retirer cette boutique de sa liste locale. */
  onRemoved?: (id: string) => void;
  /** true UNIQUEMENT sur la page "/boutiques" — bascule la carte en ligne
   *  de liste (sans bordure) sous 640px. Ailleurs (home, page type
   *  d'entreprise), la carte garde son apparence habituelle même en
   *  mobile — voir .coListMode dans Cards.module.css. */
  listMode?:  boolean;
}

export default function CardEntreprise({ e, onToast, onRemoved, listMode = false }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ds = domainStyle(e.domaine);
  const { openAuthModal, authModal } = useAuthGate();

  /* Domaine (façon @handle) puis, sur sa propre ligne, « Quartier, Ville » */
  const handle   = e.domaine ?? '';
  const location = locationLabel(e);

  return (
    <div
      className={`${styles.coCard} ${listMode ? styles.coListMode : ''}`}
      onClick={() => navigate(`/boutique/${e.id}`)}
      style={{ cursor: 'pointer' }}
    >

      {/* ── Avatar rond ── */}
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

      {/* Nom + sous-titre — regroupés pour la mise en page en ligne de
       * liste sous 640px (voir .coInfo dans Cards.module.css). */}
      <div className={styles.coInfo}>
        {/* ── Badge de rôle ── */}
        <span className={`${styles.roleBadge} ${styles.roleBadgeEntreprise}`}>
          <i className="fas fa-store" /> {t('sharedCards.entreprise.roleLabel')}
        </span>

        <div className={styles.coNameRow}>
          <span className={styles.coName}>{e.companyName}</span>
          {e.verified && (
            <i
              className={`fas fa-circle-check ${styles.coVerif}`}
              title={t('sharedCards.entreprise.verifie')}
            />
          )}
          {/* Badge produits/services — voir Company.businessModel côté backend */}
          <i
            className={`fas ${e.businessModel === 'services' ? 'fa-concierge-bell' : 'fa-box'} ${styles.coVerif}`}
            title={e.businessModel === 'services' ? t('sharedCards.entreprise.venteServices') : t('sharedCards.entreprise.venteProduits')}
          />
        </div>

        {/* Domaine (façon @handle) */}
        {handle && <div className={styles.coHandle}>{handle}</div>}
        {/* Quartier, Ville */}
        {location && (
          <div className={styles.coLoc} title={location}>
            <i className="fas fa-location-dot" aria-hidden="true" /> <ActorLocation value={e} /><ActorDistance role="vendor" id={e?.id} />
          </div>
        )}
      </div>

      {/* Bouton */}
      <div className={styles.coBtnWrap} onClick={ev => ev.stopPropagation()}>
        <FollowButton
          actorType="entreprise"
          id={e.id}
          name={e.companyName}
          isSuivi={e.isSuivi ?? false}
          onToast={onToast}
          onRequireAuth={openAuthModal}
          onChange={next => { if (next.removed) onRemoved?.(e.id); }}
        />
      </div>

      {authModal}
    </div>
  );
}
