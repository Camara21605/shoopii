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
import { relativeTime, getTypeMeta, resolveNavTarget } from './notificationUtils';
import s from './NotificationCenter.module.css';

/** Nombre de notifications affichées dans l'aperçu déroulant — la liste
 *  complète (avec filtres, recherche et pagination) vit sur la page
 *  dédiée, ouverte via le bouton "Voir tout" en pied de panneau. */
const PREVIEW_LIMIT = 8;

// ─── NotificationItem ─────────────────────────────────────────

interface ItemProps {
  notif:    INotificationDto;
  onClick:  () => void;
  onDelete: () => void;
}

function NotificationItem({ notif, onClick, onDelete }: ItemProps) {
  const meta    = getTypeMeta(notif.type);
  const initial = notif.title.charAt(0).toUpperCase();

  return (
    <div className={`${s.itemWrap}${notif.isRead ? '' : ` ${s.unread}`}`}>
      <button className={s.item} onClick={onClick}>
        {!notif.isRead && <span className={s.dot} aria-hidden />}

        {/* ── Avatar acteur + badge type (style Facebook) ── */}
        <span className={s.avatarWrap} aria-hidden>
          {notif.imageUrl
            ? <img src={notif.imageUrl} alt="" className={s.avatarImg} />
            : <span className={s.avatarInitial} style={{ background: meta.bg, color: meta.color }}>
                {initial}
              </span>
          }
          <span className={s.typeBadge} style={{ background: meta.color }}>
            <i className={`fas ${meta.icon}`} />
          </span>
        </span>

        <span className={s.content}>
          <span className={s.title}>
            {notif.title}
            {notif.count > 1 && <span style={{ fontWeight: 500, marginLeft: 4, opacity: .7 }}>({notif.count})</span>}
          </span>
          <span className={s.body}>{notif.body}</span>
          <span className={s.time} style={notif.isRead ? undefined : { color: meta.color }}>
            {relativeTime(notif.createdAt)}
          </span>
        </span>
      </button>

      <button
        className={s.deleteBtn}
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Supprimer"
        aria-label="Supprimer la notification"
      >
        <i className="fas fa-xmark" />
      </button>
    </div>
  );
}

// ─── NotificationCenter ───────────────────────────────────────

interface NotificationCenterProps {
  /** Navigation vers la page complète des notifications — fournie par les
   *  dashboards internes (activePage, pas de react-router). Sans ce prop
   *  (site public), le clic sur "Voir tout" navigue vers /notifications. */
  onSeeAll?: () => void;
}

export default function NotificationCenter({ onSeeAll }: NotificationCenterProps = {}) {
  const navigate = useNavigate();
  const {
    unreadCount, notifications,
    isOpen, toggle, close,
    isLoading,
    markAsRead, markAllAsRead, deleteOne,
  } = useNotifications();

  const wrapRef = useRef<HTMLDivElement>(null);

  /* Ref pour ne marquer qu'une seule fois par session d'ouverture du panneau.
   * Reset à false quand le panneau se referme, pour que la prochaine ouverture
   * déclenche à nouveau le marquage. */
  const markedThisSessionRef = useRef(false);

  /* Quand le panneau s'ouvre et que les données sont prêtes → tout marquer comme lu.
   * Si les données sont encore en cours de chargement (1ère ouverture), l'effet se
   * déclenche à nouveau quand isLoading passe à false. */
  useEffect(() => {
    if (!isOpen) {
      markedThisSessionRef.current = false;
      return;
    }
    if (!isLoading && !markedThisSessionRef.current) {
      markedThisSessionRef.current = true;
      markAllAsRead();
    }
  }, [isOpen, isLoading, markAllAsRead]);

  /* Exclure les notifications de type message.* — leur badge va sur le bouton messagerie */
  const visibleNotifs = notifications.filter(n => !n.type.startsWith('message'));
  const displayCount  = visibleNotifs.filter(n => !n.isRead).length;
  /* Avant le premier chargement de la liste, on tombe sur displayCount=0 même si
   * unreadCount > 0 (liste vide). On utilise unreadCount comme fallback. */
  const badgeCount = notifications.length > 0 ? displayCount : unreadCount;

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

    /* Résoudre d'abord l'URL cible (corrections + fallback par type),
     * puis décider si c'est une navigation interne ou un lien externe. */
    const target = resolveNavTarget(notif);
    if (target.startsWith('http')) {
      window.open(target, '_blank', 'noopener');
    } else {
      navigate(target);
    }
  }

  /** "Voir tout" — page dédiée. Dashboards internes (activePage) passent
   *  `onSeeAll` ; le site public navigue via react-router. */
  function goToNotificationsPage() {
    close();
    if (onSeeAll) onSeeAll();
    else navigate('/notifications');
  }

  const previewNotifs = visibleNotifs.slice(0, PREVIEW_LIMIT);

  return (
    <div className={s.wrap} ref={wrapRef}>
      {/* ── Bouton cloche ──
          `tb-ic-pin` doit être sur le bouton lui-même (pas sur ce wrapper) :
          en mobile, Topbar.css cache tout `.tb-ic` sans `.tb-ic-pin` et
          dimensionne `.tb-ic-pin` en 44×44px pour la cible tactile — mis
          sur le wrapper, ces règles ratent la cloche (cachée) et
          redimensionnent une boîte vide, décalant le badge. */}
      <button
        className="tb-ic tb-ic-pin"
        title="Notifications"
        aria-label={`Notifications${badgeCount > 0 ? ` (${badgeCount} non lues)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <i className="fas fa-bell" />
      </button>

      {/* ── Badge numérique — masqué quand le panneau est ouvert ── */}
      {badgeCount > 0 && !isOpen && (
        <span className={s.badge} aria-hidden>
          {badgeCount > 99 ? '99+' : badgeCount}
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
            {displayCount > 0 && (
              <button className={s.markAll} onClick={markAllAsRead}>
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Corps */}
          <div className={s.list} role="list">
            {/* Chargement initial */}
            {isLoading && visibleNotifs.length === 0 && (
              <div className={s.loader} aria-live="polite">
                <i className="fas fa-circle-notch fa-spin" />
              </div>
            )}

            {/* État vide */}
            {!isLoading && visibleNotifs.length === 0 && (
              <div className={s.empty}>
                <i className="far fa-bell-slash" />
                <span>Aucune notification</span>
              </div>
            )}

            {/* Items — aperçu limité, la liste complète vit sur la page dédiée */}
            {previewNotifs.map(n => (
              <NotificationItem
                key={n.id}
                notif={n}
                onClick={() => handleItemClick(n)}
                onDelete={() => deleteOne(n.id)}
              />
            ))}
          </div>

          {/* Voir tout — ouvre la page complète (filtres, recherche, pagination) */}
          {visibleNotifs.length > 0 && (
            <button className={s.loadMore} onClick={goToNotificationsPage}>
              Voir toutes les notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}
