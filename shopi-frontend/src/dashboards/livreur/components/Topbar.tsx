// src/dashboards/livreur/components/Topbar.tsx
import { useNavigate } from 'react-router-dom';
import type { PageId } from '../data/livreurData';
import styles from '../styles/Topbar.module.css';
import NotificationCenter from '../../../shared/notifications/NotificationCenter';
import { useGlobalCall } from '../../../shared/context/GlobalCallContext';
import WalletQuickBar from '../../../shared/components/portefeuille/WalletQuickBar';

interface Props {
  title:        string;
  subtitle:     string;
  isOnline:     boolean;
  avatarUrl?:   string | null;
  livreurName?: string;
  encoursCount?: number;
  menuOpen:     boolean;
  onMenuToggle: () => void;
  onMenuClose:  () => void;
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

/* Navigation complète du drawer mobile — liste plate (pas de sections),
 * même contenu que Sidebar.tsx mais présentation simplifiée, à
 * l'identique du drawer mobile du dashboard entreprise. */
type DrawerItem = { id: PageId; icon: string; label: string; badge?: number };

function buildDrawerNav(encoursCount: number): DrawerItem[] {
  return [
    { id: 'overview',   icon: 'fa-chart-pie',        label: "Vue d'ensemble" },
    { id: 'missions',   icon: 'fa-motorcycle',       label: 'Missions disponibles' },
    { id: 'encours',    icon: 'fa-route',            label: 'En cours', ...(encoursCount > 0 ? { badge: encoursCount } : {}) },
    { id: 'historique', icon: 'fa-clock-rotate-left',label: 'Historique' },
    { id: 'boutiques',  icon: 'fa-store',            label: 'Mes boutiques' },
    { id: 'revenus',    icon: 'fa-coins',            label: 'Mes revenus' },
    { id: 'zone',       icon: 'fa-map-location-dot', label: 'Ma zone de livraison' },
    { id: 'evaluation', icon: 'fa-user-plus',        label: 'Ajouter un correspondant' },
    { id: 'parametres', icon: 'fa-gear',             label: 'Paramètres' },
  ];
}

export default function Topbar({
  title, subtitle, isOnline,
  avatarUrl, livreurName, encoursCount = 0,
  menuOpen, onMenuToggle, onMenuClose,
  onNavigate,
}: Props) {
  const initials = livreurName ? getInitials(livreurName) : '🛵';
  const { msgUnread } = useGlobalCall();
  const navigate = useNavigate();
  const displayName = livreurName || 'Mon profil';

  function go(page: PageId) {
    onNavigate(page);
    onMenuClose();
  }

  return (
    <>
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

    {/* ════════ DRAWER MOBILE (menu complet) — même approche que le dashboard entreprise ════════ */}
    {menuOpen && (
      <div className={styles.tbDrawerOverlay} onClick={onMenuClose}>
        <div className={styles.tbDrawer} role="dialog" aria-modal="true" aria-label="Menu"
          onClick={e => e.stopPropagation()}>

          {/* En-tête livreur */}
          <div className={styles.tbDrawerHead}>
            <div className={styles.tbDrawerAva}>
              {avatarUrl ? <img src={avatarUrl} alt="" className={styles.tbDrawerAvaImg} /> : initials}
            </div>
            <div className={styles.tbDrawerInf}>
              <div className={styles.tbDrawerNm}>{displayName}</div>
              <div className={styles.tbDrawerSub}>
                <span className={`${styles.spDot} ${isOnline ? styles.spGreen : ''}`} />
                {isOnline ? 'En ligne · disponible' : 'Hors ligne · pause'}
              </div>
            </div>
            <button className={styles.tbDrawerX} onClick={onMenuClose} aria-label="Fermer le menu">
              <i className="fas fa-xmark" />
            </button>
          </div>

          {/* Solde du portefeuille Shopi */}
          <div style={{ padding: '0 20px 14px' }}>
            <WalletQuickBar compact mini onManage={() => go('wallet')} />
          </div>

          {/* Navigation complète */}
          <div className={styles.tbDrawerNav}>
            {buildDrawerNav(encoursCount).map(item => (
              <button key={item.id}
                className={styles.tbDrawerIt}
                onClick={() => go(item.id)}>
                <i className={`fas ${item.icon}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={styles.tbDrawerBadge}>{item.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Actions bas du drawer */}
          <div className={styles.tbDrawerFoot}>
            <button className={styles.tbDrawerHome} onClick={() => { onMenuClose(); navigate('/aide'); }}>
              <i className="fas fa-circle-question" /> Centre d'aide
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
