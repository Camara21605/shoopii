import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import styles                  from './Cards.module.css';
import { apiFetch }            from '../../../shared/services/apiFetch';

export interface CorrespondantCardData {
  id: string; fullName: string; profilePicture: string | null;
  region: string; typeCorrespondant: 'regional' | 'zonal' | 'national';
  bio: string | null; totalMissions: number; averageRating: number;
  online: boolean; isSuivi: boolean;
}

const TYPE_LABEL: Record<string, string> = { regional: 'Régional', zonal: 'Zonal', national: 'National' };
const TOKEN_KEY = 'shopi_access_token';

interface Props {
  c:         CorrespondantCardData | any;
  onToast:   (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onToggle?: (id: string, val: boolean) => void;
}

export default function CardCorrespondant({ c, onToast, onToggle }: Props) {
  const navigate = useNavigate();

  const id       = c?.id ?? '';
  const name     = c?.fullName ?? c?.nom ?? '';
  const photo    = c?.profilePicture ?? null;
  const region   = c?.region ?? '';
  const type     = c?.typeCorrespondant ?? c?.type ?? 'regional';
  const bio      = c?.bio ?? c?.desc ?? null;
  const missions = Number(c?.totalMissions ?? c?.missions ?? 0);
  const rating   = Number(c?.averageRating ?? c?.note ?? 0);
  const online   = c?.online ?? false;

  const [suivi,   setSuivi]   = useState<boolean>(c?.isSuivi ?? false);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => { setSuivi(c?.isSuivi ?? false); }, [c?.isSuivi]);

  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';

  async function handleToggle() {
    if (!localStorage.getItem(TOKEN_KEY)) { navigate('/login'); return; }
    if (!id) { onToast('❌ ID manquant', 'e'); return; }
    setLoading(true);
    const optimistic = !suivi;
    setSuivi(optimistic);
    try {
      const res = await apiFetch<{ isSuivi: boolean; message: string }>(
        `/suivis/correspondants/${id}`, { method: 'POST' }
      );
      const confirmed = res?.isSuivi ?? optimistic;
      setSuivi(confirmed);
      onToggle?.(id, confirmed);
      onToast(confirmed ? `✅ Abonné à ${name}` : `👋 Désabonné de ${name}`, confirmed ? 's' : 'i');
    } catch (e: any) {
      setSuivi(!optimistic);
      onToast(`❌ ${e?.message ?? 'Erreur réseau'}`, 'e');
    } finally { setLoading(false); setHovered(false); }
  }

  return (
    <div className={styles.crCard}>

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
            En ligne
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
            background: 'linear-gradient(135deg,#1A4FC4,#5B8EF4)',
            color: '#fff', fontFamily: 'var(--fd)', fontWeight: 800,
            fontSize: c?.emoji ? 28 : 20,
          }}>
            {c?.emoji ?? initials}
          </div>
          <div className={`${styles.crOl} ${online ? styles.crOlOn : styles.crOlOff}`}
            title={online ? 'En ligne' : 'Hors ligne'} />
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
        <div className={styles.crDesc}>{bio || 'Aucune description disponible.'}</div>

        {/* Stats */}
        <div className={styles.crStatsRow}>
          <div className={styles.crStat}>
            <span className={styles.crStatVal}>{missions.toLocaleString('fr-FR')}</span>
            <span className={styles.crStatLbl}>Missions</span>
          </div>
          <div className={styles.crStat}>
            <span className={styles.crStatVal}>{rating > 0 ? rating.toFixed(1) : '—'}</span>
            <span className={styles.crStatLbl}>Note ⭐</span>
          </div>
        </div>

        {/* Boutons */}
        <div className={styles.crBtns}>
          <button
            className={styles.crV}
            onClick={() => id ? navigate(`/profil/correspondant/${id}`) : onToast(`📍 ${name}`, 'i')}
          >
            <i className="fas fa-user" /> Voir profil
          </button>
          <button
            className={`${styles.crC} ${suivi ? styles.crCOn : ''}`}
            onClick={handleToggle}
            disabled={loading}
            onMouseEnter={() => suivi && setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={!localStorage.getItem(TOKEN_KEY) ? 'Connectez-vous pour suivre' : undefined}
          >
            {loading
              ? <i className="fas fa-spinner fa-spin" />
              : !localStorage.getItem(TOKEN_KEY)
                ? <><i className="fas fa-right-to-bracket" /> Connexion</>
                : suivi && hovered
                  ? <><i className="fas fa-user-minus" /> Désabonner</>
                  : suivi
                    ? <><i className="fas fa-user-check" /> Abonné(e)</>
                    : <><i className="fas fa-plus" /> Suivre</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
