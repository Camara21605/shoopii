/* ============================================================
 * FICHIER : src/shared/notifications/PushDiagnosticPage.tsx
 *
 * RÔLE : Page « Diagnostic des notifications » (/diagnostic-notifications).
 * Vérifie, sur l'appareil où elle est ouverte, chaque maillon qui permet de
 * recevoir les notifications et la pastille APPLICATION FERMÉE :
 *   navigateur compatible → autorisation → service de notification →
 *   abonnement de l'appareil → clés du serveur → réglages du compte →
 *   appareil enregistré sur le compte → pastille de l'icône.
 * Boutons : « Activer / réparer » et « Envoyer une notification de test »
 * (POST /notifications/push/diagnostic, voir MessagingPushService.diagnostic).
 * ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../services/apiFetch';
import { getRoleFromToken } from '../services/authUtils';
import {
  enablePush, getDeviceId, getPushPermission, isPushSupported, repairPushSubscription,
} from './pushClient';
import s from './PushDiagnosticPage.module.css';

type State = 'ok' | 'ko' | 'warn' | 'wait';

interface Check { label: string; state: State; detail: string }

interface ServerDiag {
  serverEnabled: boolean;
  globalPushEnabled: boolean;
  dndActive: boolean;
  devices: { deviceId: string | null; updatedAt: string; result?: 'envoyee' | 'expiree' | 'erreur'; status?: number }[];
  unread: number;
}

const ICON: Record<State, string> = { ok: 'fa-circle-check', ko: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', wait: 'fa-circle-notch fa-spin' };

export default function PushDiagnosticPage() {
  const navigate = useNavigate();
  const connected = !!getRoleFromToken();
  const [checks,  setChecks]  = useState<Check[]>([]);
  const [server,  setServer]  = useState<ServerDiag | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(async (sendTest = false) => {
    const list: Check[] = [];
    const supported = isPushSupported();
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);

    list.push({
      label: 'Navigateur compatible',
      state: supported ? 'ok' : 'ko',
      detail: supported ? 'Ce navigateur peut recevoir des notifications.'
        : ios && !standalone ? 'Sur iPhone, ajoutez d\'abord Shoneya à l\'écran d\'accueil (Safari → Partager → Sur l\'écran d\'accueil), puis ouvrez l\'application depuis cette icône.'
        : 'Ce navigateur ne gère pas les notifications. Utilisez Chrome, Edge ou Firefox.',
    });

    const perm = getPushPermission();
    list.push({
      label: 'Autorisation des notifications',
      state: perm === 'granted' ? 'ok' : perm === 'denied' ? 'ko' : 'warn',
      detail: perm === 'granted' ? 'Autorisées.'
        : perm === 'denied' ? 'Bloquées. Ouvrez les réglages du site (icône à gauche de l\'adresse, ou Paramètres → Applications → Chrome → Notifications) et autorisez shoneya.com.'
        : 'Pas encore autorisées : touchez « Activer / réparer ».',
    });

    let subscribed = false;
    if (supported) {
      const reg = await navigator.serviceWorker.getRegistration();
      list.push({
        label: 'Service de notification',
        state: reg?.active ? 'ok' : 'ko',
        detail: reg?.active ? 'Actif.' : 'Inactif : rechargez la page, puis réessayez.',
      });
      const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      subscribed = !!sub;
      list.push({
        label: 'Abonnement de cet appareil',
        state: sub ? 'ok' : perm === 'granted' ? 'ko' : 'warn',
        detail: sub ? 'Cet appareil est abonné.' : 'Aucun abonnement : touchez « Activer / réparer ».',
      });
    }

    let diag: ServerDiag | null = null;
    if (connected) {
      try {
        diag = await apiFetch<ServerDiag>('/notifications/push/diagnostic', { method: 'POST', body: { test: sendTest } });
      } catch { diag = null; }
    }
    setServer(diag);

    if (!connected) {
      list.push({ label: 'Compte', state: 'ko', detail: 'Connectez-vous : les notifications sont liées à votre compte.' });
    } else if (!diag) {
      list.push({ label: 'Serveur', state: 'ko', detail: 'Le serveur ne répond pas. Réessayez dans un instant.' });
    } else {
      list.push({
        label: 'Notifications activées sur le serveur',
        state: diag.serverEnabled ? 'ok' : 'ko',
        detail: diag.serverEnabled ? 'Oui.' : 'Non : les clés VAPID (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT) manquent sur Render.',
      });
      list.push({
        label: 'Réglages du compte',
        state: !diag.globalPushEnabled ? 'ko' : diag.dndActive ? 'warn' : 'ok',
        detail: !diag.globalPushEnabled ? 'Les notifications sur l\'appareil sont désactivées dans vos paramètres.'
          : diag.dndActive ? 'Mode « Ne pas déranger » actif : seules les urgences passent.'
          : 'Notifications sur l\'appareil activées.',
      });
      const me = getDeviceId();
      const mine = diag.devices.some(d => d.deviceId === me);
      list.push({
        label: 'Appareil enregistré sur votre compte',
        state: mine ? 'ok' : subscribed ? 'ko' : 'warn',
        detail: `${diag.devices.length} appareil(s) enregistré(s) sur votre compte. `
          + (mine ? 'Celui-ci en fait partie.' : 'Celui-ci n\'en fait PAS partie : touchez « Activer / réparer ».'),
      });
    }

    const badge = 'setAppBadge' in navigator;
    list.push({
      label: 'Pastille sur l\'icône',
      state: badge ? (standalone ? 'ok' : 'warn') : 'warn',
      detail: !badge ? 'Ce téléphone / navigateur n\'affiche pas de chiffre sur l\'icône (un point peut apparaître selon le téléphone).'
        : standalone ? 'Gérée : le nombre de non lus s\'affiche sur l\'icône.'
        : 'La pastille ne s\'affiche que sur l\'application INSTALLÉE (icône sur l\'écran d\'accueil / le bureau).',
    });

    setChecks(list);
    return diag;
  }, [connected]);

  useEffect(() => { void run(false); }, [run]);

  const repair = async () => {
    setBusy(true); setMessage(null);
    try {
      const perm = getPushPermission() === 'granted' ? 'granted' : await enablePush();
      if (perm === 'granted') await repairPushSubscription();
      await run(false);
      setMessage(perm === 'granted' ? 'Appareil (ré)enregistré.' : 'Autorisation non accordée.');
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMessage(null);
    try {
      const d = await run(true);
      const sent = d?.devices.filter(x => x.result === 'envoyee').length ?? 0;
      setMessage(d
        ? `Notification de test envoyée à ${sent} appareil(s) sur ${d.devices.length}. Si elle n'apparaît pas, fermez l'application et réessayez.`
        : 'Envoi impossible.');
    } finally { setBusy(false); }
  };

  return (
    <div className={s.page}>
      <div className={s.card}>
        <button type="button" className={s.back} onClick={() => navigate(-1)}><i className="fas fa-arrow-left" /> Retour</button>
        <h1 className={s.title}><i className="fas fa-bell" /> Diagnostic des notifications</h1>
        <p className={s.intro}>
          Vérifie, sur <strong>cet appareil</strong>, tout ce qu'il faut pour recevoir les notifications et la pastille
          quand l'application est fermée. Ouvrez cette page sur chaque téléphone ou ordinateur à vérifier.
        </p>

        <ul className={s.list}>
          {checks.length === 0 && <li className={s.item}><i className={`fas ${ICON.wait}`} /> Vérification…</li>}
          {checks.map(c => (
            <li key={c.label} className={`${s.item} ${s[c.state]}`}>
              <i className={`fas ${ICON[c.state]}`} aria-hidden="true" />
              <div><strong>{c.label}</strong><span>{c.detail}</span></div>
            </li>
          ))}
        </ul>

        {server && server.devices.some(d => d.result) && (
          <ul className={s.devices}>
            {server.devices.map((d, i) => (
              <li key={i}>
                Appareil {i + 1}{d.deviceId === getDeviceId() ? ' (celui-ci)' : ''} :{' '}
                {d.result === 'envoyee' ? '✅ envoyée' : d.result === 'expiree' ? '♻️ abonnement expiré, retiré' : `❌ erreur ${d.status ?? ''}`}
              </li>
            ))}
          </ul>
        )}

        {message && <p className={s.message}>{message}</p>}

        <div className={s.actions}>
          <button type="button" className={s.secondary} onClick={repair} disabled={busy || !connected}>
            <i className="fas fa-rotate" /> Activer / réparer
          </button>
          <button type="button" className={s.primary} onClick={test} disabled={busy || !connected}>
            <i className="fas fa-paper-plane" /> Envoyer une notification de test
          </button>
        </div>
      </div>
    </div>
  );
}
