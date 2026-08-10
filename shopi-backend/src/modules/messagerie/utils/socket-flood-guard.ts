/* ============================================================
 * FICHIER : src/modules/messagerie/utils/socket-flood-guard.ts
 *
 * RÔLE : Garde-fou anti-flood léger, en mémoire, pour les événements
 * Socket.IO à haute fréquence (signalisation WebRTC notamment) où un
 * rate-limit Redis serait à la fois inutilement coûteux (round-trip
 * réseau sur un chemin critique en latence) et mal adapté (l'objectif
 * ici est de repérer UNE connexion qui flood, pas de coordonner entre
 * plusieurs instances du serveur).
 *
 * Fenêtre fixe (pas de sliding window) : suffisant pour détecter un
 * abus soutenu sans la complexité d'un algorithme de fenêtre glissante,
 * et volontairement généreux (voir les valeurs passées par les
 * appelants) pour ne jamais couper une négociation WebRTC légitime —
 * un appel normal reste très en dessous de ces seuils.
 *
 * `allow()` ne lève jamais d'exception : l'appelant doit décider quoi
 * faire d'un flood détecté (ignorer silencieusement l'événement est le
 * choix fait partout où ce garde-fou est utilisé, jamais déconnecter —
 * un burst légitime ne doit jamais faire tomber un appel en cours).
 * ============================================================ */

interface Counter {
  count:   number;
  resetAt: number;
}

export class SocketFloodGuard {
  private readonly counters = new Map<string, Counter>();
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60_000) {
    /* Purge périodique des compteurs expirés — sans ça, chaque
     * (bucket, clé) vu au moins une fois resterait en mémoire pour
     * toujours (fuite lente sur un process long-running). */
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  /**
   * @param bucket   catégorie d'événement (ex. 'signal', 'membership')
   * @param key      identifiant de la source (socket.id ou userId selon le besoin)
   * @param max      nombre d'appels autorisés par fenêtre
   * @param windowMs durée de la fenêtre en ms
   * @returns true si l'appel est autorisé, false si le seuil est dépassé
   */
  allow(bucket: string, key: string, max: number, windowMs: number): boolean {
    const mapKey = `${bucket}:${key}`;
    const now    = Date.now();
    const entry  = this.counters.get(mapKey);

    if (!entry || now > entry.resetAt) {
      this.counters.set(mapKey, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count += 1;
    return entry.count <= max;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.counters) {
      if (entry.resetAt < now) this.counters.delete(key);
    }
  }

  /** Pour les tests — libère le timer de nettoyage. */
  destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
