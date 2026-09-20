/* ============================================================
 * FICHIER : src/shared/notifications/pushClient.ts
 *
 * RÔLE : Côté navigateur des notifications Web Push (application installée
 * depuis Chrome, ou simple onglet) :
 *   - demander la permission (geste utilisateur obligatoire),
 *   - abonner l'appareil au service push du navigateur (clé VAPID publique
 *     fournie par le backend) et enregistrer l'abonnement sur le compte,
 *   - retirer l'appareil à la déconnexion (un téléphone ne doit jamais
 *     continuer à recevoir les messages de l'ancien compte),
 *   (la pastille de l'icône est gérée par appBadge.ts)
 *
 * L'affichage de la notification elle-même se fait dans public/push-sw.js
 * (service worker), pas ici.
 * ============================================================ */

import { apiFetch } from '../services/apiFetch';

const DEVICE_KEY = 'shoneya_push_device_id';

export type PushPermission = 'unsupported' | 'default' | 'granted' | 'denied';

/** Le navigateur sait-il faire du Web Push ? (iOS : uniquement app ajoutée à l'écran d'accueil) */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function getPushPermission(): PushPermission {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermission;
}

/** Identifiant stable de CET appareil : un nouvel abonnement remplace l'ancien au lieu de s'empiler. */
function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Le serveur a-t-il des clés VAPID configurées ? (sinon on n'affiche rien) */
async function fetchServerKey(): Promise<string | null> {
  try {
    const r = await apiFetch<{ enabled: boolean; publicKey: string | null }>('/notifications/push/public-key');
    return r.enabled && r.publicKey ? r.publicKey : null;
  } catch {
    return null;
  }
}

export async function isPushAvailableOnServer(): Promise<boolean> {
  return (await fetchServerKey()) !== null;
}

/**
 * Abonne l'appareil (ou récupère l'abonnement existant) puis l'enregistre sur
 * le compte connecté. Idempotent : peut être rappelé à chaque connexion.
 */
async function subscribeAndRegister(): Promise<boolean> {
  const key = await fetchServerKey();
  if (!key) return false;

  const registration = await navigator.serviceWorker.ready;
  const appKey = urlBase64ToUint8Array(key);

  let sub = await registration.pushManager.getSubscription();
  if (sub) {
    /* Clés VAPID changées côté serveur : l'ancien abonnement est inutilisable. */
    const current = sub.options?.applicationServerKey;
    const same = current && new Uint8Array(current).length === appKey.length
      && new Uint8Array(current).every((b, i) => b === appKey[i]);
    if (!same) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) {
    sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  }

  await apiFetch('/notifications/push-token', {
    method: 'POST',
    body: { token: JSON.stringify(sub.toJSON()), platform: 'web', deviceId: getDeviceId() },
  });
  return true;
}

/**
 * À appeler depuis un GESTE de l'utilisateur (clic) : demande la permission
 * puis abonne l'appareil. Renvoie la permission obtenue.
 */
export async function enablePush(): Promise<PushPermission> {
  if (!isPushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    try { await subscribeAndRegister(); } catch (err) {
      console.warn('[Push] abonnement impossible :', err);
    }
  }
  return permission as PushPermission;
}

/**
 * Permission déjà accordée (session précédente, autre compte…) : ré-enregistre
 * silencieusement l'appareil sur le compte actuellement connecté. Sans effet
 * (et sans popup) si la permission n'est pas déjà 'granted'.
 */
export async function syncPushSubscription(): Promise<void> {
  if (getPushPermission() !== 'granted') return;
  try { await subscribeAndRegister(); } catch { /* réseau / serveur : nouvel essai à la prochaine ouverture */ }
}

/** Retire l'appareil du compte courant (déconnexion). À appeler AVANT l'effacement du token d'accès. */
export async function detachPushFromAccount(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    await apiFetch('/notifications/push-token', {
      method: 'DELETE',
      body: { deviceId: getDeviceId() },
      keepalive: true,
    });
  } catch { /* session déjà expirée ou hors-ligne : le serveur nettoiera au prochain login d'un autre compte */ }
}
