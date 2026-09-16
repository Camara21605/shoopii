/* ============================================================
 * FICHIER : src/dashboards/livreur/hooks/useSidebarBadges.ts
 *
 * RÔLE : badges "par onglet" de la sidebar livreur — même mécanisme
 * que src/dashboards/entreprise/hooks/useSidebarBadges.ts (dupliqué
 * plutôt que généralisé, cohérent avec les autres miroirs de ce
 * repo — chaque dashboard a ses propres onglets et sa propre carte
 * type → onglet, pas de bénéfice à les coupler).
 *
 * SOURCE DE DONNÉES : /notifications/unread-by-type (comptage par
 * NotificationType pour l'acteur DELIVERY connecté) + socket temps réel.
 *
 * Un onglet absent de SIDEBAR_BADGE_TYPES, ou ne listant QUE des types
 * jamais réellement créés côté backend, n'affiche simplement aucun
 * badge plutôt qu'un chiffre inventé — vérifié par grep sur chaque
 * type avant ajout ici :
 *
 *   - "missions" : le seul type disponible aujourd'hui pour une
 *     nouvelle mission est NotificationType.SYSTEM_ANNOUNCEMENT
 *     (notifyMissionAvailable, voir notification-event.service.ts) —
 *     un type générique partagé avec d'autres annonces système sans
 *     rapport, donc impossible à filtrer proprement par onglet. Un
 *     futur MISSION_AVAILABLE dédié réglerait ça.
 *   - "evaluation" : réel depuis l'ajout du système d'avis livreur —
 *     voir LivreurAvis entity + CommandeFeedbackService.envoyerNotations
 *     (traite désormais aussi la note "livreur", pas seulement
 *     "entreprise") → NotificationEventService.notifyLivreurReviewReceived.
 *   - "encours" a déjà un badge réel mais non lié aux notifications
 *     (nombre de missions actives, voir LivreurApp.tsx) — laissé tel
 *     quel, ne pas dupliquer ici.
 *   - "overview", "historique", "boutiques", "zone", "parametres" :
 *     aucun NotificationType pertinent n'existe.
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import { useNotificationSocket } from '../../../shared/notifications/useNotificationSocket';

export const SIDEBAR_BADGE_TYPES: Partial<Record<string, string[]>> = {
  /* Crédit/débit portefeuille + statut de retrait — génériques côté
   * backend (notifyWalletOperation/notifyWithdrawalStatus), déjà
   * déclenchés pour un wallet DELIVERY (voir wallet.subscriber.ts). */
  revenus: ['payment.received', 'payment.sent', 'payment.failed'],
  /* Avis client sur une livraison — voir LivreurAvisModule
   * (GET /dashboard/livreur/avis) pour la page qui affiche ces avis. */
  evaluation: ['review.received'],
};

export function useSidebarBadges() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    apiFetch<Record<string, number>>('/notifications/unread-by-type')
      .then(setCounts)
      .catch(() => { /* silencieux — pas de badge plutôt qu'une erreur visible */ });
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Mise à jour instantanée sans re-fetch complet — même pattern que le
   * dashboard entreprise (voir NotificationContext.tsx pour la cloche). */
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
