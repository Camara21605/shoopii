/* ================================================================
 * COMPOSANT : NotifPanel.tsx
 *
 * Dropdown de notifications admin.
 * S'ouvre depuis la cloche de la Topbar.
 *
 * Props :
 *   items       — liste des notifications (du hook useNotifications)
 *   unreadCount — nombre de non-lus (pour le badge)
 *   loading     — état de chargement initial
 *   onMarkRead  — marquer 1 notif comme lue
 *   onMarkAll   — marquer tout comme lu
 *   onDismiss   — supprimer 1 notif
 *   onClose     — fermer le panel
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/NotifPanel.module.css';
import type { INotificationDto } from '../hooks/useNotifications';
import type { AdminPage } from '../data/types';

// ─── Helpers ───────────────────────────────────────────────────

/** Modules "généraux" (Permissions Admins côté super-admin) → page admin
 * correspondante. Miroir de GENERAL_LABELS dans admins.service.ts (backend) —
 * utilisé pour rediriger avec précision les notifications admin_permission. */
const PERM_TO_PAGE: Record<string, AdminPage> = {
  partners:  'partenaires',
  companies: 'acteurs',
  delivery:  'acteurs',
  customers: 'clients',
  stats:     'stats',
  reports:   'signalements',
  support:   'support',
  // 'notifs' : pas de page dédiée (dropdown uniquement) → overview
};

/**
 * Résout la page admin + l'éventuel ID de ressource précise à cibler,
 * selon le resourceType/resourceId/payload de la notification.
 * Garantit que l'admin reste dans le dashboard — aucun redirect vers le home.
 */
function resolveNotifTarget(n: INotificationDto): { page: AdminPage; id?: string | null } {
  switch (n.resourceType) {
    case 'validation': return { page: 'validations',  id: n.resourceId };
    case 'report':     return { page: 'signalements', id: n.resourceId };
    case 'geo_permission':
    case 'geo_assignment':
      return { page: 'geo' };
    case 'admin_permission': {
      const perm = (n.payload as { perm?: string } | null)?.perm;
      return { page: (perm && PERM_TO_PAGE[perm]) || 'overview' };
    }
    default: return { page: 'overview' };
  }
}

/** Icône Font Awesome selon le type de notification */
function iconForType(type: string, priority: string): string {
  if (type.includes('validation') || type.includes('account')) return 'fa-user-check';
  if (type.includes('order'))     return 'fa-box';
  if (type.includes('payment') || type.includes('commission')) return 'fa-coins';
  if (type.includes('support'))   return 'fa-headset';
  if (type.includes('report') || type.includes('signalement')) return 'fa-flag';
  if (type.includes('message'))   return 'fa-envelope';
  if (priority === 'urgent')      return 'fa-triangle-exclamation';
  return 'fa-bell';
}

/** Initiales (1-2 lettres) d'un nom d'acteur, pour l'avatar de repli. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Durée relative courte */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d} j`;
}

// ─── Composant ─────────────────────────────────────────────────

interface NotifPanelProps {
  items:       INotificationDto[];
  unreadCount: number;
  loading:     boolean;
  onMarkRead:  (id: string) => void;
  onMarkAll:   () => void;
  onDismiss:   (id: string) => void;
  onClose:     () => void;
  onNavigate:  (page: AdminPage, resourceId?: string | null) => void;
}

type Tab = 'all' | 'unread';

export default function NotifPanel({
  items, unreadCount, loading,
  onMarkRead, onMarkAll, onDismiss,
  onClose, onNavigate,
}: NotifPanelProps) {

  const [tab, setTab] = useState<Tab>('all');

  const visible = tab === 'unread' ? items.filter(n => !n.isRead) : items;

  const handleClick = (n: INotificationDto) => {
    if (!n.isRead) onMarkRead(n.id);
    // Navigation interne au dashboard admin — jamais de redirect vers le home
    const { page, id } = resolveNotifTarget(n);
    onClose();
    onNavigate(page, id);
  };

  return (
    <>
      {/* Overlay transparent pour fermer au clic hors panel */}
      <div className={styles.overlay} onClick={onClose} />

      <div className={styles.panel} role="dialog" aria-label="Notifications">

        {/* ── En-tête ── */}
        <div className={styles.head}>
          <span className={styles.headTitle}>Notifications</span>
          {unreadCount > 0 && (
            <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
          {unreadCount > 0 && (
            <button className={styles.markAllBtn} onClick={onMarkAll}>
              Tout marquer lu
            </button>
          )}
        </div>

        {/* ── Onglets filtre ── */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'all' ? styles.active : ''}`}
            onClick={() => setTab('all')}>
            Toutes
          </button>
          <button
            className={`${styles.tab} ${tab === 'unread' ? styles.active : ''}`}
            onClick={() => setTab('unread')}>
            Non lues {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* ── Corps : liste ── */}
        <div className={styles.list}>
          {loading && (
            <div className={styles.loader}><div className={styles.spinner} /></div>
          )}

          {!loading && visible.length === 0 && (
            <div className={styles.empty}>
              <i className={`fas fa-bell-slash ${styles.emptyIcon}`} />
              <span>
                {tab === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
              </span>
            </div>
          )}

          {visible.map(n => (
            <div
              key={n.id}
              className={`${styles.item} ${!n.isRead ? styles.unread : ''}`}
              onClick={() => handleClick(n)}>

              {/* Avatar de l'acteur déclencheur, sinon icône générique du type */}
              {n.actor ? (
                <div className={styles.avatarWrap}>
                  {n.actor.avatar ? (
                    <img className={styles.avatarImg} src={n.actor.avatar} alt={n.actor.name} />
                  ) : (
                    <div className={styles.avatarInitial}>{initials(n.actor.name)}</div>
                  )}
                  <div className={`${styles.avatarBadge} ${styles[n.priority]}`}>
                    <i className={`fas ${iconForType(n.type, n.priority)}`} />
                  </div>
                </div>
              ) : (
                <div className={`${styles.iconWrap} ${styles[n.priority]}`}>
                  <i className={`fas ${iconForType(n.type, n.priority)}`} />
                </div>
              )}

              {/* Pastille non-lu */}
              {!n.isRead && <div className={styles.unreadDot} />}

              {/* Texte */}
              <div className={styles.body}>
                {n.actor && <div className={styles.itemActor}>{n.actor.name}</div>}
                <div className={styles.itemTitle}>
                  {n.count > 1 ? `(${n.count}) ${n.title}` : n.title}
                </div>
                <div className={styles.itemBody}>{n.body}</div>
                <div className={styles.itemMeta}>{relTime(n.createdAt)}</div>
              </div>

              {/* Bouton dismiss */}
              <button
                className={styles.dismiss}
                title="Supprimer"
                onClick={e => { e.stopPropagation(); onDismiss(n.id); }}>
                <i className="fas fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
