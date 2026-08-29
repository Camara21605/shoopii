/* ============================================================
 * FICHIER : src/shared/notifications/NotificationsPage.tsx
 *
 * RÔLE : Page complète du centre de notifications — remplace le
 *        dropdown comme destination principale (le dropdown ne
 *        garde qu'un aperçu limité + un bouton "Voir tout" qui
 *        mène ici). Réutilisée telle quelle sur le site public
 *        (/notifications) et dans chaque dashboard interne
 *        (Entreprise, Livreur, Partenaire, Correspondant, Super-admin).
 *
 * Consomme useNotifications() (NotificationContext) — la même
 * instance que le dropdown, donc aucune requête réseau redondante :
 * ouvrir cette page réutilise la liste déjà chargée.
 * ============================================================ */

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './NotificationContext';
import type { INotificationDto } from './types';
import { relativeTime, getTypeMeta, resolveNavTarget, categoryOf, type NotifCategory } from './notificationUtils';
import styles from './NotificationsPage.module.css';

// ─── Regroupement par date (façon Gmail) ───────────────────────

function dateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const today = startOfDay(new Date());
  const day   = startOfDay(d);
  const diffDays = Math.round((today - day) / 86_400_000);

  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7)   return 'Cette semaine';
  if (diffDays < 30)  return 'Ce mois-ci';

  const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByDate(list: INotificationDto[]): { label: string; items: INotificationDto[] }[] {
  const groups: { label: string; items: INotificationDto[] }[] = [];
  for (const n of list) {
    const label = dateGroupLabel(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

// ─── Filtres ────────────────────────────────────────────────────

const FILTERS: { id: NotifCategory; label: string; icon: string }[] = [
  { id: 'all',     label: 'Toutes',      icon: 'fa-list'          },
  { id: 'unread',  label: 'Non lues',    icon: 'fa-circle'        },
  { id: 'order',   label: 'Commandes',   icon: 'fa-box'           },
  { id: 'message', label: 'Messages',    icon: 'fa-comment-dots'  },
  { id: 'product', label: 'Produits',    icon: 'fa-heart'         },
  { id: 'promo',   label: 'Promotions',  icon: 'fa-percent'       },
  { id: 'account', label: 'Compte',      icon: 'fa-user'          },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications, unreadCount, isLoading, hasMore,
    markAsRead, markAllAsRead, deleteOne, loadMore,
  } = useNotifications();

  const [filter, setFilter] = useState<NotifCategory>('all');
  const [search, setSearch] = useState('');

  /* Charge la liste complète à l'ouverture si le dropdown n'a encore
   * jamais été ouvert (ex: accès direct par URL/lien profond) — le
   * contexte s'en charge déjà en interne dès que `notifications` est
   * lu, via le même mécanisme que le panneau (voir NotificationContext,
   * fetchList déclenché par isOpen ; ici on force juste un fetch initial
   * si la liste est encore vide). */
  useEffect(() => {
    if (notifications.length === 0 && !isLoading) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Contrairement au dropdown (aperçu compact où les notifications de
   * message.* sont masquées — leur badge vit sur le bouton messagerie),
   * la page complète les affiche toutes par souci d'exhaustivité ; le
   * filtre "Messages" permet de les isoler. */
  const filtered = useMemo<INotificationDto[]>(() => {
    let list = notifications;
    if (filter === 'unread') list = list.filter(n => !n.isRead);
    else if (filter !== 'all') list = list.filter(n => categoryOf(n.type) === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
    }
    return list;
  }, [notifications, filter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  function handleItemClick(notif: INotificationDto) {
    if (!notif.isRead) markAsRead(notif.id);
    const target = resolveNavTarget(notif);
    if (target.startsWith('http')) window.open(target, '_blank', 'noopener');
    else navigate(target);
  }

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
          <button className={styles.markAllBtn} onClick={markAllAsRead}>
            <i className="fas fa-check-double" /> Tout marquer lu
          </button>
        )}
      </div>

      {/* ── Contrôles ── */}
      <div className={styles.controls}>
        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`${styles.filterBtn} ${filter === f.id ? styles.active : ''}`}
              onClick={() => setFilter(f.id)}
            >
              <i className={`fas ${f.icon}`} />
              {f.label}
              {f.id === 'unread' && unreadCount > 0 && <span className={styles.filterBadge}>{unreadCount}</span>}
            </button>
          ))}
        </div>
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
        {isLoading && notifications.length === 0 && (
          <div className={styles.loader}>
            <i className="fas fa-circle-notch fa-spin" />
            <span>Chargement des notifications…</span>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className={styles.empty}>
            <i className="far fa-bell-slash" />
            <span>
              {search
                ? `Aucun résultat pour « ${search} »`
                : filter !== 'all'
                  ? 'Aucune notification dans cette catégorie'
                  : 'Aucune notification pour le moment'}
            </span>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.label}>
            <div className={styles.groupHead}>{group.label}</div>
            {group.items.map(n => {
              const meta = getTypeMeta(n.type);
              return (
                <div
                  key={n.id}
                  className={`${styles.item} ${!n.isRead ? styles.unread : ''}`}
                  onClick={() => handleItemClick(n)}
                >
                  <span className={styles.avatarWrap}>
                    {n.imageUrl
                      ? <img src={n.imageUrl} alt="" className={styles.avatarImg} />
                      : <span className={styles.avatarInitial} style={{ background: meta.bg, color: meta.color }}>
                          {n.title.charAt(0).toUpperCase()}
                        </span>
                    }
                    <span className={styles.typeBadge} style={{ background: meta.color }}>
                      <i className={`fas ${meta.icon}`} />
                    </span>
                  </span>

                  <div className={styles.body}>
                    <div className={styles.itemHead}>
                      <span className={styles.itemTitle}>
                        {n.count > 1 ? `(${n.count}) ` : ''}{n.title}
                      </span>
                      {!n.isRead && <span className={styles.unreadDot} />}
                    </div>
                    <p className={styles.itemBody}>{n.body}</p>
                    <span className={styles.itemTime}>{relativeTime(n.createdAt)}</span>
                  </div>

                  <div className={styles.actions}>
                    {!n.isRead && (
                      <button
                        className={styles.actionBtn}
                        title="Marquer comme lu"
                        onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                      >
                        <i className="fas fa-check" />
                      </button>
                    )}
                    <button
                      className={`${styles.actionBtn} ${styles.actionDel}`}
                      title="Supprimer"
                      onClick={e => { e.stopPropagation(); deleteOne(n.id); }}
                    >
                      <i className="fas fa-trash-can" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {hasMore && !isLoading && (
          <button className={styles.loadMore} onClick={loadMore}>
            <i className="fas fa-chevron-down" /> Voir plus de notifications
          </button>
        )}

        {isLoading && notifications.length > 0 && (
          <div className={styles.loadingMore}>
            <i className="fas fa-circle-notch fa-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
