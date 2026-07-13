// src/dashboards/livreur/components/Topbar.tsx
import { useNavigate } from 'react-router-dom';
import type { PageId } from '../data/livreurData';
import styles from '../styles/Topbar.module.css';
import NotificationCenter from '../../../shared/notifications/NotificationCenter';
import { useGlobalCall } from '../../../shared/context/GlobalCallContext';

interface Props {
  title:        string;
  subtitle:     string;
  isOnline:     boolean;
  avatarUrl?:   string | null;
  livreurName?: string;
  onMenuToggle: () => void;
  onNavigate:   (p: PageId) => void;
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
  onMenuToggle, onNavigate,
}: Props) {
  const initials = livreurName ? getInitials(livreurName) : '🛵';
  const { msgUnread } = useGlobalCall();
  const navigate = useNavigate();

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
          {isOnline ? 'En ligne · Disponible' : 'Hors ligne · Pause'}
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
        <button className={`${styles.tbIc} ${styles.tbIcPin}`} onClick={() => onNavigate('messagerie')} title="Messagerie">
          <i className="fas fa-comment-dots" />
          {msgUnread > 0 && (
            <span className={styles.tbBadge}>{msgUnread > 99 ? '99+' : msgUnread}</span>
          )}
        </button>
        <NotificationCenter />
        <div className={styles.tbSep} />

        {/* Centre d'aide — accès direct depuis le dashboard livreur */}
        <button
          className={`${styles.tbIc} ${styles.hideXs}`}
          onClick={() => navigate('/aide')}
          title="Centre d'aide"
          aria-label="Centre d'aide"
        >
          <i className="fas fa-circle-question" />
        </button>
        <div className={`${styles.tbSep} ${styles.hideXs}`} />

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
