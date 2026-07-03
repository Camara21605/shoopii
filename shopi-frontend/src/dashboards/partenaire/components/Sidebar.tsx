/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/Sidebar.tsx
 *
 * Menu latéral du dashboard partenaire (navy).
 * ================================================================ */

import styles from '../styles/Sidebar.module.css';
import type { PartenairePage } from '../data/types';

interface SidebarProps {
  activePage:   PartenairePage;
  onNavigate:   (page: PartenairePage) => void;
  onGenerate:   () => void;
  isOpen?:      boolean;
  onClose?:     () => void;
  partnerName?: string;
  partnerTier?: string;
}

const NAV = [
  { title: 'Principal', items: [
    { id: 'overview' as PartenairePage, icon: 'fa-chart-pie', label: "Vue d'ensemble" },
  ]},
  { title: 'Acquisition', items: [
    { id: 'codes'        as PartenairePage, icon: 'fa-qrcode',        label: 'Codes de création', badge: '3',  badgeCls: 'a' },
    { id: 'acteurs'      as PartenairePage, icon: 'fa-people-group',  label: 'Mes acteurs',       badge: '18', badgeCls: 'g' },
    { id: 'invitations'  as PartenairePage, icon: 'fa-paper-plane',   label: 'Invitations' },
  ]},
  { title: 'Revenus', items: [
    { id: 'commissions' as PartenairePage, icon: 'fa-hand-holding-dollar', label: 'Commissions' },
    { id: 'paiements'   as PartenairePage, icon: 'fa-wallet',              label: 'Paiements' },
  ]},
  { title: 'Performance', items: [
    { id: 'stats' as PartenairePage, icon: 'fa-chart-line', label: 'Statistiques' },
  ]},
  { title: 'Sécurité', items: [
    { id: 'signalements' as PartenairePage, icon: 'fa-shield-halved', label: 'Signalements', badge: '2', badgeCls: 'a' },
  ]},
  { title: 'Compte', items: [
    { id: 'parametres' as PartenairePage, icon: 'fa-gear', label: 'Paramètres' },
  ]},
];

export default function Sidebar({
  activePage, onNavigate, onGenerate,
  isOpen = false, onClose,
  partnerName = 'Mohamed Soumah', partnerTier = 'Partenaire Or · Conakry',
}: SidebarProps) {
  const initiales = partnerName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <>
      {/* Overlay backdrop on mobile when open */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      )}

      <nav className={`${styles.sb} ${isOpen ? styles.sbOpen : ''}`}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.lm}>Sh</div>
          <div className={styles.brand}>Sho<b>pi</b></div>
          <span className={styles.tag}>PARTENAIRE</span>
        </div>

        {/* Carte partenaire */}
        <div className={styles.me}>
          <div className={styles.meCard} onClick={() => onNavigate('parametres')}>
            <div className={styles.meAv}>{initiales}</div>
            <div>
              <div className={styles.meNm}>{partnerName}</div>
              <div className={styles.meRl}><span className={styles.dot} /> {partnerTier}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className={styles.nav}>
          {NAV.map(section => (
            <div key={section.title}>
              <div className={styles.sect}>{section.title}</div>
              {section.items.map(item => (
                <div key={item.id}
                  className={`${styles.nb} ${activePage === item.id ? styles.on : ''}`}
                  onClick={() => onNavigate(item.id)}>
                  <i className={`fas ${item.icon}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`${styles.badge} ${item.badgeCls === 'g' ? styles.badgeG : styles.badgeA}`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className={styles.cta}>
          <button className={styles.ctaBtn} onClick={onGenerate}>
            <i className="fas fa-plus" /> Générer un code
          </button>
        </div>
      </nav>
    </>
  );
}
