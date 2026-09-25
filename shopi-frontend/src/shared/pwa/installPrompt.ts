/* ============================================================
 * FICHIER : src/shared/pwa/installPrompt.ts
 *
 * RÔLE : Capter la proposition d'installation de Chrome/Edge (évènement
 * `beforeinstallprompt`) pour la déclencher depuis notre propre bouton.
 *
 * Chrome n'émet cet évènement qu'UNE fois, souvent avant que React ne soit
 * monté : ce module est donc importé dès main.tsx et garde l'évènement en
 * mémoire. iPhone/iPad (Safari) n'ont pas cet évènement : on y affiche des
 * instructions (Partager → Sur l'écran d'accueil).
 * ============================================================ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                       // on garde la main sur le moment de l'affichage
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Le navigateur propose l'installation (Chrome/Edge/Samsung Internet, Android ou ordinateur). */
export function canInstall(): boolean { return deferred !== null; }

/** Application déjà lancée comme application installée. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Safari iPhone/iPad : pas d'évènement d'installation, geste manuel obligatoire. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV/.test(ua);
}

/** Ouvre la fenêtre d'installation du navigateur. Renvoie true si l'utilisateur accepte. */
export async function promptInstall(): Promise<boolean> {
  const ev = deferred;
  if (!ev) return false;
  deferred = null;                            // l'évènement n'est utilisable qu'une fois
  notify();
  try {
    await ev.prompt();
    return (await ev.userChoice).outcome === 'accepted';
  } catch { return false; }
}
