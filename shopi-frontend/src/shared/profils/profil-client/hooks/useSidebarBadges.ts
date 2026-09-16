/* ============================================================
 * FICHIER : profil-client/hooks/useSidebarBadges.ts
 *
 * RÔLE : badges "par onglet" de la barre d'onglets du profil client
 * (ProfilTabsClient.tsx) — même mécanisme que les dashboards
 * entreprise/livreur/correspondant (voir leurs useSidebarBadges.ts
 * respectifs) : GET /notifications/unread-by-type (scopé à l'acteur
 * CLIENT connecté) + socket temps réel, jamais de chiffre inventé.
 *
 *   - "orders"  → order.status_changed (mise à jour d'une commande —
 *                 déjà générique, déclenché pour un recipient CLIENT,
 *                 voir notifyOrderStatusChanged)
 *   - "returns" → return.status_changed (l'entreprise a statué sur une
 *                 demande de retour — voir ReturnsService.accept/
 *                 refuse/refund → notifyReturnStatusChanged)
 *   - "reviews" → review.replied (une boutique/un livreur/un
 *                 correspondant a répondu à un avis laissé par ce
 *                 client — voir AvisService/LivreurAvisService/
 *                 CorrespondantAvisService.repondre → notifyReviewReplied)
 *
 * "subs"/"favs"/"wishlist"/"activity" n'ont pas de NotificationType
 * pertinent (listes propres au client, rien à "voir arriver") — pas de
 * badge plutôt qu'un chiffre inventé.
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../services/apiFetch';
import { useNotificationSocket } from '../../../notifications/useNotificationSocket';

export const SIDEBAR_BADGE_TYPES: Partial<Record<string, string[]>> = {
  orders:  ['order.status_changed'],
  returns: ['return.status_changed'],
  reviews: ['review.replied'],
};

export function useSidebarBadges() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    apiFetch<Record<string, number>>('/notifications/unread-by-type')
      .then(setCounts)
      .catch(() => { /* silencieux — pas de badge plutôt qu'une erreur visible */ });
  }, []);

  useEffect(() => { load(); }, [load]);

  useNotificationSocket({
    onNew: ({ notification }) => {
      setCounts(prev => ({ ...prev, [notification.type]: (prev[notification.type] ?? 0) + 1 }));
    },
  });

  const getBadge = useCallback((sectionKey: string): number => {
    const types = SIDEBAR_BADGE_TYPES[sectionKey];
    if (!types) return 0;
    return types.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
  }, [counts]);

  /** Vide le badge de `sectionKey` au clic — optimiste + persisté côté serveur. */
  const clearBadge = useCallback((sectionKey: string) => {
    const types = SIDEBAR_BADGE_TYPES[sectionKey];
    if (!types || types.length === 0) return;
    const hasUnread = types.some(t => (counts[t] ?? 0) > 0);
    if (!hasUnread) return;

    setCounts(prev => {
      const next = { ...prev };
      types.forEach(t => { next[t] = 0; });
      return next;
    });
    apiFetch('/notifications/read-by-types', { method: 'PATCH', body: { types } }).catch(() => {
      // Échec silencieux — au pire le badge réapparaît au prochain fetch/socket
    });
  }, [counts]);

  return { getBadge, clearBadge };
}
