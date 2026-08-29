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

export default function CardCorrespondant({ c, onToast, onRemoved }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const TYPE_LABEL: Record<string, string> = {
    regional: t('sharedCards.correspondant.typeLabel.regional'),
    zonal: t('sharedCards.correspondant.typeLabel.zonal'),
    national: t('sharedCards.correspondant.typeLabel.national'),
  };

  const id       = c?.id ?? '';
  const name     = c?.fullName ?? c?.nom ?? '';
  const photo    = c?.profilePicture ?? null;
  const region   = c?.region ?? '';
  const type     = c?.typeCorrespondant ?? c?.type ?? 'regional';
  const bio      = c?.bio ?? c?.desc ?? null;
  const missions = Number(c?.totalMissions ?? c?.missions ?? 0);
  const rating   = Number(c?.averageRating ?? c?.note ?? 0);
  const online   = c?.online ?? false;

  const { openAuthModal, authModal } = useAuthGate();

  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';

  return (
    <div className={styles.crCard} style={{ position: 'relative' }}>

      {/* ── Bannière ── */}
      <div className={styles.crBanner}>
        {online && (
          <span style={{
            fontSize: 9.5, fontWeight: 800, color: '#34D399',
            background: 'rgba(52,211,153,.15)', border: '1px solid rgba(52,211,153,.3)',
            borderRadius: 999, padding: '2px 9px',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 5px #34D399' }} />
            {t('sharedCards.correspondant.enLigne')}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className={styles.crBody}>

        {/* Avatar */}
        <div className={styles.crAw}>
          {photo && (
            <img
              src={photo} alt={name}
              className={styles.crAva}
              style={{ objectFit: 'cover', borderRadius: '50%' }}
              onError={e => {
                e.currentTarget.style.display = 'none';
                const n = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (n) n.style.display = 'flex';
              }}
            />
          )}
          <div className={styles.crAva} style={{
            display: photo ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#1C1C1F,#2D2D30)',
            color: '#fff', fontFamily: 'var(--fd)', fontWeight: 800,
            fontSize: c?.emoji ? 28 : 20,
          }}>
            {c?.emoji ?? initials}
          </div>
          <div className={`${styles.crOl} ${online ? styles.crOlOn : styles.crOlOff}`}
            title={online ? t('sharedCards.correspondant.enLigne') : t('sharedCards.correspondant.horsLigne')} />
        </div>

        {/* Nom */}
        <div className={styles.crNm}>{name || '—'}</div>

        {/* Région */}
        <div className={styles.crRegion}>
          <i className="fas fa-map-pin" /> {region || '—'}
        </div>

        {/* Badge type */}
        <span className={styles.crType}>{TYPE_LABEL[type] ?? type}</span>

        {/* Bio */}
        <div className={styles.crDesc}>{bio || t('sharedCards.correspondant.aucuneDescription')}</div>

        {/* Stats */}
        <div className={styles.crStatsRow}>
          <div className={styles.crStat}>
            <span className={styles.crStatVal}>{missions.toLocaleString('fr-FR')}</span>
            <span className={styles.crStatLbl}>{t('sharedCards.correspondant.missions')}</span>
          </div>
          <div className={styles.crStat}>
            <span className={styles.crStatVal}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
            <span className={styles.crStatLbl}>{t('sharedCards.correspondant.note')}</span>
          </div>
        </div>

        {/* Boutons */}
        <div className={styles.crBtns}>
          <button
            className={styles.crV}
            onClick={() => id ? navigate(`/profil/correspondant/${id}`) : onToast(`📍 ${name}`, 'i')}
            title={t('sharedCards.correspondant.voirProfil')}
            aria-label={t('sharedCards.correspondant.voirProfil')}
          >
            <i className="fas fa-user" />
          </button>
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
      </div>

      {authModal}
    </div>
  );
}
