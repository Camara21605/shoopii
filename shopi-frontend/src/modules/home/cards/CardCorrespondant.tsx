import { useNavigate }         from 'react-router-dom';
import { useTranslation }      from 'react-i18next';
import styles                  from './Cards.module.css';
import { useAuthGate }         from '../../../shared/hooks/useAuthGate';
import FollowButton            from '../../../shared/components/FollowButton';

export interface CorrespondantCardData {
  id: string; fullName: string; profilePicture: string | null;
  region: string; typeCorrespondant: 'regional' | 'zonal' | 'national';
  bio: string | null; totalMissions: number; averageRating: number;
  online: boolean; isSuivi: boolean;
}

interface Props {
  c:         CorrespondantCardData | any;
  onToast:   (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  /** Appelé quand l'utilisateur choisit "Supprimer" dans le menu ⋮ —
   *  le parent doit retirer ce correspondant de sa liste locale. */
  onRemoved?: (id: string) => void;
}

/* Card minimale — même principe que CardEntreprise : avatar + nom +
 * région + suivre. Les infos détaillées (missions, sous-type, bio…)
 * ne s'affichent que sur la page de profil, ouverte au clic sur la card. */
export default function CardCorrespondant({ c, onToast, onRemoved }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const id     = c?.id ?? '';
  const name   = c?.fullName ?? c?.nom ?? '';
  const photo  = c?.profilePicture ?? null;
  const region = c?.region ?? '';
  const online = c?.online ?? false;

  const { openAuthModal, authModal } = useAuthGate();

  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={styles.wkCard} onClick={() => id ? navigate(`/profil/correspondant/${id}`) : onToast(`📍 ${name}`, 'i')}>

      {/* ── Badge de rôle ── */}
      <span className={`${styles.roleBadge} ${styles.roleBadgeCorrespondant}`}>
        <i className="fas fa-handshake" /> {t('sharedCards.correspondant.roleLabel')}
      </span>

      {/* Avatar */}
      <div className={styles.wkAw}>
        {photo && (
          <img
            src={photo} alt={name}
            className={styles.wkAva}
            style={{ objectFit: 'cover', borderRadius: '50%' }}
            onError={e => {
              e.currentTarget.style.display = 'none';
              const n = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (n) n.style.display = 'flex';
            }}
          />
        )}
        <div className={styles.wkAva} style={{
          display: photo ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: c?.emoji ? 28 : 20,
        }}>
          {c?.emoji ?? initials}
        </div>
        <div className={`${styles.wkDot} ${online ? styles.wkDotOn : styles.wkDotOff}`}
          title={online ? t('sharedCards.correspondant.enLigne') : t('sharedCards.correspondant.horsLigne')} />
      </div>

      {/* Nom */}
      <div className={styles.wkNm}>{name || '—'}</div>

      {/* Région */}
      <div className={styles.wkLoc}>
        <i className="fas fa-map-pin" /> {region || '—'}
      </div>

      {/* Bouton */}
      <div className={styles.wkBtnWrap} onClick={ev => ev.stopPropagation()}>
        <FollowButton
          actorType="correspondant"
          id={id}
          name={name}
          isSuivi={c?.isSuivi ?? false}
          onToast={onToast}
          onRequireAuth={openAuthModal}
          onChange={next => { if (next.removed) onRemoved?.(id); }}
        />
      </div>

      {authModal}
    </div>
  );
}
