/* ============================================================
 * FICHIER : src/shared/pwa/UpdateBanner.tsx
 *
 * RÔLE : Faire apparaître une nouvelle version déployée SANS que
 * l'utilisateur doive fermer/rouvrir l'application plusieurs fois.
 *
 * L'application installée sert sa page depuis le service worker : après un
 * déploiement, le nouveau service worker s'installe (skipWaiting) mais la
 * page déjà ouverte garde l'ancien code jusqu'au prochain chargement.
 * Ici, dès que la nouvelle version prend la main (« controllerchange ») :
 *   - application en arrière-plan → rechargement silencieux au retour ;
 *   - application à l'écran → petite bannière « Mettre à jour ».
 * Jamais de rechargement pendant un appel (voir callInProgress).
 * Rien au tout premier lancement (pas d'ancienne version à remplacer).
 * ============================================================ */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callInProgress } from '../utils/newVersion';
import s from './UpdateBanner.module.css';

export default function UpdateBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const hadController = !!sw.controller;
    let reloadWhenBack = false;

    const onVisible = async () => {
      if (document.visibilityState !== 'visible' || !reloadWhenBack) return;
      if (await callInProgress()) { setVisible(true); return; }
      window.location.reload();
    };
    const onControllerChange = () => {
      if (!hadController) return;            // premier lancement : rien à mettre à jour
      if (document.visibilityState === 'hidden') reloadWhenBack = true;
      else setVisible(true);
    };

    sw.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);
    /* Cherche tout de suite une nouvelle version à l'ouverture de l'application */
    sw.ready.then(reg => { if (navigator.onLine) void reg.update().catch(() => {}); }).catch(() => {});
    return () => {
      sw.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!visible) return null;

  const update = async () => {
    if (await callInProgress()) return;      // on attend la fin de l'appel
    window.location.reload();
  };

  return (
    <div className={s.banner} role="status">
      <i className={`fas fa-rotate ${s.icon}`} aria-hidden="true" />
      <span className={s.text}>{t('pwa.update.message', { defaultValue: 'Nouvelle version disponible' })}</span>
      <button type="button" className={s.btn} onClick={update}>
        {t('pwa.update.action', { defaultValue: 'Mettre à jour' })}
      </button>
      <button type="button" className={s.close} onClick={() => setVisible(false)}
        aria-label={t('pwa.update.plusTard', { defaultValue: 'Plus tard' })}>
        <i className="fas fa-xmark" aria-hidden="true" />
      </button>
    </div>
  );
}
