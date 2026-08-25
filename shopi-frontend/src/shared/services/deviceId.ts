/* ============================================================
 * FICHIER : src/shared/services/deviceId.ts
 *
 * RÔLE : Identifiant d'appareil persistant, généré une seule fois
 *   côté client et réutilisé à chaque connexion — sert au backend
 *   (SessionService) pour la gestion de session unique par
 *   utilisateur.
 *
 * IMPORTANT (voir mission §5) : ce n'est PAS une preuve d'identité.
 *   Un utilisateur malveillant peut le falsifier ou le supprimer —
 *   le backend ne s'en sert que comme métadonnée informative (quel
 *   "appareil" a ouvert quelle session), jamais comme mécanisme de
 *   sécurité. La sécurité réelle vient du sessionId signé dans le
 *   JWT et vérifié côté serveur (Redis), pas du deviceId.
 * ============================================================ */

const DEVICE_ID_KEY = 'shopi_device_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Repli pour environnements sans crypto.randomUUID (très ancien navigateur).
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Retourne l'identifiant d'appareil persistant, en le créant si absent. */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateId();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // localStorage indisponible (navigation privée stricte, etc.) —
    // identifiant volatile pour cette session d'onglet uniquement.
    return generateId();
  }
}
