import type { BoutiqueInfo } from '../data/boutiqueMockData';
import styles from '../styles/BoutiqueCover.module.css';

interface Props { boutique: BoutiqueInfo; }

/* Génère les initiales depuis le nom de la boutique */
function getInitials(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

export default function BoutiqueCover({ boutique }: Props) {
  const initials = getInitials(boutique.nom);
  const hasCover = !!boutique.coverImage;

  return (
    <div
      className={styles.cover}
      style={hasCover ? {
        backgroundImage:    `url(${boutique.coverImage})`,
        backgroundSize:     'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* ── Fond dégradé (uniquement sans coverImage) ── */}
      {!hasCover && <div className={styles.bg} />}
      {!hasCover && <div className={styles.grid} />}

      {/* ── Overlay sombre pour lisibilité du texte ── */}
      <div className={hasCover ? styles.overlayLight : styles.overlay} />

      {/* ── Infos boutique dans le cover ── */}
      <div className={styles.info}>
        <div>
          <div className={styles.infoNom}>{boutique.nom}</div>
          {boutique.slogan && (
            <div className={styles.infoSlogan}>« {boutique.slogan} »</div>
          )}
          {boutique.verified && (
            <div className={styles.infoVerif}>
              <i className="fas fa-shield-check" /> Boutique vérifiée Shopi
            </div>
          )}
        </div>
      </div>

      {/* ── Avatar ── */}
      <div className={styles.avatarWrap}>
        <div className={styles.avatar}>
          {boutique.logo
            ? <img
                src={boutique.logo}
                alt={boutique.nom}
                className={styles.avatarImg}
              />
            : <span className={styles.avatarInitials}>{initials}</span>
          }
        </div>

        {/* Badge statut boutique */}
        {boutique.verified && (
          <div className={styles.statusBadge}>
            <i className="fas fa-circle" style={{ fontSize: 5 }} /> Active
          </div>
        )}
      </div>
    </div>
  );
}
