/* ================================================================
 * PAGE : NotificationsPage.tsx
 *
 * Centre de notifications de l'administrateur.
 *
 * Fonctionnalités :
 *   - Liste paginée des notifications (GET /notifications)
 *   - Filtres : Toutes / Non lues / par type
 *   - Recherche textuelle
 *   - Marquer comme lu (individuel + tout)
 *   - Supprimer (individuel)
 *   - Chargement supplémentaire ("Voir plus")
 *   - Temps réel via useNotifications (WebSocket + polling)
 * ================================================================ */

import { useState, useMemo } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import type { INotificationDto } from '../hooks/useNotifications';
import type { AdminPage } from '../data/types';
import styles from '../styles/NotificationsPage.module.css';

/**
 * Résout la page admin à afficher selon le resourceType.
 * Garantit que l'admin reste dans le dashboard — aucun redirect vers le home.
 */
function resolveAdminPage(resourceType: string | null): AdminPage {
  switch (resourceType) {
    case 'validation':    return 'validations';
    case 'report':        return 'signalements';
    case 'order':         return 'commandes';
    case 'payment':
    case 'commission':
    case 'escrow':
    case 'wallet':
    case 'retrait':       return 'finances';
    case 'account':       return 'acteurs';
    case 'code':          return 'codes';
    case 'support_ticket':return 'audit';
    default:              return 'overview';
  }
}

// ─── Helpers ───────────────────────────────────────────────────

function iconForType(type: string, priority: string): string {
  if (type.includes('account') || type.includes('verified') || type.includes('approved'))
    return 'fa-user-check';
  if (type.includes('suspended') || type.includes('banned'))
    return 'fa-user-xmark';
  if (type.includes('order'))   return 'fa-box';
  if (type.includes('payment') || type.includes('commission')) return 'fa-coins';
  if (type.includes('support')) return 'fa-headset';
  if (type.includes('report') || type.includes('system_announcement'))
    return 'fa-flag';
  if (type.includes('message')) return 'fa-envelope';
  if (type.includes('follow'))  return 'fa-user-plus';
  if (priority === 'urgent')    return 'fa-triangle-exclamation';
  return 'fa-bell';
}

function priorityLabel(p: string): string {
  return { urgent: 'Urgent', high: 'Haute', normal: 'Normale', low: 'Basse' }[p] ?? p;
}

/** Initiales (1-2 lettres) d'un nom d'acteur, pour l'avatar de repli. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'À l\'instant';
  if (m < 60)  return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `Il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

// ─── Types de filtre ────────────────────────────────────────────

type Filter = 'all' | 'unread' | 'urgent' | 'high';

const FILTERS: { id: Filter; label: string; icon: string }[] = [
  { id: 'all',    label: 'Toutes',    icon: 'fa-list'                 },
  { id: 'unread', label: 'Non lues',  icon: 'fa-circle'               },
  { id: 'urgent', label: 'Urgentes',  icon: 'fa-triangle-exclamation' },
  { id: 'high',   label: 'Importantes', icon: 'fa-star'              },
];

// ─── Composant ─────────────────────────────────────────────────

interface NotificationsPageProps {
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
  onNavigate: (page: AdminPage) => void;
}

export default function NotificationsPage({ onToast, onNavigate }: NotificationsPageProps) {
  const {
    items, unreadCount, loading, hasMore,
    markRead, markAll, dismiss, loadMore,
  } = useNotifications();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  /* Filtrage en mémoire */
  const visible = useMemo<INotificationDto[]>(() => {
    let list = items;
    if (filter === 'unread') list = list.filter(n => !n.isRead);
    if (filter === 'urgent') list = list.filter(n => n.priority === 'urgent');
    if (filter === 'high')   list = list.filter(n => n.priority === 'high' || n.priority === 'urgent');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, filter, search]);

  const handleMarkAll = async () => {
    await markAll();
    onToast('Toutes les notifications marquées comme lues', 's');
  };

  const handleDismiss = async (id: string) => {
    await dismiss(id);
    onToast('Notification supprimée', 'i');
  };

  const handleMarkRead = (n: INotificationDto) => {
    if (!n.isRead) markRead(n.id);
    // Navigation interne : jamais de redirect vers le site home
    onNavigate(resolveAdminPage(n.resourceType));
  };

  return (
    <div className={styles.page}>

      {/* ── En-tête ── */}
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>Notifications</h1>
          <p className={styles.pageSub}>
            {unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Tout est à jour'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className={styles.markAllBtn} onClick={handleMarkAll}>
            <i className="fas fa-check-double" /> Tout marquer lu
          </button>
        )}
      </div>

      {/* ── Barre de contrôles ── */}
      <div className={styles.controls}>
        {/* Filtres */}
        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`${styles.filterBtn} ${filter === f.id ? styles.active : ''}`}
              onClick={() => setFilter(f.id)}>
              <i className={`fas ${f.icon}`} />
              {f.label}
              {f.id === 'unread' && unreadCount > 0 && (
                <span className={styles.filterBadge}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div className={styles.searchWrap}>
          <i className="fas fa-magnifying-glass" />
          <input
            className={styles.searchIn}
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
      </div>

      {/* ── Liste ── */}
      <div className={styles.list}>
        {loading && items.length === 0 && (
          <div className={styles.loader}>
            <div className={styles.spinner} />
            <span>Chargement des notifications…</span>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className={styles.empty}>
            <i className="fas fa-bell-slash" />
            <span>
              {search
                ? `Aucun résultat pour « ${search} »`
                : filter !== 'all'
                  ? 'Aucune notification dans cette catégorie'
                  : 'Aucune notification pour le moment'}
            </span>
          </div>
        )}

        {visible.map(n => (
          <div
            key={n.id}
            className={`${styles.item} ${!n.isRead ? styles.unread : ''} ${styles['pri_' + n.priority]}`}
            onClick={() => handleMarkRead(n)}>

            {/* Bande de priorité */}
            <div className={`${styles.priBar} ${styles['bar_' + n.priority]}`} />

            {/* Avatar de l'acteur déclencheur, sinon icône générique du type */}
            {n.actor ? (
              <div className={styles.avatarWrap}>
                {n.actor.avatar ? (
                  <img className={styles.avatarImg} src={n.actor.avatar} alt={n.actor.name} />
                ) : (
                  <div className={styles.avatarInitial}>{initials(n.actor.name)}</div>
                )}
                <div className={`${styles.avatarBadge} ${styles['ic_' + n.priority]}`}>
                  <i className={`fas ${iconForType(n.type, n.priority)}`} />
                </div>
              </div>
            ) : (
              <div className={`${styles.iconWrap} ${styles['ic_' + n.priority]}`}>
                <i className={`fas ${iconForType(n.type, n.priority)}`} />
              </div>
            )}

            {/* Corps */}
            <div className={styles.body}>
              {n.actor && <p className={styles.itemActor}>{n.actor.name}</p>}
              <div className={styles.itemHead}>
                <span className={styles.itemTitle}>
                  {n.count > 1 ? `(${n.count}) ` : ''}{n.title}
                </span>
                <span className={`${styles.priChip} ${styles['chip_' + n.priority]}`}>
                  {priorityLabel(n.priority)}
                </span>
                {!n.isRead && <span className={styles.unreadDot} />}
              </div>
              <p className={styles.itemBody}>{n.body}</p>
              <div className={styles.itemFoot}>
                <span className={styles.itemTime}><i className="fas fa-clock" /> {relTime(n.createdAt)}</span>
                {n.resourceType && (
                  <span className={styles.itemTag}>{n.resourceType}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              {!n.isRead && (
                <button
                  className={styles.actionBtn}
                  title="Marquer comme lu"
                  onClick={e => { e.stopPropagation(); markRead(n.id); }}>
                  <i className="fas fa-check" />
                </button>
              )}
              <button
                className={`${styles.actionBtn} ${styles.actionDel}`}
                title="Supprimer"
                onClick={e => { e.stopPropagation(); handleDismiss(n.id); }}>
                <i className="fas fa-trash-can" />
              </button>
            </div>
          </div>
        ))}

        {/* Voir plus */}
        {hasMore && !loading && (
          <button className={styles.loadMore} onClick={loadMore}>
            <i className="fas fa-chevron-down" /> Voir plus de notifications
          </button>
        )}

        {loading && items.length > 0 && (
          <div className={styles.loadingMore}>
            <div className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}
