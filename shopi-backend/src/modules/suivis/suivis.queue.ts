/* ============================================================
 * FICHIER : src/modules/suivis/suivis.queue.ts
 *
 * Constantes de la file d'attente BullMQ pour les suivis.
 *
 * Pourquoi BullMQ ?
 * -----------------
 * Lorsqu'un acteur clique "Suivre", on veut que la réponse
 * soit IMMÉDIATE (action synchrone en base).
 *
 * En revanche, les opérations lourdes (envoi de notifications
 * push/email, mise à jour du feed, stats de followers) sont
 * confiées à BullMQ pour ne pas bloquer la réponse HTTP.
 *
 * Flux complet :
 *   1. HTTP POST  → INSERT dans follows (synchrone, <10ms)
 *   2. WebSocket  → notification temps réel à la cible
 *   3. BullMQ job → notifications push/email, stats (async)
 * ============================================================ */

/** Nom de la queue BullMQ — doit correspondre à @InjectQueue() */
export const SUIVIS_QUEUE = 'suivis';

/**
 * Types de jobs disponibles dans la queue.
 * Chaque job est traité indépendamment par le processor.
 */
export const SUIVIS_JOBS = {

  /**
   * Envoyer une notification push/email à la cible.
   * Déclenché quand quelqu'un suit un acteur.
   */
  NOTIFY_FOLLOWED:   'notify-followed',

  /**
   * Envoyer une notification quand quelqu'un se désabonne.
   * (optionnel selon la config de l'utilisateur)
   */
  NOTIFY_UNFOLLOWED: 'notify-unfollowed',

  /**
   * Mettre à jour le compteur de followers en cache Redis.
   * Evite des COUNT(*) SQL à chaque affichage de profil.
   */
  UPDATE_FOLLOW_COUNT: 'update-follow-count',

  /**
   * Mettre à jour le feed social du follower.
   * Le feed affiche les dernières activités des acteurs suivis.
   */
  UPDATE_FEED: 'update-feed',

} as const;

// ─── Types TypeScript pour la payload des jobs ────────────────

export interface FollowJobPayload {
  /** UUID du profil qui suit (ex: client.id) */
  followerId:    string;
  followerType:  string;
  /** Nom/display du follower (pour le message de notif) */
  followerName:  string;

  /** UUID du profil suivi */
  targetId:      string;
  targetType:    string;
  /** userId de la cible (pour le WebSocket + notif) */
  targetUserId:  string;
  /** Nom de la cible */
  targetName:    string;

  /** UUID de la ligne Follow créée */
  followId:      string;

  /** Timestamp de l'action */
  timestamp:     string;
}