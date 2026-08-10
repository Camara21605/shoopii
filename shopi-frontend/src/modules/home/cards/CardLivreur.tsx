import { useNavigate }  from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles           from './Cards.module.css';
import { useAuthGate }  from '../../../shared/hooks/useAuthGate';
import FollowButton     from '../../../shared/components/FollowButton';

export interface LivreurCardData {
  id: string; fullName: string; profilePicture: string | null;
  zone: string; vehicule: string; totalLivraisons: number;
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

export default function CardLivreur({ l, onToast, onRemoved }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const id         = l?.id ?? '';
  const name       = l?.fullName ?? '';
  const photo      = l?.profilePicture ?? null;
  const zone       = l?.zone ?? '';
  const vehicule   = l?.vehicule ?? '';
  const livraisons = Number(l?.totalLivraisons ?? 0);
  const rating     = Number(l?.averageRating ?? 0);
  const dispo      = l?.disponible ?? false;

  const { openAuthModal, authModal } = useAuthGate();

  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={styles.dlCard} style={{ position: 'relative' }}>

      {/* ── Bannière ── */}
      <div className={styles.dlBanner} />

      {/* ── Body ── */}
      <div className={styles.dlBody}>

        {/* Avatar */}
        <div className={styles.dlAw}>
          {photo && (
            <img
              src={photo} alt={name}
              className={styles.dlAva}
              style={{ objectFit: 'cover', borderRadius: '50%' }}
              onError={e => {
                e.currentTarget.style.display = 'none';
                const n = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (n) n.style.display = 'flex';
              }}
            />
          )}
          <div className={styles.dlAva} style={{
            display: photo ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,var(--navy),var(--g300))',
            color: '#fff', fontFamily: 'var(--fd)', fontWeight: 800,
            fontSize: l?.emoji ? 26 : 20,
          }}>
            {l?.emoji ?? initials}
          </div>
          <div className={`${styles.dlDot} ${dispo ? styles.dlDotOn : styles.dlDotOff}`}
            title={dispo ? t('sharedCards.livreur.disponible') : t('sharedCards.livreur.enCourse')} />
        </div>

        {/* Nom */}
        <div className={styles.dlNm}>{name || '—'}</div>

        {/* Zone */}
        <div className={styles.dlZn}>
          <i className="fas fa-map-pin" /> {zone || '—'}
        </div>

        {/* Véhicule */}
        {vehicule && <div className={styles.dlVehicule}>{vehicule}</div>}

        {/* Stats inline */}
        <div className={styles.dlStatsRow}>
          <div className={styles.dlStat}>
            <span className={styles.dlStatVal}>{livraisons.toLocaleString('fr-FR')}</span>
            <span className={styles.dlStatLbl}>{t('sharedCards.livreur.livraisons')}</span>
          </div>
          <div className={styles.dlStat}>
            <span className={styles.dlStatVal}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
            <span className={styles.dlStatLbl}>{t('sharedCards.livreur.note')}</span>
          </div>
        </div>

        {/* Badge disponibilité */}
        <span className={dispo ? styles.dispoBadge : styles.occupeBadge}>
          {dispo ? <><i className="fas fa-circle" /> {t('sharedCards.livreur.disponible')}</> : <><i className="fas fa-gear" /> {t('sharedCards.livreur.enCourse')}</>}
        </span>

        {/* Boutons */}
        <div className={styles.dlBtns}>
          <button
            className={styles.dlV}
            onClick={() => id ? navigate(`/livreurs/${id}`) : onToast(`🛵 ${name}`, 'i')}
          >
            <i className="fas fa-user" /> {t('sharedCards.livreur.voirProfil')}
          </button>
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
      </div>

      {authModal}
    </div>
  );
}
