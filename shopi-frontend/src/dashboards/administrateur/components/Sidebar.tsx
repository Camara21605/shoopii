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

/* Sections de navigation avec leurs items (badges statiques hors notifications).
 * `perm` optionnel : clé de la permission "Modules généraux" (super-admin →
 * Permissions Admins) requise pour voir cet item. Absent = toujours visible. */
const NAV: { title: string; items: { id: AdminPage; icon: string; label: string; perm?: string }[] }[] = [
  { title: 'Principal', items: [
    { id: 'overview', icon: 'fa-chart-pie',   label: "Vue d'ensemble" },
    { id: 'stats',    icon: 'fa-chart-line',  label: 'Statistiques', perm: 'stats' },
  ]},
  { title: 'Acquisition', items: [
    { id: 'codes',       icon: 'fa-qrcode',    label: 'Codes de création' },
    { id: 'partenaires', icon: 'fa-handshake', label: 'Partenaires', perm: 'partners' },
  ]},
  { title: 'Supervision', items: [
    { id: 'acteurs',      icon: 'fa-people-group',  label: 'Acteurs de la zone' },
    { id: 'clients',      icon: 'fa-users',          label: 'Clients', perm: 'customers' },
    { id: 'validations',  icon: 'fa-user-check',    label: 'Validations' },
    { id: 'signalements', icon: 'fa-shield-halved', label: 'Signalements', perm: 'reports' },
  ]},
  { title: 'Activité', items: [
    { id: 'commandes',     icon: 'fa-box',            label: 'Commandes' },
    { id: 'finances',      icon: 'fa-coins',          label: 'Finances' },
    { id: 'audit',         icon: 'fa-clipboard-list', label: "Journal d'audit" },
    { id: 'notifications', icon: 'fa-bell',           label: 'Notifications', perm: 'notifs' },
  ]},
  { title: 'Support', items: [
    { id: 'support', icon: 'fa-headset', label: 'Support', perm: 'support' },
  ]},
  { title: 'Compte', items: [
    { id: 'parametres', icon: 'fa-gear', label: 'Paramètres' },
  ]},
];

export default function Sidebar({ activePage, open, onClose, onNavigate, onGenerate, geoPerms, zoneName, adminName, communesCount, unreadCount }: SidebarProps) {
  const hasGeoAccess = Object.entries(geoPerms ?? {}).some(([k, v]) => k.startsWith('geo_') && v);
  /* Même logique que hasGeoAccess ci-dessus : tant que /my-permissions n'a
   * pas répondu, geoPerms vaut {} → tout item avec `perm` reste masqué
   * (jamais affiché puis retiré, cohérent avec le comportement déjà en
   * place pour le Référentiel Géo). */
  const hasPerm = (key?: string) => key === undefined || geoPerms?.[key] === true;

  return (
    <>
      {/* Overlay semi-transparent sur mobile (ferme la sidebar au clic) */}
      {open && <div className={styles.overlay} onClick={onClose} />}

      <nav className={`${styles.sb} ${open ? styles.open : ''}`}>
        {/* ── Logo + badge ADMIN ── */}
        <div className={styles.logo}>
          <div className={styles.brand}>Sho<b>neya</b></div>
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
          {NAV.map(section => {
            const visibleItems = section.items.filter(item => hasPerm(item.perm));
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.title}>
              <div className={styles.sect}>{section.title}</div>
              {visibleItems.map(item => (
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
            );
          })}

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
