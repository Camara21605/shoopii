import { useNavigate }  from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles           from './Cards.module.css';
import { useAuthGate }  from '../../../shared/hooks/useAuthGate';
import FollowButton     from '../../../shared/components/FollowButton';
import ActorLocation from '../../../shared/location/components/ActorLocation';
import ActorDistance from '../../../shared/location/components/ActorDistance';

export interface LivreurCardData {
  id: string; fullName: string; profilePicture: string | null;
  zone: string; vehicule: string; totalLivraisons: number;
  /** Ville / quartier réels — voir actorLocation() côté API */
  ville?: string | null; commune?: string | null; quartier?: string | null; localisation?: string | null;
  averageRating: number; disponible: boolean; isSuivi: boolean;
  emoji?: string;
}

interface Props {
  l:          LivreurCardData;
  onToast:    (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  /** Appelé quand l'utilisateur choisit "Supprimer" dans le menu ⋮ —
   *  le parent doit retirer ce livreur de sa liste locale. */
  onRemoved?: (id: string) => void;
}

/* Card minimale — même principe que CardEntreprise/CardCorrespondant :
 * avatar + nom + suivre. Les stats (livraisons, note) ne s'affichent
 * que sur la page de profil ; le moyen de transport, la zone et le
 * statut (disponible/en course) restent visibles ici. */
export default function CardLivreur({ l, onToast, onRemoved }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const id       = l?.id ?? '';
  const name     = l?.fullName ?? '';
  const photo    = l?.profilePicture ?? null;
  const vehicule = l?.vehicule ?? '';
  const dispo    = l?.disponible ?? false;

  const { openAuthModal, authModal } = useAuthGate();

  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={styles.wkCard} onClick={() => id ? navigate(`/livreurs/${id}`) : onToast(`🛵 ${name}`, 'i')}>

      {/* ── Badge de rôle ── */}
      <span className={`${styles.roleBadge} ${styles.roleBadgeLivreur}`}>
        <i className="fas fa-motorcycle" /> {t('sharedCards.livreur.roleLabel')}
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
          fontSize: l?.emoji ? 26 : 20,
        }}>
          {l?.emoji ?? initials}
        </div>
        <div className={`${styles.wkDot} ${dispo ? styles.wkDotOn : styles.wkDotOff}`}
          title={dispo ? t('sharedCards.livreur.disponible') : t('sharedCards.livreur.enCourse')} />
      </div>

      {/* Nom */}
      <div className={styles.wkNm}>{name || '—'}</div>

      {/* Zone */}
      <div className={styles.wkLoc}>
        <i className="fas fa-map-pin" /> <ActorLocation value={l} fallback="—" /><ActorDistance role="delivery" id={l?.id} />
      </div>

      {/* Moyen de transport */}
      {vehicule && <div className={styles.wkTag}>{vehicule}</div>}

      {/* Statut disponible / en course */}
      <span className={dispo ? styles.dispoBadge : styles.occupeBadge}>
        {dispo ? <><i className="fas fa-circle" /> {t('sharedCards.livreur.disponible')}</> : <><i className="fas fa-gear" /> {t('sharedCards.livreur.enCourse')}</>}
      </span>

      {/* Bouton */}
      <div className={styles.wkBtnWrap} onClick={ev => ev.stopPropagation()}>
        <FollowButton
          actorType="livreur"
          id={id}
          name={name}
          isSuivi={l?.isSuivi ?? false}
          onToast={onToast}
          onRequireAuth={openAuthModal}
          onChange={next => { if (next.removed) onRemoved?.(id); }}
        />
      </div>

      {authModal}
    </div>
  );
}
