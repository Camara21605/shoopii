/* ============================================================
 * FICHIER : src/shared/notifications/NotificationCenter.tsx
 *
 * RÔLE : Bouton cloche + dropdown panneau de notifications.
 *
 * Utilise useNotifications() (NotificationContext) pour l'état.
 * Le bouton hérite des classes .tb-ic / .tb-ic-pin de Topbar.css
 * pour s'intégrer parfaitement dans la barre supérieure.
 * ============================================================ */

import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './NotificationContext';
import type { INotificationDto } from './types';
import s from './NotificationCenter.module.css';

// ─── Helpers ──────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1_000;
  if (diff < 60)         return 'À l\'instant';
  if (diff < 3_600)      return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400)     return `Il y a ${Math.floor(diff / 3_600)} h`;
  if (diff < 604_800)    return `Il y a ${Math.floor(diff / 86_400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Mapping type → icône FA + couleur de fond ────────────────

interface TypeMeta { icon: string; bg: string; color: string; }

function getTypeMeta(type: string): TypeMeta {
  const prefix = type.split('.')[0];
  const map: Record<string, TypeMeta> = {
    order:   { icon: 'fa-box',          bg: 'rgba(16,185,129,.12)',  color: '#059669' },
    message: { icon: 'fa-comment-dots', bg: 'rgba(22,82,240,.12)',   color: '#1652F0' },
    follow:  { icon: 'fa-user-plus',    bg: 'rgba(124,58,237,.12)',  color: '#7C3AED' },
    product: { icon: 'fa-heart',        bg: 'rgba(236,72,153,.12)',  color: '#DB2777' },
    promo:   { icon: 'fa-percent',      bg: 'rgba(245,158,11,.12)',  color: '#D97706' },
    payment: { icon: 'fa-credit-card',  bg: 'rgba(20,184,166,.12)',  color: '#0D9488' },
    review:  { icon: 'fa-star',         bg: 'rgba(245,158,11,.12)',  color: '#D97706' },
    stock:   { icon: 'fa-warehouse',    bg: 'rgba(239,68,68,.12)',   color: '#DC2626' },
    account: { icon: 'fa-user-check',   bg: 'rgba(16,185,129,.12)',  color: '#059669' },
  };
  return map[prefix] ?? { icon: 'fa-bell', bg: 'rgba(100,100,100,.1)', color: '#6B7280' };
}

// ─── NotificationItem ─────────────────────────────────────────

interface ItemProps { notif: INotificationDto; onClick: () => void; }

function NotificationItem({ notif, onClick }: ItemProps) {
  const meta = getTypeMeta(notif.type);
  return (
    <button
      className={`${s.item}${notif.isRead ? '' : ` ${s.unread}`}`}
      onClick={onClick}
    >
      {!notif.isRead && <span className={s.dot} aria-hidden />}

      <span
        className={s.iconWrap}
        style={{ background: meta.bg, color: meta.color }}
        aria-hidden
      >
        <i className={`fas ${meta.icon}`} />
      </span>

      <span className={s.content}>
        <span className={s.title}>
          {notif.title}
          {notif.count > 1 && <span style={{ fontWeight: 500, marginLeft: 4, opacity: .7 }}>({notif.count})</span>}
        </span>
        <span className={s.body}>{notif.body}</span>
        <span className={s.time}>{relativeTime(notif.createdAt)}</span>
      </span>
    </button>
  );
}

// ─── Résolution de la route interne à partir d'une notification ──

function resolveNavTarget(notif: INotificationDto): string {
  // actionUrl fourni par le backend et chemin interne → utilisation directe
  if (notif.actionUrl?.startsWith('/')) return notif.actionUrl;

  const prefix = notif.type.split('.')[0];
  const id     = notif.resourceId;

  switch (prefix) {
    case 'order':
    case 'payment':
      return id ? `/commande/${id}/suivi` : '/dashboard/client';
    case 'message':
      return '/messagerie';
    case 'product':
      return id ? `/produit/${id}` : '/boutiques';
    case 'promo':
      return '/boutiques';
    case 'review':
      return id ? `/produit/${id}` : '/home';
    case 'stock':
      return '/dashboard/entreprise';
    case 'account':
    case 'follow':
      return '/mon-profil';
    default:
      return '/home';
  }
}

// ─── NotificationCenter ───────────────────────────────────────

export default function NotificationCenter() {
  const navigate = useNavigate();
  const {
    unreadCount, notifications,
    isOpen, toggle, close,
    isLoading, hasMore, loadMore,
    markAsRead, markAllAsRead,
  } = useNotifications();

  const wrapRef = useRef<HTMLDivElement>(null);

  /* Fermer au clic extérieur */
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [isOpen, close]);

  /* Fermer sur Escape */
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isOpen, close]);

  function handleItemClick(notif: INotificationDto) {
    if (!notif.isRead) markAsRead(notif.id);
    close();

    // URL externe → nouvel onglet, sinon navigation interne
    if (notif.actionUrl && !notif.actionUrl.startsWith('/')) {
      window.open(notif.actionUrl, '_blank', 'noopener');
    } else {
      navigate(resolveNavTarget(notif));
    }
  }

  return (
    <div className={`${s.wrap} tb-ic-pin`} ref={wrapRef}>
      {/* ── Bouton cloche ── */}
      <button
        className="tb-ic"
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <i className="fas fa-bell" />
      </button>

      {/* ── Badge numérique ── */}
      {unreadCount > 0 && (
        <span className={s.badge} aria-hidden>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div
          className={s.panel}
          role="dialog"
          aria-label="Centre de notifications"
        >
          {/* En-tête */}
          <div className={s.header}>
            <span className={s.headerTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button className={s.markAll} onClick={markAllAsRead}>
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Corps */}
          <div className={s.list} role="list">
            {/* Chargement initial */}
            {isLoading && notifications.length === 0 && (
              <div className={s.loader} aria-live="polite">
                <i className="fas fa-circle-notch fa-spin" />
              </div>
            )}

            {/* État vide */}
            {!isLoading && notifications.length === 0 && (
              <div className={s.empty}>
                <i className="far fa-bell-slash" />
                <span>Aucune notification</span>
              </div>
            )}

            {/* Items */}
            {notifications.map(n => (
              <NotificationItem
                key={n.id}
                notif={n}
                onClick={() => handleItemClick(n)}
              />
            ))}

            {/* Chargement page suivante */}
            {isLoading && notifications.length > 0 && (
              <div className={s.loader}>
                <i className="fas fa-circle-notch fa-spin" />
              </div>
            )}
          </div>

          {/* Charger plus */}
          {hasMore && !isLoading && (
            <button className={s.loadMore} onClick={loadMore}>
              Charger plus
            </button>
          )}
        </div>
      )}
    </div>
  );
}
