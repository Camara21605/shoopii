/* ============================================================
 * FICHIER : src/shared/utils/newVersion.ts
 *
 * RÔLE : Passer tout seul à la nouvelle version du site quand l'ancienne,
 * encore ouverte ou en cache, réclame un fichier qui n'existe plus.
 *
 * POURQUOI : chaque page est chargée à la demande (lazy) depuis un fichier au
 * nom unique (ex. Login-BH-7HgkH.js). Un déploiement remplace ces fichiers :
 * un navigateur resté sur l'ancienne version demande alors un fichier supprimé
 * → « Failed to fetch dynamically imported module » → « Une erreur est
 * survenue », et seule une actualisation manuelle chargeait la bonne version.
 *
 * GARDE-FOUS :
 *   - un seul rechargement automatique par tranche de 30 s (jamais de boucle
 *     si le fichier manque réellement) ;
 *   - jamais pendant un appel en cours (verrou « shoneya-active-call », voir
 *     callBackgroundGuard) : l'appel serait coupé.
 * ============================================================ */

const RELOAD_KEY = 'shoneya_new_version_reload_at';
const MIN_GAP_MS = 30_000;

/** Erreur de chargement d'un fichier de page/script devenu introuvable (nouvelle version déployée). */
export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError|Loading (CSS )?chunk \S+ failed/i.test(msg);
}

async function callInProgress(): Promise<boolean> {
  try {
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks?.query) return false;
    const { held = [] } = await locks.query();
    return held.some(l => l.name === 'shoneya-active-call');
  } catch { return false; }
}

/**
 * Recharge la page sur la nouvelle version. Renvoie false si le rechargement est
 * refusé (déjà tenté il y a moins de 30 s, ou appel en cours) : l'appelant affiche
 * alors son message habituel.
 */
export async function reloadToNewVersion(): Promise<boolean> {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
  } catch { /* stockage indisponible : on tente quand même, une fois */ }
  if (await callInProgress()) return false;

  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* sans conséquence */ }
  /* Le service worker récupère la nouvelle version avant le rechargement (sinon il resservirait l'ancienne page) */
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await Promise.race([reg?.update(), new Promise(r => setTimeout(r, 3000))]);
  } catch { /* hors ligne / pas de service worker */ }
  window.location.reload();
  return true;
}

/** À appeler une fois au démarrage : couvre les échecs de pré-chargement signalés par Vite. */
export function installNewVersionRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();          // on gère nous-mêmes : pas d'erreur non rattrapée
    void reloadToNewVersion();
  });
}
