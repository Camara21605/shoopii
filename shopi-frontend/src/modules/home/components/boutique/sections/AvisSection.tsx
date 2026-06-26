import styles from '../styles/AvisSection.module.css';
import type { AvisItem, RatingDistribution, RatingStar } from '../data/types';

interface Props {
  note:          number;
  totalRatings:  number;
  avis?:         AvisItem[];
  distribution?: RatingDistribution;
  loading?:      boolean;
}

const RATING_STARS = [5, 4, 3, 2, 1] as const;
const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const AVATAR_TONES = [
  'avatarTone0',
  'avatarTone1',
  'avatarTone2',
  'avatarTone3',
  'avatarTone4',
] as const;

function Stars({ n, large = false }: { n: number; large?: boolean }) {
  const rounded = Math.round(n);

  return (
    <span
      className={`${styles.stars} ${large ? styles.starsLarge : ''}`}
      aria-label={`${n.toFixed(1)} sur 5`}
      title={`${n.toFixed(1)} / 5`}
    >
      {STAR_VALUES.map(v => (
        <span
          key={v}
          className={v <= rounded ? styles.starFilled : styles.starEmpty}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

function avatarTone(nom: string) {
  return AVATAR_TONES[(nom.charCodeAt(0) || 0) % AVATAR_TONES.length];
}

function buildDistribution(avis: AvisItem[]): RatingDistribution {
  return avis.reduce<RatingDistribution>((acc, item) => {
    const star = Math.min(5, Math.max(1, Math.round(item.note))) as RatingStar;
    acc[star] = (acc[star] ?? 0) + 1;
    return acc;
  }, {});
}

export default function AvisSection({
  note,
  totalRatings,
  avis = [],
  distribution,
  loading,
}: Props) {
  const hasRatings = totalRatings > 0 && note > 0;
  const hasAvis = avis.length > 0;
  const ratingDistribution = distribution ?? buildDistribution(avis);
  const distributionTotal = distribution
    ? RATING_STARS.reduce((sum, star) => sum + (ratingDistribution[star] ?? 0), 0)
    : avis.length;

  if (loading) return (
    <div className={styles.loading}>
      <i className={`fas fa-spinner fa-spin ${styles.loadingIcon}`} />
      Chargement des avis…
    </div>
  );

  return (
    <div className={styles.wrap}>

      {/* ══ Score global ══ */}
      <div className={styles.resume}>
        <div className={styles.noteGlobale}>
          <div className={styles.noteVal}>{hasRatings ? note.toFixed(1) : '—'}</div>
          {hasRatings
            ? <Stars n={note} large />
            : (
              <span
                className={`${styles.stars} ${styles.starsLarge} ${styles.starsMuted}`}
                aria-label="Aucune note"
              >
                ★★★★★
              </span>
            )
          }
          <div className={styles.noteTotal}>
            {hasRatings ? `${totalRatings} avis vérifiés` : 'Aucun avis pour le moment'}
          </div>
        </div>

        {/* Barres de répartition */}
        {hasRatings && (
          <div className={styles.barres}>
            {RATING_STARS.map(star => {
              const count = ratingDistribution[star] ?? 0;
              const pct = distributionTotal > 0 ? Math.round((count / distributionTotal) * 100) : 0;

              return (
                <div key={star} className={styles.barre}>
                  <span className={styles.barreNote}>{star}★</span>
                  <div className={styles.barreTrack}>
                    <div className={styles.barreFill} style={{ width:`${pct}%` }} />
                  </div>
                  <span className={styles.barrePct}>{pct > 0 ? `${pct}%` : '—'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ Liste des avis ══ */}
      <div className={styles.liste}>

        {/* Vide */}
        {!hasAvis && (
          <div className={styles.empty}>
            <i className={`fas fa-star ${styles.emptyIcon}`} />
            <div className={styles.emptyTitle}>
              {hasRatings ? 'Aucun avis détaillé disponible' : 'Aucun avis pour le moment'}
            </div>
            <div className={styles.emptyText}>
              {hasRatings
                ? 'La note globale existe déjà, mais les commentaires ne sont pas encore disponibles.'
                : 'Les avis apparaissent après que les clients ont validé la réception de leur commande.'}
            </div>
          </div>
        )}

        {/* Avis */}
        {avis.map(a => (
          <div key={a.id} className={styles.avisCard}>
            <div className={styles.avisTop}>

              {/* Avatar initiales */}
              <div className={`${styles.avisAv} ${styles[avatarTone(a.clientNom)]}`}>
                {a.clientInitiales}
              </div>

              <div className={styles.avisInfo}>
                <div className={styles.avisNom}>{a.clientNom}</div>
                <div className={styles.avisDate}>{a.date}</div>
              </div>

              <Stars n={a.note} />
            </div>

            {a.commentaire && (
              <p className={styles.avisTexte}>« {a.commentaire} »</p>
            )}

            {/* Badge achat vérifié */}
            <div className={styles.verifiedBadge}>
              <i className="fas fa-shield-check" /> Achat vérifié
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
