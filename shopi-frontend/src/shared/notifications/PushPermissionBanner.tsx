/* ============================================================
 * FICHIER : src/shared/notifications/PushPermissionBanner.tsx
 *
 * RÔLE : Propose d'activer les notifications sur l'appareil (messages,
 * appels manqués, commandes — même application fermée).
 *
 * POURQUOI UN BOUTON ET PAS UN POPUP AUTOMATIQUE : Chrome exige un geste de
 * l'utilisateur pour la demande de permission, et une demande dès l'arrivée
 * sur la page est mal vue (souvent refusée, puis bloquée définitivement).
 *
 * AFFICHÉE UNIQUEMENT SI : connecté · navigateur compatible · push configuré
 * côté serveur · permission pas encore choisie · pas repoussée récemment.
 *
 * Si la permission est DÉJÀ accordée, l'appareil est simplement ré-enregistré
 * en silence sur le compte connecté (voir syncPushSubscription).
 * ============================================================ */

import { useEffect, useState } from 'react';
import { getRoleFromToken } from '../services/authUtils';
import {
  enablePush, getPushPermission, isPushAvailableOnServer, syncPushSubscription,
} from './pushClient';
import s from './PushPermissionBanner.module.css';

const SNOOZE_KEY  = 'shoneya_push_snooze_until';
const SNOOZE_DAYS = 7;

function isSnoozed(): boolean {
  try { return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now(); } catch { return false; }
}

export default function PushPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [busy,    setBusy]    = useState(false);

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      if (!getRoleFromToken()) { setVisible(false); return; }

      const permission = getPushPermission();
      if (permission === 'granted') {
        void syncPushSubscription();          // ré-attache l'appareil au compte connecté
        setVisible(false);
        return;
      }
      if (permission !== 'default' || isSnoozed()) { setVisible(false); return; }

      const available = await isPushAvailableOnServer();
      if (!cancelled) setVisible(available);
    };

    void evaluate();
    /* Une nouvelle connexion (ou un refresh) déclenche cet évènement — voir tokenStorage.set. */
    window.addEventListener('auth:login', evaluate);
    return () => { cancelled = true; window.removeEventListener('auth:login', evaluate); };
  }, []);

  if (!visible) return null;

  const onEnable = async () => {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    setVisible(result === 'default');        // fermée sans répondre : on garde la bannière
  };

  const onLater = () => {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000)); } catch { /* stockage indisponible */ }
    setVisible(false);
  };

  return (
    <div className={s.banner} role="region" aria-label="Activer les notifications">
      <span className={s.icon} aria-hidden="true"><i className="fas fa-bell" /></span>
      <div className={s.text}>
        <strong>Ne ratez plus vos messages</strong>
        <span>Recevez les messages, appels manqués et commandes sur votre téléphone, même application fermée.</span>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.primary} onClick={onEnable} disabled={busy}>
          {busy ? 'Activation…' : 'Activer'}
        </button>
        <button type="button" className={s.later} onClick={onLater}>Plus tard</button>
      </div>
    </div>
  );
}
