/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/Sidebar.tsx
 *
 * Menu latéral navy de l'admin : logo + carte admin + carte zone
 * + navigation par sections + CTA "Générer un code".
 * Coulissante sur mobile (prop open + onClose).
 * ================================================================ */

import styles from '../styles/Sidebar.module.css';
import type { AdminPage } from '../data/types';

interface SidebarProps {
  activePage:     AdminPage;
  open:           boolean;
  onClose:        () => void;
  onNavigate:     (page: AdminPage) => void;
  onGenerate:     () => void;
  geoPerms?:      Record<string, boolean | string | null>;
  zoneName?:      string;
  adminName?:     string;
  communesCount?: number;
  unreadCount?:   number;
}

/* Sections de navigation avec leurs items (badges statiques hors notifications) */
const NAV = [
  { title: 'Principal', items: [
    { id: 'overview' as AdminPage, icon: 'fa-chart-pie', label: "Vue d'ensemble" },
  ]},
  { title: 'Acquisition', items: [
    { id: 'codes'       as AdminPage, icon: 'fa-qrcode',    label: 'Codes de création' },
    { id: 'partenaires' as AdminPage, icon: 'fa-handshake', label: 'Partenaires' },
  ]},
  { title: 'Supervision', items: [
    { id: 'acteurs'      as AdminPage, icon: 'fa-people-group',  label: 'Acteurs de la zone' },
    { id: 'validations'  as AdminPage, icon: 'fa-user-check',    label: 'Validations' },
    { id: 'signalements' as AdminPage, icon: 'fa-shield-halved', label: 'Signalements' },
  ]},
  { title: 'Activité', items: [
    { id: 'commandes'     as AdminPage, icon: 'fa-box',            label: 'Commandes' },
    { id: 'finances'      as AdminPage, icon: 'fa-coins',          label: 'Finances' },
    { id: 'audit'         as AdminPage, icon: 'fa-clipboard-list', label: "Journal d'audit" },
    { id: 'notifications' as AdminPage, icon: 'fa-bell',           label: 'Notifications' },
  ]},
  { title: 'Compte', items: [
    { id: 'parametres' as AdminPage, icon: 'fa-gear', label: 'Paramètres' },
  ]},
];

export default function Sidebar({ activePage, open, onClose, onNavigate, onGenerate, geoPerms, zoneName, adminName, communesCount, unreadCount }: SidebarProps) {
  const hasGeoAccess = Object.entries(geoPerms ?? {}).some(([k, v]) => k.startsWith('geo_') && v);

  return (
    <>
      {/* Overlay semi-transparent sur mobile (ferme la sidebar au clic) */}
      {open && <div className={styles.overlay} onClick={onClose} />}

      <nav className={`${styles.sb} ${open ? styles.open : ''}`}>
        {/* ── Logo + badge ADMIN ── */}
        <div className={styles.logo}>
          <div className={styles.lm}>Sh</div>
          <div className={styles.brand}>Sho<b>pi</b></div>
          <span className={styles.tag}>ADMIN</span>
          <button className={styles.close} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        {/* ── Carte administrateur + zone ── */}
        <div className={styles.me}>
          {/* Clic → page paramètres */}
          <div className={styles.meCard} onClick={() => onNavigate('parametres')}>
            <div className={styles.meAv}>AC</div>
            <div>
              <div className={styles.meNm}>{adminName ?? 'Admin'}</div>
              <div className={styles.meRl}><span className={styles.dot} /> Administrateur·rice</div>
            </div>
          </div>
          {/* Infos de la zone */}
          <div className={styles.zone}>
            <i className="fas fa-map-location-dot" />
            <div>
              <div className={styles.zoneNm}>{zoneName ?? 'Zone'}</div>
              <div className={styles.zoneSub}>{communesCount ?? 0} communes</div>
            </div>
          </div>
        </div>

        {/* ── Navigation par sections ── */}
        <div className={styles.nav}>
          {NAV.map(section => (
            <div key={section.title}>
              <div className={styles.sect}>{section.title}</div>
              {section.items.map(item => (
                <button key={item.id}
                  className={`${styles.nb} ${activePage === item.id ? styles.on : ''}`}
                  onClick={() => onNavigate(item.id)}>
                  <i className={`fas ${item.icon}`} />
                  <span>{item.label}</span>
                  {/* Badge temps réel pour les notifications */}
                  {item.id === 'notifications' && (unreadCount ?? 0) > 0 && (
                    <span className={`${styles.badge} ${styles.badge_r}`}>
                      {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}

          {/* ── Référentiel Géo (visible uniquement si accès accordé) ── */}
          {hasGeoAccess && (
            <div>
              <div className={styles.sect}>Référentiel</div>
              <button
                className={`${styles.nb} ${activePage === 'geo' ? styles.on : ''}`}
                onClick={() => onNavigate('geo')}>
                <i className="fas fa-earth-africa" />
                <span>Référentiel Géo</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Bouton CTA (génération de code) ── */}
        <div className={styles.cta}>
          <button className={styles.ctaBtn} onClick={onGenerate}>
            <i className="fas fa-plus" /> Générer un code
          </button>
        </div>
      </nav>
    </>
  );
}
