import { useState }     from 'react';
import { useNavigate }  from 'react-router-dom';
import styles           from './Cards.module.css';
import { tokenStorage } from '../../../shared/services/apiFetch';
import { useFollowToggle } from '../../../shared/hooks/useFollowToggle';

export interface LivreurCardData {
  id: string; fullName: string; profilePicture: string | null;
  zone: string; vehicule: string; totalLivraisons: number;
  averageRating: number; disponible: boolean; isSuivi: boolean;
  emoji?: string;
}

interface Props {
  l:        LivreurCardData;
  onToast:  (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onFollow: (id: string, newState: boolean) => Promise<void>;
}

export default function CardLivreur({ l, onToast, onFollow }: Props) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  const id         = l?.id ?? '';
  const name       = l?.fullName ?? '';
  const photo      = l?.profilePicture ?? null;
  const zone       = l?.zone ?? '';
  const vehicule   = l?.vehicule ?? '';
  const livraisons = Number(l?.totalLivraisons ?? 0);
  const rating     = Number(l?.averageRating ?? 0);
  const dispo      = l?.disponible ?? false;

  const suivi = l?.isSuivi ?? false;
  const { loading, toggle } = useFollowToggle({ id, name, isSuivi: suivi, onFollow, onToast });

  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const isLogged = !!tokenStorage.get();

  return (
    <div className={styles.dlCard}>

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
            background: 'linear-gradient(135deg,var(--navy),var(--blue))',
            color: '#fff', fontFamily: 'var(--fd)', fontWeight: 800,
            fontSize: l?.emoji ? 26 : 20,
          }}>
            {l?.emoji ?? initials}
          </div>
          <div className={`${styles.dlDot} ${dispo ? styles.dlDotOn : styles.dlDotOff}`}
            title={dispo ? 'Disponible' : 'En course'} />
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
            <span className={styles.dlStatLbl}>Livraisons</span>
          </div>
          <div className={styles.dlStat}>
            <span className={styles.dlStatVal}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
            <span className={styles.dlStatLbl}>Note ⭐</span>
          </div>
        </div>

        {/* Badge disponibilité */}
        <span className={dispo ? styles.dispoBadge : styles.occupeBadge}>
          {dispo ? <><i className="fas fa-circle" /> Disponible</> : <><i className="fas fa-gear" /> En course</>}
        </span>

        {/* Boutons */}
        <div className={styles.dlBtns}>
          <button
            className={styles.dlV}
            onClick={() => id ? navigate(`/livreurs/${id}`) : onToast(`🛵 ${name}`, 'i')}
          >
            <i className="fas fa-user" /> Voir profil
          </button>
          <button
            className={`${styles.dlF} ${suivi ? styles.dlFOn : ''}`}
            onClick={toggle}
            disabled={loading}
            onMouseEnter={() => suivi && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={!isLogged ? 'Connectez-vous pour suivre' : undefined}
          >
            {loading
              ? <i className="fas fa-spinner fa-spin" />
              : !isLogged
                ? <i className="fas fa-right-to-bracket" />
                : suivi && hovered
                  ? <i className="fas fa-user-minus" />
                  : suivi
                    ? <i className="fas fa-user-check" />
                    : <i className="fas fa-plus" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
