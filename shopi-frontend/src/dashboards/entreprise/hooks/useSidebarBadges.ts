/* ============================================================
 * FICHIER : src/dashboards/entreprise/hooks/useSidebarBadges.ts
 *
 * RÔLE : badges "par onglet" de la sidebar entreprise — le nombre
 *        d'actions/événements que le propriétaire n'a PAS ENCORE VUS
 *        dans cette section précise (nouvelle commande, nouvel avis,
 *        stock critique…), pas un total ou une valeur inventée.
 *
 * BUG CORRIGÉ — jusqu'ici, chaque badge de Sidebar.tsx était une VALEUR
 * STATIQUE codée en dur dans le fichier ("14", "124", "6"…), identique
 * pour tout le monde et ne représentant aucune donnée réelle.
 *
 * SOURCE DE DONNÉES : réutilise le système de notifications déjà en
 * place (NotificationType, isRead) plutôt que d'inventer un mécanisme
 * de "lastSeenAt" par section — GET /notifications/unread-by-type
 * renvoie le nombre de non-lues PAR TYPE pour l'entreprise connectée ;
 * SIDEBAR_BADGE_TYPES fait la correspondance type(s) → onglet.
 *
 * Le badge d'un onglet se vide dès que l'utilisateur clique dessus
 * (PATCH /notifications/read-by-types) — pas seulement en ouvrant la
 * cloche de notifications globale (qui marque TOUT lu d'un coup,
 * comportement différent et toujours disponible séparément).
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useNotificationSocket } from '../../../shared/notifications/useNotificationSocket';

/** Onglet sidebar → NotificationType pertinents (voir notification.entitiy.ts
 *  côté backend pour la liste complète). Un onglet absent de cette map, ou
 *  ne listant QUE des types jamais réellement créés par un `.create()` côté
 *  backend, n'affiche simplement aucun badge, plutôt qu'un chiffre inventé —
 *  vérifié par grep sur chaque type avant ajout ici (voir historique).
 *
 * "livreurs" et "correspondants" sont volontairement ABSENTS : tous leurs
 * NotificationType (delivery.*, colis.*) existent dans l'enum et ont une
 * préférence par défaut, mais aucun n'est jamais créé nulle part dans le
 * backend — les afficher produirait un badge qui reste à 0 en permanence. */
export const SIDEBAR_BADGE_TYPES: Partial<Record<string, string[]>> = {
  commandes: [
    'order.placed', 'order.cancelled', 'order.refunded', 'order.status_changed',
  ],
  /* product.liked_agg/approved/rejected retirés — jamais créés (voir note ci-dessus). */
  produits: [
    'product.liked',
  ],
  /* product.out_of_stock/back_in_stock retirés — jamais créés ; stock.low/
   * stock.critical sont réels (voir products.scheduler.ts). */
  inventaire: [
    'stock.low', 'stock.critical',
  ],
  promotions: [
    'promo.active', 'promo.ending_soon', 'promo.ended', 'promo.used', 'promo.limit_reached',
  ],
  finances: [
    'payment.received', 'payment.failed', 'payment.refund_done',
  ],
  avis: [
    'review.received', 'review.replied',
  ],
  /* Demande de retour client — voir ReturnsService.createByClient()
   * → NotificationEventService.notifyReturnRequested(). */
  retours: [
    'return.requested',
  ],
  /* Prestation ajoutée aux favoris — voir ServiceFavorisService.toggle()
   * → NotificationEventService.notifyServiceLiked(). */
  services: [
    'service.liked',
  ],
};

export function useSidebarBadges() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    apiFetch<Record<string, number>>('/notifications/unread-by-type')
      .then(setCounts)
      .catch(() => { /* silencieux — pas de badge plutôt qu'une erreur visible */ });
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Mise à jour instantanée sans re-fetch complet : chaque notification
   * IN_APP créée arrive déjà via ce même socket (voir NotificationContext.
   * tsx pour le même pattern côté cloche globale). */
  useNotificationSocket({
    onNew: ({ notification }) => {
      setCounts(prev => ({ ...prev, [notification.type]: (prev[notification.type] ?? 0) + 1 }));
    },
  });

  /** Total non-lu pour l'onglet `sectionKey` — 0 si l'onglet n'a pas de
   *  NotificationType mappé (voir SIDEBAR_BADGE_TYPES). */
  const getBadge = useCallback((sectionKey: string): number => {
    const types = SIDEBAR_BADGE_TYPES[sectionKey];
    if (!types) return 0;
    return types.reduce((sum, t) => sum + (counts[t] ?? 0), 0);
  }, [counts]);

  /** Vide le badge de `sectionKey` — appelé au clic sur l'onglet. Optimiste
   *  (met à jour l'affichage tout de suite) + persiste côté serveur. */
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
