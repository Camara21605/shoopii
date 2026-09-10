// src/dashboards/livreur/components/Sidebar.tsx
import { useTranslation } from 'react-i18next';
import type { PageId } from '../data/livreurData';
import { fmtGNF } from '../data/livreurData';
import WalletQuickBar from '../../../shared/components/portefeuille/WalletQuickBar';
import styles from '../styles/Sidebar.module.css';

interface Props {
  activePage:      PageId;
  isOpen:          boolean;
  isOnline:        boolean;
  todayEarn:       number;
  avatarUrl?:      string | null;
  livreurName?:    string;
  rating?:         number | null;
  totalDeliveries?: number | null;
  encoursCount?:   number;
  onNavigate:     (p: PageId) => void;
  onClose:        () => void;
  onToggleOnline: () => void;
  onGoHome:       () => void;
}

type NavItem = { id: PageId; icon: string; label: string; badge?: string | number; bCls?: string };

/** Calcule les initiales depuis un nom complet */
function getInitials(name: string): string {
  return name.trim().split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function buildNavPrincipal(t: (k: string) => string, encoursCount: number): NavItem[] {
  return [
    { id:'overview',   icon:'fa-chart-pie',          label: t('livreurLayout.sidebar.items.overview')                            },
    { id:'missions',   icon:'fa-motorcycle',          label: t('livreurLayout.sidebar.items.missions')                           },
    { id:'encours',    icon:'fa-route',               label: t('livreurLayout.sidebar.items.encours'), ...(encoursCount > 0 ? { badge: encoursCount, bCls:'g' } : {}) },
    { id:'historique', icon:'fa-clock-rotate-left',   label: t('livreurLayout.sidebar.items.historique')                         },
  ];
}
function buildNavReseau(t: (k: string) => string): NavItem[] {
  return [
    { id:'boutiques', icon:'fa-store', label: t('livreurLayout.sidebar.items.boutiques') },
  ];
}
function buildNavFinances(t: (k: string) => string): NavItem[] {
  return [
    { id:'revenus', icon:'fa-coins', label: t('livreurLayout.sidebar.items.revenus') },
  ];
}
function buildNavCompte(t: (k: string) => string): NavItem[] {
  return [
    { id:'zone',       icon:'fa-map-location-dot', label: t('livreurLayout.sidebar.items.zone')       },
    { id:'evaluation', icon:'fa-user-plus',        label: t('livreurLayout.sidebar.items.evaluation') },
    { id:'parametres', icon:'fa-gear',             label: t('livreurLayout.sidebar.items.parametres') },
  ];
}

export default function Sidebar({
  activePage, isOpen, isOnline, todayEarn,
  avatarUrl, livreurName, rating, totalDeliveries, encoursCount = 0,
  onNavigate, onToggleOnline, onGoHome,
}: Props) {
  const { t } = useTranslation();
  const navPrincipal = buildNavPrincipal(t, encoursCount);
  const navReseau    = buildNavReseau(t);
  const navFinances  = buildNavFinances(t);
  const navCompte    = buildNavCompte(t);
  const displayName  = livreurName || t('livreurLayout.sidebar.defaultName');
  const ratingLabel  = typeof rating === 'number' && Number.isFinite(rating) ? rating.toFixed(1) : '—';
  const deliveriesLabel = t('livreurLayout.sidebar.deliveriesLabel', { count: totalDeliveries ?? 0 });

  return (
    <nav className={`${styles.sb} ${isOpen ? styles.open : ''}`}>

      {/* Logo */}
      <div className={styles.sbLogo}>
        <div className={styles.sbBrand}>Sho<b>neya</b></div>
      </div>

      {/* Carte livreur */}
      <div className={styles.sbLv}>
        <div className={styles.sbLvCard} onClick={() => onNavigate('profil' as PageId)}>
          <div className={styles.sbLvTop}>
            <div className={styles.sbAva}>
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : (livreurName ? getInitials(livreurName) : '🛵')}
              <div className={styles.sbAvaOl} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className={styles.sbLvNm}>{displayName}</div>
              <div className={styles.sbLvSub}>
                <i className="fas fa-star" /> {ratingLabel} · {deliveriesLabel}
              </div>
            </div>
          </div>

          {/* Gains du jour */}
          <div className={styles.todayEarn}>
            <div className={styles.teLabel}>{t('livreurLayout.sidebar.todayEarnLabel')}</div>
            <div className={styles.teVal}>{fmtGNF(todayEarn)}</div>
          </div>

          {/* Toggle online */}
          <div className={`${styles.onlineToggle} ${isOnline ? styles.onlineOn : styles.onlineOff}`}>
            <div className={styles.otTxt}>
              <span className={`${styles.otDot} ${isOnline ? styles.dotGreen : styles.dotGray}`} />
              <span>{isOnline ? t('livreurLayout.sidebar.online') : t('livreurLayout.sidebar.offline')}</span>
            </div>
            <label className={styles.otSwitch}>
              <input type="checkbox" checked={isOnline} onChange={onToggleOnline} />
              <span className={`${styles.ots} ${isOnline ? styles.otsOn : ''}`} />
            </label>
          </div>
        </div>
      </div>

      {/* Solde du portefeuille Shoneya — sous la carte livreur.
          Masqué en rail compact (≤1100px, styles.walletWrap) : WalletQuickBar
          n'a pas de mode icône-seule et déborderait dans une piste de 68px. */}
      <div className={styles.walletWrap} style={{ padding: '0 22px 12px' }}>
        <WalletQuickBar compact mini onManage={() => onNavigate('wallet' as PageId)} />
      </div>

      {/* Nav */}
      <div className={styles.sbNav}>
        {navPrincipal.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}

        <div className={styles.sbSect}>{t('livreurLayout.sidebar.sections.reseau')}</div>
        {navReseau.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}

        <div className={styles.sbSect}>{t('livreurLayout.sidebar.sections.finances')}</div>
        {navFinances.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}

        <div className={styles.sbSect}>{t('livreurLayout.sidebar.sections.compte')}</div>
        {navCompte.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

function NavBtn({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: (p: PageId) => void }) {
  const badgeCls = item.bCls ? `${styles.nbBadge} ${styles[`badge_${item.bCls}`] ?? ''}` : styles.nbBadge;
  return (
    <div
      className={`${styles.nb} ${active ? styles.on : ''}`}
      onClick={() => onNavigate(item.id)}
      data-label={item.label}
    >
      <i className={`fas ${item.icon}`} />
      <span>{item.label}</span>
      {item.badge !== undefined && (
        <span className={badgeCls}>{item.badge}</span>
      )}
    </div>
  );
}
