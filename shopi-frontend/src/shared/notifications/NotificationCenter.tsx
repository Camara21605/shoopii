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
    call:    { icon: 'fa-phone',        bg: 'rgba(22,82,240,.12)',   color: '#1652F0' },
  };
  return map[prefix] ?? { icon: 'fa-bell', bg: 'rgba(100,100,100,.1)', color: '#6B7280' };
}

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

// ─── Résolution de la route interne à partir d'une notification ──
//
// Logique par priorité :
//   1. Types "ordre" et "livraison" → toujours /commande/{id}/suivi
//   2. Messages/conversations → toujours /messagerie
//   3. product.liked → toujours /dashboard/entreprise/produits
//   4. Paiements liés à une commande → /commande/{id}/suivi
//   5. Tous les autres → actionUrl fourni par le backend (déjà correct par rôle)
//   6. Fallback si actionUrl absent/invalide

function resolveNavTarget(notif: INotificationDto): string {
  const type    = notif.type;
  const prefix  = type.split('.')[0];
  const payload = notif.payload as Record<string, unknown> | null;
  /* resourceId = UUID de la ressource principale (commande, produit, livraison…) */
  const resId   = notif.resourceId ?? null;
  /* commandeId peut être dans payload quand resourceId pointe vers autre chose */
  const cmdId   = (payload?.commandeId as string | undefined) ?? null;
  const url     = notif.actionUrl ?? '';

  // ── 1. Commandes → suivi (resourceId = commandeId) ─────────────
  if (prefix === 'order') {
    return resId ? `/commande/${resId}/suivi` : '/home';
  }

  // ── 2. Livraisons → suivi (commandeId dans payload) ────────────
  if (prefix === 'delivery' || prefix === 'colis') {
    return cmdId
      ? `/commande/${cmdId}/suivi`
      : resId ? `/commande/${resId}/suivi` : '/home';
  }

  // ── 3. Messages / conversations / appels → messagerie ───────────
  if (prefix === 'message' || prefix === 'conversation' || prefix === 'call') {
    return '/messagerie';
  }

  // ── 4. Produit liké → dashboard entreprise (récepteur = entreprise) ─
  if (type === 'product.liked' || type === 'product.liked_agg') {
    return '/dashboard/entreprise/produits';
  }

  // ── 5. Paiements → suivi si lié à une commande, sinon actionUrl ─
  if (prefix === 'payment') {
    if (cmdId) return `/commande/${cmdId}/suivi`;
    // Sinon on laisse tomber vers l'étape 6 (actionUrl du backend)
  }

  // ── 6. Tous les autres types → on suit l'actionUrl du backend ───
  //    Le backend envoie maintenant des URLs correctes par rôle.
  if (url.startsWith('/')) {
    /* Corriger les vieilles URLs envoyées avant le fix backend */
    if (url.startsWith('/commandes/')) {
      const seg = url.split('/')[2];
      return seg ? `/commande/${seg}/suivi` : '/home';
    }
    if (url.startsWith('/dashboard/commandes/')) {
      return '/dashboard/entreprise/commandes';
    }
    return url;
  }

  /* URL externe → le caller ouvre un nouvel onglet (géré dans handleItemClick) */
  if (url.startsWith('http')) return url;

  // ── 7. Fallback quand actionUrl est absent ──────────────────────
  switch (prefix) {
    case 'payment':
      return resId ? `/commande/${resId}/suivi` : '/home';
    case 'product':
      return resId ? `/produit/${resId}` : '/boutiques';
    case 'follow':
      return '/home';
    case 'promo':
      return '/boutiques';
    case 'review':
      return '/home';
    case 'stock':
      return '/dashboard/entreprise/inventaire';
    case 'account':
      return '/home';
    case 'support':
      return '/aide';
    case 'system':
      return '/home';
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

    /* Log temporaire — à supprimer après diagnostic */
    console.log('[NotifDebug] clic notification', {
      id:         notif.id,
      type:       notif.type,
      resourceId: notif.resourceId,
      actionUrl:  notif.actionUrl,
      payload:    notif.payload,
    });

    /* Résoudre d'abord l'URL cible (corrections + fallback par type),
     * puis décider si c'est une navigation interne ou un lien externe. */
    const target = resolveNavTarget(notif);
    console.log('[NotifDebug] → navigation vers :', target);

    if (target.startsWith('http')) {
      window.open(target, '_blank', 'noopener');
    } else {
      navigate(target);
    }
  }

  return (
    <div className={`${s.wrap} tb-ic-pin`} ref={wrapRef}>
      {/* ── Bouton cloche ── */}
      <button
        className="tb-ic"
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

            {/* Items */}
            {visibleNotifs.map(n => (
              <NotificationItem
                key={n.id}
                notif={n}
                onClick={() => handleItemClick(n)}
                onDelete={() => deleteOne(n.id)}
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
