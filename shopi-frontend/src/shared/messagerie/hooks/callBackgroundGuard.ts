/* ============================================================
 * FICHIER : src/shared/messagerie/hooks/callBackgroundGuard.ts
 *
 * RÔLE : Faire survivre un appel quand l'écran du téléphone se met en veille
 * ou s'éteint. Écran éteint, le navigateur passe la page en arrière-plan :
 * il ralentit ses minuteurs, peut la GELER, et Android peut reprendre le
 * micro — l'appel se coupait alors des deux côtés.
 *
 * Quatre protections, actives seulement PENDANT un appel connecté :
 *   1. Screen Wake Lock — l'écran ne se met plus en veille tout seul
 *      (comme pendant une visioconférence). Relâché par le navigateur dès
 *      que la page est masquée : on le redemande au retour.
 *   2. Web Lock — une page qui détient un verrou Web n'est pas gelée par
 *      Chrome (exemption documentée du cycle de vie des pages).
 *   3. Media Session — déclare une lecture audio en cours : Android affiche
 *      la commande « Raccrocher » sur l'écran verrouillé et garde la page
 *      active comme pour de la musique / un appel.
 *   4. Minuteur dans un Worker (createTicker) — les minuteurs d'un Worker ne
 *      sont pas ralentis comme ceux d'une page masquée : le signal de vie
 *      envoyé au serveur (call:keepalive) reste régulier.
 *
 * Chaque protection est facultative : navigateur qui ne la supporte pas →
 * ignorée sans erreur. Aucune ne peut empêcher un appel de fonctionner.
 * ============================================================ */

export interface CallGuardOptions {
  /** Nom de l'interlocuteur (titre de la commande sur l'écran verrouillé). */
  title:    string;
  avatar?:  string | null;
  /** Bouton « Raccrocher » de l'écran verrouillé. */
  onHangUp: () => void;
  /** Retour au premier plan : envoyer un signal de vie, récupérer le micro… */
  onResume: () => void;
}

export interface CallGuard {
  stop: () => void;
}

export function startCallBackgroundGuard(options: CallGuardOptions): CallGuard {
  let stopped = false;

  /* 1) Écran allumé ─────────────────────────────────────────── */
  let sentinel: WakeLockSentinel | null = null;
  const acquireWakeLock = async () => {
    try {
      if (stopped || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      if (sentinel && !sentinel.released) return;
      sentinel = await navigator.wakeLock.request('screen');
    } catch { /* refusé (économie de batterie…) : sans conséquence */ }
  };

  /* 2) Page non gelée ───────────────────────────────────────── */
  let releaseWebLock: (() => void) | null = null;
  try {
    if ('locks' in navigator) {
      void navigator.locks
        .request('shoneya-active-call', () => new Promise<void>((resolve) => { releaseWebLock = resolve; }))
        .catch(() => { /* verrou refusé : sans conséquence */ });
    }
  } catch { /* API absente */ }

  /* 3) Lecture audio déclarée ───────────────────────────────── */
  const setupMediaSession = () => {
    try {
      const session = navigator.mediaSession;
      if (!session) return;
      session.metadata = new MediaMetadata({
        title:   options.title || 'Appel Shoneya',
        artist:  'Appel en cours',
        artwork: options.avatar && /^https:\/\//.test(options.avatar) ? [{ src: options.avatar }] : [],
      });
      session.playbackState = 'playing';
      try { session.setActionHandler('hangup' as MediaSessionAction, () => options.onHangUp()); } catch { /* action non supportée */ }
    } catch { /* API absente */ }
  };

  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    void acquireWakeLock();       // le navigateur a relâché le verrou d'écran à la mise en veille
    options.onResume();
  };
  document.addEventListener('visibilitychange', onVisibility);

  void acquireWakeLock();
  setupMediaSession();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try { void sentinel?.release(); } catch { /* déjà relâché */ }
      sentinel = null;
      releaseWebLock?.();
      releaseWebLock = null;
      try {
        const session = navigator.mediaSession;
        if (session) {
          session.playbackState = 'none';
          session.metadata = null;
          try { session.setActionHandler('hangup' as MediaSessionAction, null); } catch { /* non supportée */ }
        }
      } catch { /* API absente */ }
    },
  };
}

/* ── Minuteur régulier, y compris page en arrière-plan ─────────── */

/**
 * Appelle `fn` toutes les `everyMs` ms. Le minuteur vit dans un Worker dédié :
 * contrairement à setInterval d'une page masquée (ralenti à 1 fois par seconde,
 * puis à 1 fois par minute), il reste régulier. Repli sur setInterval si les
 * Workers sont indisponibles (CSP, navigateur ancien).
 */
export function createTicker(fn: () => void, everyMs: number): () => void {
  try {
    const code = `let t = setInterval(() => postMessage(0), ${Math.max(1000, Math.floor(everyMs))}); onmessage = () => { clearInterval(t); close(); };`;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = () => fn();
    return () => { try { worker.postMessage(0); worker.terminate(); } catch { /* déjà arrêté */ } };
  } catch {
    const id = setInterval(fn, everyMs);
    return () => clearInterval(id);
  }
}
