// src/dashboards/livreur/components/Sidebar.tsx
import type { PageId } from '../data/livreurData';
import { fmtGNF } from '../data/livreurData';
import styles from '../styles/Sidebar.module.css';

interface Props {
  activePage:     PageId;
  isOpen:         boolean;
  isOnline:       boolean;
  todayEarn:      number;
  onNavigate:     (p: PageId) => void;
  onClose:        () => void;
  onToggleOnline: () => void;
  onLogout:       () => void;
  onGoHome:       () => void;
}

type NavItem = { id: PageId; icon: string; label: string; badge?: string | number; bCls?: string };

const NAV_MON_ESPACE: NavItem[] = [
  { id:'overview',   icon:'fa-chart-pie',          label:"Vue d'ensemble"                              },
  { id:'missions',   icon:'fa-motorcycle',          label:'Missions disponibles', badge:8,  bCls:'r'   },
  { id:'encours',    icon:'fa-route',               label:'En cours',             badge:1,  bCls:'g'   },
  { id:'historique', icon:'fa-clock-rotate-left',   label:'Historique'                                 },
  { id:'messagerie', icon:'fa-comment-dots',        label:'Messagerie'                                 },
];
const NAV_RESEAU: NavItem[] = [
  { id:'boutiques', icon:'fa-store',       label:'Mes boutiques',          badge:3, bCls:'b' },
  { id:'abonner',   icon:'fa-plus-circle', label:"S'abonner à une boutique"                 },
];
const NAV_FINANCES: NavItem[] = [
  { id:'revenus', icon:'fa-coins',  label:'Mes revenus'   },
  { id:'wallet',  icon:'fa-wallet', label:'Wallet Shopi'  },
];
const NAV_COMPTE: NavItem[] = [
  { id:'zone',       icon:'fa-map-location-dot', label:'Ma zone de livraison'             },
  { id:'evaluation', icon:'fa-user-plus',        label:'Ajouter un correspondant'         },
  { id:'parametres', icon:'fa-gear',             label:'Paramètres'                       },
];

export default function Sidebar({
  activePage, isOpen, isOnline, todayEarn,
  onNavigate, onToggleOnline, onLogout, onGoHome,
}: Props) {
  return (
    <nav className={`${styles.sb} ${isOpen ? styles.open : ''}`}>

      {/* Logo */}
      <div className={styles.sbLogo}>
        <div className={styles.sbLm}>Sh</div>
        <div className={styles.sbBrand}>Sho<b>pi</b></div>
      </div>

      {/* Carte livreur */}
      <div className={styles.sbLv}>
        <div className={styles.sbLvCard} onClick={() => onNavigate('profil' as PageId)}>
          <div className={styles.sbLvTop}>
            <div className={styles.sbAva}>
              🛵
              <div className={styles.sbAvaOl} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className={styles.sbLvNm}>Mamadou Diallo</div>
              <div className={styles.sbLvSub}>
                <i className="fas fa-star" /> 4.9 · 1 240 livraisons
              </div>
            </div>
          </div>

          {/* Gains du jour */}
          <div className={styles.todayEarn}>
            <div className={styles.teLabel}>Gains aujourd'hui</div>
            <div className={styles.teVal}>{fmtGNF(todayEarn)}</div>
          </div>

          {/* Toggle online */}
          <div className={`${styles.onlineToggle} ${isOnline ? styles.onlineOn : styles.onlineOff}`}>
            <div className={styles.otTxt}>
              <span className={`${styles.otDot} ${isOnline ? styles.dotGreen : styles.dotGray}`} />
              <span>{isOnline ? 'En ligne · disponible' : 'Hors ligne · pause'}</span>
            </div>
            <label className={styles.otSwitch}>
              <input type="checkbox" checked={isOnline} onChange={onToggleOnline} />
              <span className={`${styles.ots} ${isOnline ? styles.otsOn : ''}`} />
            </label>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className={styles.sbNav}>
        <div className={styles.sbSect}>Mon espace</div>
        {NAV_MON_ESPACE.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}

        <div className={styles.sbSect}>Réseau &amp; Boutiques</div>
        {NAV_RESEAU.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}

        <div className={styles.sbSect}>Finances</div>
        {NAV_FINANCES.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}

        <div className={styles.sbSect}>Mon compte</div>
        {NAV_COMPTE.map(item => (
          <NavBtn key={item.id} item={item} active={activePage === item.id} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Bas sidebar */}
      <div className={styles.sbBot}>

        {/* Bouton Mon espace livreur */}
        <button
          className={styles.btnHome}
          onClick={onGoHome}
          title="Retour à l'accueil Shopi"
        >
          <i className="fas fa-house" />
          <span>Mon espace</span>
          <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: 9, opacity: .6 }} />
        </button>

        {/* Bouton Déconnexion */}
        <button
          className={styles.btnLogout}
          onClick={onLogout}
          title="Se déconnecter"
        >
          <i className="fas fa-right-from-bracket" />
          <span>Déconnexion</span>
        </button>

      </div>
    </nav>
  );
}

function NavBtn({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: (p: PageId) => void }) {
  const badgeCls = item.bCls ? `${styles.nbBadge} ${styles[`badge_${item.bCls}`] ?? ''}` : styles.nbBadge;
  return (
    <div className={`${styles.nb} ${active ? styles.on : ''}`} onClick={() => onNavigate(item.id)}>
      <i className={`fas ${item.icon}`} />
      <span>{item.label}</span>
      {item.badge !== undefined && (
        <span className={badgeCls}>{item.badge}</span>
      )}
    </div>
  );
}
