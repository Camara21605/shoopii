/* ============================================================
 * FICHIER : src/shared/pwa/InstallBanner.tsx
 *
 * RÔLE : Propose « Installer Shoneya » sur l'écran d'accueil du téléphone
 * (et de l'ordinateur). Android/Chrome : bouton qui ouvre la fenêtre
 * d'installation. iPhone/Safari : instructions Partager → Sur l'écran d'accueil.
 *
 * MASQUÉE SI : application déjà installée · repoussée récemment (14 jours) ·
 * navigateur qui ne propose pas l'installation.
 * ============================================================ */

import { useEffect, useState } from 'react';
import { canInstall, isIosSafari, isStandalone, promptInstall, subscribeInstall } from './installPrompt';
import s from './InstallBanner.module.css';

const SNOOZE_KEY  = 'shoneya_install_snooze_until';
const SNOOZE_DAYS = 14;

function isSnoozed(): boolean {
  try { return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now(); } catch { return false; }
}

export default function InstallBanner() {
  const [installable, setInstallable] = useState(canInstall());
  const [dismissed,   setDismissed]   = useState(isSnoozed());
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => subscribeInstall(() => setInstallable(canInstall())), []);

  const ios = isIosSafari();
  if (dismissed || isStandalone() || (!installable && !ios)) return null;

  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000)); } catch { /* stockage indisponible */ }
    setDismissed(true);
  };

  const onInstall = async () => {
    if (ios) { setShowIosHelp(v => !v); return; }
    const accepted = await promptInstall();
    if (accepted) setDismissed(true);
  };

  return (
    <div className={s.banner} role="region" aria-label="Installer l'application">
      <span className={s.icon} aria-hidden="true"><i className="fas fa-mobile-screen-button" /></span>
      <div className={s.text}>
        <strong>Installer Shoneya</strong>
        {showIosHelp
          ? <span>Touchez Partager <i className="fas fa-arrow-up-from-bracket" aria-hidden="true" /> en bas de Safari, puis « Sur l'écran d'accueil ».</span>
          : <span>Accès direct depuis l'écran d'accueil, appels et notifications comme une vraie application.</span>}
      </div>
      <div className={s.actions}>
        <button type="button" className={s.primary} onClick={onInstall}>{ios ? (showIosHelp ? 'Compris' : 'Comment ?') : 'Installer'}</button>
        <button type="button" className={s.later} onClick={later}>Plus tard</button>
      </div>
    </div>
  );
}
