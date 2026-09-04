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

/** Nombre de notifications affichées dans le panneau déroulant — seule
 *  interface de notifications du site (pas de page dédiée séparée). */
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

export default function NotificationCenter() {
  const navigate = useNavigate();
  const {
    unreadCount, notifications,
    isOpen, toggle, close,
    isLoading,
    markAsRead, markAllAsRead, deleteOne,
  } = useNotifications();

  const wrapRef = useRef<HTMLDivElement>(null);

  /* Le marquage "tout lu" à l'ouverture est géré une seule fois dans
   * NotificationProvider (voir NotificationContext.tsx) — pas ici. Header.tsx
   * monte ce composant deux fois (barre desktop + mobile, l'une cachée en
   * CSS) ; le Provider, lui, n'existe qu'une fois, donc y centraliser cette
   * logique évite le double appel PATCH /notifications/read-all à chaque
   * ouverture du panneau. */

  /* Exclure les notifications de type message.* — leur badge va sur le bouton messagerie */
  const visibleNotifs = notifications.filter(n => !n.type.startsWith('message'));
  const displayCount  = visibleNotifs.filter(n => !n.isRead).length;
  /* Avant le premier chargement de la liste, on tombe sur displayCount=0 même si
   * unreadCount > 0 (liste vide). On utilise unreadCount comme fallback. */
  const badgeCount = notifications.length > 0 ? displayCount : unreadCount;

  /* Fermer au clic extérieur.
   *
   * BUG CORRIGÉ — Header.tsx monte DEUX <NotificationCenter /> en
   * permanence (barre desktop + barre mobile, l'une des deux cachée via
   * `display:none` CSS selon la largeur d'écran) qui partagent le même
   * `isOpen` (contexte). Avec `wrapRef.current?.contains(e.target)`, un
   * clic à l'intérieur du panneau VISIBLE était vu comme "extérieur" par
   * l'instance CACHÉE (son wrapRef à elle ne contient jamais rien de ce
   * qui est cliqué) → elle appelait close() sur l'état partagé et fermait
   * le panneau avant que le clic (suppression / redirection) n'ait eu le
   * temps de s'exécuter. On vérifie maintenant via `closest()` sur un
   * attribut partagé par TOUTES les instances plutôt que sur une ref
   * propre à celle-ci. */
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('[data-notif-wrap]')) close();
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

  const previewNotifs = visibleNotifs.slice(0, PREVIEW_LIMIT);

  return (
    <div className={s.wrap} ref={wrapRef} data-notif-wrap>
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

            {/* Items — aperçu limité aux PREVIEW_LIMIT plus récents */}
            {previewNotifs.map(n => (
              <NotificationItem
                key={n.id}
                notif={n}
                onClick={() => handleItemClick(n)}
                onDelete={() => deleteOne(n.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
