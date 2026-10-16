/* ============================================================
 * FICHIER : src/shared/pwa/nativeApp.ts
 *
 * Application mobile Shoneya (Android, native — pas la PWA).
 *   - Play Store : https://play.google.com/store/apps/details?id=com.shoneya.app
 *   - APK direct (optionnel) : VITE_ANDROID_APK_URL — pour les téléphones sans
 *     Play Store ou pour qui préfère le fichier (partage Xender, Bluetooth…).
 *
 * « Ouvrir / Installer » passe par un lien intent:// d'Android : si
 * l'application est installée, elle s'ouvre ; sinon le Play Store s'ouvre
 * directement sur sa fiche — en un seul toucher, sans deviner.
 * ============================================================ */

export const ANDROID_PACKAGE = 'com.shoneya.app';
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
export const APK_URL: string | undefined = import.meta.env.VITE_ANDROID_APK_URL || undefined;
export const DOWNLOAD_PAGE = '/telecharger';

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

export function isAndroidPhone(): boolean {
  return /Android/i.test(ua());
}

export function isIos(): boolean {
  const u = ua();
  return /iPad|iPhone|iPod/.test(u) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Téléphone ou tablette (Android / iPhone / iPad). */
export function isMobileDevice(): boolean {
  return isAndroidPhone() || isIos() || /Mobi/i.test(ua());
}

/** Déjà DANS une application Shoneya (application Android web, PWA installée) : rien à proposer. */
export function isInsideApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
    || document.referrer.startsWith('android-app://');
}

/**
 * Ouvre l'application Shoneya si elle est installée, sinon le Play Store.
 * Chrome / Samsung Internet / la plupart des navigateurs Android comprennent
 * intent:// ; ailleurs, on retombe sur la fiche Play Store.
 */
export function openOrInstallUrl(): string {
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return `intent://open#Intent;scheme=shoneya;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}
