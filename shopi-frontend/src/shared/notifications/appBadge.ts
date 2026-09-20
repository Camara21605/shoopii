/* ============================================================
 * FICHIER : src/shared/notifications/appBadge.ts
 *
 * RÔLE : Pastille (compteur) sur l'icône de l'application installée.
 *
 * Deux sources STRICTEMENT INDÉPENDANTES, additionnées ici seulement pour
 * l'icône du téléphone :
 *   • 'notif' — notifications de la cloche (commandes, avis, stock…) ;
 *   • 'msg'   — messages non lus de l'onglet Messagerie.
 * Chacune garde son propre compteur dans l'interface (cloche d'un côté,
 * onglet Messagerie de l'autre) ; elles ne se mélangent jamais à l'écran.
 * Le service worker calcule la même somme côté serveur quand l'application
 * est fermée (voir MessagingPushService) : pas de saut de valeur à l'ouverture.
 * ============================================================ */

export type BadgeSource = 'notif' | 'msg';

const counts: Record<BadgeSource, number> = { notif: 0, msg: 0 };

function apply(): void {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const total = counts.notif + counts.msg;
    if (total > 0) void nav.setAppBadge?.(total);
    else void nav.clearAppBadge?.();
  } catch { /* Badging API non supportée : sans conséquence */ }
}

export function setBadgeSource(source: BadgeSource, value: number): void {
  const next = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  if (counts[source] === next) return;
  counts[source] = next;
  apply();
}

/** Déconnexion : plus rien à afficher sur l'icône. */
export function resetAppBadge(): void {
  counts.notif = 0;
  counts.msg   = 0;
  apply();
}
