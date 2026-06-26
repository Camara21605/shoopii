/* ================================================================
 * FICHIER : src/modules/home/components/cards/CardLivreur.tsx
 *
 * RÔLE : Carte livreur compacte — utilisée sur la HOME (RandomBloc),
 *        dans un HScrollSection (défilement horizontal).
 *
 * ✅ REFACTOR (alignement avec Grid / List) :
 *   - Composant CONTRÔLÉ : suivi = l.isSuivi (plus d'état local).
 *   - Logique follow déléguée au hook partagé useFollowToggle.
 *   - N'appelle PLUS l'API lui-même → le parent LivreursBloc le fait
 *     (évite tout risque de double POST).
 *   - Route harmonisée : /livreurs/:id  (au lieu de /profil/livreur/:id)
 * ================================================================ */

import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import styles               from './Cards.module.css';
import { tokenStorage }     from '../../../shared/services/apiFetch';
import { useFollowToggle }  from '../../../shared/hooks/useFollowToggle';

export interface LivreurCardData {
  id: string; fullName: string; profilePicture: string | null;
  zone: string; vehicule: string; totalLivraisons: number;
  averageRating: number; disponible: boolean; isSuivi: boolean;
  emoji?: string;
}

interface Props {
  l:        LivreurCardData;
  onToast:  (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
  onFollow: (id: string, newState: boolean) => Promise<void>;   // ✅ requis désormais
}

export default function CardLivreur({ l, onToast, onFollow }: Props) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  /* Champs avec valeurs de repli */
  const id         = l?.id ?? '';
  const name       = l?.fullName ?? '';
  const photo      = l?.profilePicture ?? null;
  const zone       = l?.zone ?? '';
  const vehicule   = l?.vehicule ?? '';
  const livraisons = Number(l?.totalLivraisons ?? 0);
  const rating     = Number(l?.averageRating ?? 0);
  const dispo      = l?.disponible ?? false;

  /* ✅ État contrôlé par le parent + logique commune */
  const suivi = l?.isSuivi ?? false;
  const { loading, toggle } = useFollowToggle({
    id, name, isSuivi: suivi, onFollow, onToast,
  });

  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const noteArrondie = Math.min(5, Math.max(0, Math.round(rating)));
  const etoiles      = '★'.repeat(noteArrondie) + '☆'.repeat(5 - noteArrondie);
  const isLogged     = !!tokenStorage.get();

  const btnStyle: React.CSSProperties = suivi ? {
    background: hovered
      ? 'linear-gradient(135deg,#DC2626,#B91C1C)'
      : 'linear-gradient(135deg,#059669,#047857)',
    color: '#fff',
    borderColor: hovered ? '#DC2626' : '#059669',
    transition: 'all .2s',
  } : {};

  return (
    <div className={styles.dlCard}>
      <div className={styles.dlAw}>
        {photo && (
          <img src={photo} alt={name} className={styles.dlAva}
            style={{ objectFit: 'cover', borderRadius: '50%' }}
            onError={e => {
              e.currentTarget.style.display = 'none';
              const n = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (n) n.style.display = 'flex';
            }}
          />
        )}
        <div className={styles.dlAva} style={{
          display: photo ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg,var(--emerald,#059669),var(--navy-2,#112648))',
          color: '#fff', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: l?.emoji ? 28 : 18,
        }}>{l?.emoji ?? initials}</div>
        <div className={`${styles.dlDot} ${dispo ? styles.dlDotOn : styles.dlDotOff}`}
          title={dispo ? 'Disponible' : 'En course'} />
      </div>

      <div className={styles.dlNm}>{name || '—'}</div>
      <div className={styles.dlZn}><i className="fas fa-map-pin" /> {zone || '—'}</div>
      {vehicule && <div className={styles.dlVehicule}>{vehicule}</div>}
      <div className={styles.dlStats}>
        <span><i className="fas fa-box" /> {livraisons.toLocaleString('fr-FR')} livraison{livraisons > 1 ? 's' : ''}</span>
        <span><span className={styles.stars}>{etoiles}</span> {rating.toFixed(1)}</span>
      </div>
      <span className={dispo ? styles.dispoBadge : styles.occupeBadge}>
        {dispo ? '● Disponible' : '⚙ En course'}
      </span>

      <div className={styles.dlBtns}>
        <button className={styles.dlV}
          onClick={() => id ? navigate(`/livreurs/${id}`) : onToast(`🛵 ${name}`, 'i')}>
          <i className="fas fa-user" /> Voir profil
        </button>
        <button className={styles.dlF} onClick={toggle} disabled={loading}
          style={btnStyle}
          onMouseEnter={() => suivi && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={!isLogged ? 'Connectez-vous pour suivre' : undefined}>
          {loading
            ? <i className="fas fa-spinner fa-spin" />
            : !isLogged
              ? <><i className="fas fa-right-to-bracket" /> Connexion</>
              : suivi && hovered
                ? <><i className="fas fa-user-minus" /> Se désabonner</>
                : suivi
                  ? <><i className="fas fa-user-check" /> Abonné(e)</>
                  : <><i className="fas fa-plus" /> Suivre</>
          }
        </button>
      </div>
    </div>
  );
}