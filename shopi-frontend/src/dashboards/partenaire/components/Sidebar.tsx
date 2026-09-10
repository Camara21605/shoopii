/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/Sidebar.tsx
 *
 * Menu latéral du dashboard partenaire (navy).
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import styles from '../styles/Sidebar.module.css';
import type { PartenairePage } from '../data/types';
import WalletQuickBar from '../../../shared/components/portefeuille/WalletQuickBar';

interface SidebarProps {
  activePage:   PartenairePage;
  onNavigate:   (page: PartenairePage) => void;
  onGenerate:   () => void;
  isOpen?:      boolean;
  onClose?:     () => void;
  partnerName?: string;
  partnerTier?: string;
}

function buildNav(t: (k: string) => string) {
  return [
    { title: t('partenaireLayout.sidebar.sections.principal'), items: [
      { id: 'overview' as PartenairePage, icon: 'fa-chart-pie', label: t('partenaireLayout.sidebar.items.overview') },
    ]},
    { title: t('partenaireLayout.sidebar.sections.acquisition'), items: [
      { id: 'codes'        as PartenairePage, icon: 'fa-qrcode',        label: t('partenaireLayout.sidebar.items.codes'),   badge: '3',  badgeCls: 'a' },
      { id: 'acteurs'      as PartenairePage, icon: 'fa-people-group',  label: t('partenaireLayout.sidebar.items.acteurs'), badge: '18', badgeCls: 'g' },
      { id: 'invitations'  as PartenairePage, icon: 'fa-paper-plane',   label: t('partenaireLayout.sidebar.items.invitations') },
    ]},
    { title: t('partenaireLayout.sidebar.sections.revenus'), items: [
      { id: 'commissions' as PartenairePage, icon: 'fa-hand-holding-dollar', label: t('partenaireLayout.sidebar.items.commissions') },
      { id: 'paiements'   as PartenairePage, icon: 'fa-wallet',              label: t('partenaireLayout.sidebar.items.paiements') },
    ]},
    { title: t('partenaireLayout.sidebar.sections.performance'), items: [
      { id: 'stats' as PartenairePage, icon: 'fa-chart-line', label: t('partenaireLayout.sidebar.items.stats') },
    ]},
    { title: t('partenaireLayout.sidebar.sections.securite'), items: [
      { id: 'signalements' as PartenairePage, icon: 'fa-shield-halved', label: t('partenaireLayout.sidebar.items.signalements'), badge: '2', badgeCls: 'a' },
    ]},
    { title: t('partenaireLayout.sidebar.sections.compte'), items: [
      { id: 'parametres' as PartenairePage, icon: 'fa-gear', label: t('partenaireLayout.sidebar.items.parametres') },
    ]},
  ];
}

export default function Sidebar({
  activePage, onNavigate, onGenerate,
  isOpen = false, onClose,
  partnerName = 'Mohamed Soumah', partnerTier = 'Partenaire Or · Conakry',
}: SidebarProps) {
  const { t } = useTranslation();
  const NAV = buildNav(t);
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
          <div className={styles.brand}>Sho<b>neya</b></div>
          <span className={styles.tag}>{t('partenaireLayout.sidebar.brandTag')}</span>
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

        {/* Solde du portefeuille Shoneya — sous la carte partenaire */}
        <div style={{ padding: '0 22px 12px' }}>
          <WalletQuickBar compact mini onManage={() => onNavigate('paiements')} />
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
            <i className="fas fa-plus" /> {t('partenaireLayout.sidebar.generateBtn')}
          </button>
        </div>
      </nav>
    </>
  );
}
