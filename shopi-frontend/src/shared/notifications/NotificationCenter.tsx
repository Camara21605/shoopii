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

interface ItemProps {
  notif:    INotificationDto;
  onClick:  () => void;
  onDelete: () => void;
}

function NotificationItem({ notif, onClick, onDelete }: ItemProps) {
  const meta = getTypeMeta(notif.type);
  return (
    <div className={`${s.itemWrap}${notif.isRead ? '' : ` ${s.unread}`}`}>
      <button
        className={s.item}
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

      {/* Bouton supprimer — visible au survol, stopPropagation pour ne pas ouvrir la notif */}
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
// Priorité 1 : actionUrl fourni par le backend si c'est un chemin interne valide.
//   - On corrige les URLs obsolètes /commandes/* (pluriel) vers /commande/* (singulier)
//   - On corrige /dashboard/commandes/* vers /dashboard/entreprise
// Priorité 2 : fallback par type de notification si actionUrl est absent/externe.

function resolveNavTarget(notif: INotificationDto): string {
  const prefix = notif.type.split('.')[0];
  /* resourceId est le UUID de la commande. Fallback sur payload.commandeId
   * pour les notifications créées avant que la colonne resourceId existait. */
  const id = notif.resourceId ?? (notif.payload as Record<string, unknown> | null)?.commandeId as string | undefined ?? null;

  /* Commandes & paiements : toujours aller à la page de suivi de la commande.
   * La page /commande/:id/suivi lit le rôle depuis le token JWT et adapte
   * l'affichage (client, entreprise, livreur, correspondant) → tous les rôles
   * peuvent l'utiliser. On ignore actionUrl ici pour éviter que les entreprises
   * soient renvoyées vers le dashboard générique au lieu de la commande précise. */
  if ((prefix === 'order' || prefix === 'payment') && id) {
    return `/commande/${id}/suivi`;
  }

  let url = notif.actionUrl ?? '';

  /* Corriger les anciens actionUrl envoyés avant le fix backend :
   *   /commandes/{id}             → /commande/{id}/suivi
   *   /dashboard/commandes/{id}   → /dashboard/entreprise  */
  if (url.startsWith('/commandes/')) {
    const segId = url.split('/')[2];
    url = segId ? `/commande/${segId}/suivi` : '/commande';
  } else if (url.startsWith('/dashboard/commandes/')) {
    url = '/dashboard/entreprise';
  }

  /* Chemin interne valide → on l'utilise directement */
  if (url.startsWith('/')) return url;

  /* URL externe → le caller ouvre un nouvel onglet (géré dans handleItemClick) */
  if (url.startsWith('http')) return url;

  /* Fallback par préfixe de type quand actionUrl est absent */
  switch (prefix) {
    case 'order':
    case 'payment':
      return id ? `/commande/${id}/suivi` : '/commande';
    case 'delivery':
    case 'colis': {
      /* Pour delivery/colis : resourceId = ID de livraison (pas de commande).
       * commandeId se trouve dans le payload pour la redirection correcte. */
      const cmdId = ((notif.payload as Record<string, unknown> | null)?.commandeId as string | undefined) ?? null;
      return cmdId ? `/commande/${cmdId}/suivi` : '/home';
    }
    case 'message':
    case 'conversation':
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
