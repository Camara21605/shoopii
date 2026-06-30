// src/dashboards/livreur/components/Topbar.tsx
import type { PageId } from '../data/livreurData';
import styles from '../styles/Topbar.module.css';

interface Props {
  title:        string;
  subtitle:     string;
  isOnline:     boolean;
  avatarUrl?:   string | null;
  livreurName?: string;
  onMenuToggle: () => void;
  onNotif:      () => void;
  onNavigate:   (p: PageId) => void;
  onPop:        (msg: string, type?: string) => void;
}

/** Calcule les initiales depuis un nom complet */
function getInitials(name: string): string {
  return name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

export default function Topbar({
  title, subtitle, isOnline,
  avatarUrl, livreurName,
  onMenuToggle, onNotif, onNavigate, onPop,
}: Props) {
  const initials = livreurName ? getInitials(livreurName) : '🛵';

  return (
    <header className={styles.topbar}>
      <button className={styles.hamburger} onClick={onMenuToggle} aria-label="Menu">
        <i className="fas fa-bars" />
      </button>

      <div className={styles.tbInfo}>
        <div className={styles.tbTtl}>{title}</div>
        <div className={styles.tbSub}>{subtitle}</div>
      </div>

      <div className={styles.tbActs}>
        <div className={`${styles.statusPill} ${isOnline ? styles.statusOn : styles.statusOff}`}>
          <span className={`${styles.spDot} ${isOnline ? styles.spGreen : ''}`} />
          {isOnline ? 'En ligne · Kaloum' : 'Hors ligne · Pause'}
        </div>
        <div className={`${styles.tbSep} ${styles.hideMobile}`} />
        <div className={styles.tbReseauGroup}>
          <button className={styles.tbIc} onClick={() => onNavigate('reseauCorrespondants')} title="Suivre des correspondants">
            <i className="fas fa-warehouse" />
          </button>
          <button className={styles.tbIc} onClick={() => onNavigate('reseauLivreurs')} title="Suivre des livreurs">
            <i className="fas fa-motorcycle" />
          </button>
        </div>
        <div className={styles.tbSep} />
        <button className={styles.tbIc} onClick={() => onPop('💬 3 messages clients', 'i')}>
          <i className="fas fa-comment-dots" /><span className={styles.tbDot} />
        </button>
        <button className={styles.tbIc} onClick={onNotif}>
          <i className="fas fa-bell" /><span className={styles.tbDot} />
        </button>
        <div className={styles.tbSep} />

        {/* Avatar : photo réelle ou initiales */}
        <div
          className={styles.tbAva}
          onClick={() => onNavigate('profil' as PageId)}
          title={livreurName || 'Mon profil'}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt={livreurName || 'Profil'} />
            : initials
          }
        </div>
      </div>
    </header>
  );
}
