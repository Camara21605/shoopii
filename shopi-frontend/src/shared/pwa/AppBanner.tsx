/* ============================================================
 * FICHIER : src/shared/pwa/AppBanner.tsx
 *
 * Sur un téléphone Android, le site propose l'APPLICATION MOBILE Shoneya
 * (native, Play Store) — pas l'installation de la PWA.
 *   « Obtenir » : ouvre l'application si elle est déjà installée, sinon sa
 *   fiche Play Store. « Fichier APK » (si VITE_ANDROID_APK_URL) : téléchargement
 *   direct, pour les téléphones sans Play Store.
 *
 * MASQUÉE : ordinateur (la bannière PWA y reste), iPhone (pas encore
 * d'application iOS), déjà dans l'application, repoussée récemment (7 jours).
 * ============================================================ */

import { useState } from 'react';
import { APK_URL, DOWNLOAD_PAGE, isAndroidPhone, isInsideApp, openOrInstallUrl } from './nativeApp';
import s from './AppBanner.module.css';

const SNOOZE_KEY  = 'shoneya_app_banner_snooze_until';
const SNOOZE_DAYS = 7;

function isSnoozed(): boolean {
  try { return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now(); } catch { return false; }
}

export default function AppBanner() {
  const [hidden, setHidden] = useState(() => isSnoozed() || !isAndroidPhone() || isInsideApp()
    || window.location.pathname === DOWNLOAD_PAGE);
  if (hidden) return null;

  const close = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000)); } catch { /* stockage indisponible */ }
    setHidden(true);
  };

  return (
    <div className={s.banner} role="region" aria-label="Application mobile Shoneya">
      <button type="button" className={s.close} onClick={close} aria-label="Fermer"><i className="fas fa-xmark" /></button>
      <img src="/pwa-192x192.png" alt="" className={s.logo} width={44} height={44} />
      <div className={s.text}>
        <strong>Shoneya pour Android</strong>
        <span>Appels, messages et notifications en direct · Gratuit</span>
        {APK_URL && <a className={s.apk} href={DOWNLOAD_PAGE}>Pas de Play Store ? Fichier APK</a>}
      </div>
      <a className={s.get} href={openOrInstallUrl()} rel="noopener">Obtenir</a>
    </div>
  );
}
