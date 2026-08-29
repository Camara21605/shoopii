/* ============================================================
 * FICHIER : src/shared/notifications/notificationUtils.ts
 *
 * RÔLE : Logique partagée entre le panneau déroulant
 *        (NotificationCenter) et la page complète
 *        (NotificationsPage) — un seul endroit pour l'icône/couleur
 *        par type, le temps relatif et la résolution de la route
 *        cible d'une notification.
 * ============================================================ */

import type { INotificationDto } from './types';

// ─── Temps relatif ("Il y a 5 min") ────────────────────────────

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1_000;
  if (diff < 60)      return 'À l\'instant';
  if (diff < 3_600)   return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400)  return `Il y a ${Math.floor(diff / 3_600)} h`;
  if (diff < 604_800) return `Il y a ${Math.floor(diff / 86_400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Mapping type → icône FA + couleur ─────────────────────────

export interface TypeMeta { icon: string; bg: string; color: string; }

const TYPE_META_MAP: Record<string, TypeMeta> = {
  order:      { icon: 'fa-box',          bg: 'rgba(16,185,129,.12)', color: '#059669' },
  message:    { icon: 'fa-comment-dots', bg: 'rgba(22,82,240,.12)',  color: '#1652F0' },
  follow:     { icon: 'fa-user-plus',    bg: 'rgba(124,58,237,.12)', color: '#7C3AED' },
  product:    { icon: 'fa-heart',        bg: 'rgba(236,72,153,.12)', color: '#DB2777' },
  promo:      { icon: 'fa-percent',      bg: 'rgba(245,158,11,.12)', color: '#D97706' },
  payment:    { icon: 'fa-credit-card',  bg: 'rgba(20,184,166,.12)', color: '#0D9488' },
  review:     { icon: 'fa-star',         bg: 'rgba(245,158,11,.12)', color: '#D97706' },
  stock:      { icon: 'fa-warehouse',    bg: 'rgba(239,68,68,.12)',  color: '#DC2626' },
  account:    { icon: 'fa-user-check',   bg: 'rgba(16,185,129,.12)', color: '#059669' },
  call:       { icon: 'fa-phone',        bg: 'rgba(22,82,240,.12)',  color: '#1652F0' },
  group_call: { icon: 'fa-phone',        bg: 'rgba(22,82,240,.12)',  color: '#1652F0' },
};

export function getTypeMeta(type: string): TypeMeta {
  const prefix = type.split('.')[0];
  return TYPE_META_MAP[prefix] ?? { icon: 'fa-bell', bg: 'rgba(100,100,100,.1)', color: '#6B7280' };
}

/** Catégories utilisées pour les filtres de la page complète — un sous-
 *  ensemble lisible des préfixes de type ci-dessus (regroupe order+delivery
 *  sous "commandes", etc.). */
export type NotifCategory = 'all' | 'unread' | 'order' | 'message' | 'product' | 'promo' | 'account';

export function categoryOf(type: string): NotifCategory {
  const prefix = type.split('.')[0];
  if (prefix === 'order' || prefix === 'delivery' || prefix === 'colis' || prefix === 'payment') return 'order';
  if (prefix === 'message' || prefix === 'conversation' || prefix === 'call' || prefix === 'group_call') return 'message';
  if (prefix === 'product' || prefix === 'stock' || prefix === 'review') return 'product';
  if (prefix === 'promo') return 'promo';
  if (prefix === 'account' || prefix === 'follow' || prefix === 'support' || prefix === 'system') return 'account';
  return 'account';
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

export function resolveNavTarget(notif: INotificationDto): string {
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

  // ── 3. Messages / conversations / appels (1:1 et groupe) → messagerie ─
  if (prefix === 'message' || prefix === 'conversation' || prefix === 'call' || prefix === 'group_call') {
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

  /* URL externe → le caller ouvre un nouvel onglet (géré par l'appelant) */
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
