/**
 * Module natif local « ShopiCalls » (Android uniquement — voir android/) :
 * sonnerie d'appel entrant application fermée (push FCM → notification d'appel
 * plein écran avec la sonnerie du téléphone), Répondre / Refuser, affichage
 * au-dessus de l'écran verrouillé.
 *
 * Sur iOS, le web ou un build sans ce module (Expo Go), tout devient sans effet :
 * l'appel continue de sonner dans l'application quand elle est ouverte.
 */
import { requireOptionalNativeModule } from 'expo';

type EventSubscription = { remove(): void };

/** Données d'un appel portées par le push (toutes des chaînes, comme FCM). */
export interface CallPushData {
  callId?: string;
  conversationId?: string;
  callerUserId?: string;
  callerName?: string;
  callerAvatar?: string;
  callType?: string;
  expiresAt?: string;
  rejectUrl?: string;
  rejectToken?: string;
}

/** accept = « Répondre » touché ; show = écran plein écran / notification touchée ;
 *  declined = « Refuser » touché ; ended = l'appel s'est arrêté côté serveur. */
export type CallAction = CallPushData & { action: 'accept' | 'show' | 'declined' | 'ended' };

/** Notification reçue (messages, commandes, livraisons…) — déjà affichée par le téléphone. */
export interface PushNotificationData {
  type?: string;
  category?: string;
  conversationId?: string;
  tag?: string;
}

type Events = {
  onCallAction: (e: CallAction) => void;
  onIncomingPush: (e: CallPushData) => void;
  onPushToken: (e: { token: string }) => void;
  onNotification: (e: PushNotificationData) => void;
};

interface ShopiCallsNative {
  getPushToken(): Promise<string | null>;
  consumePendingAction(): CallAction | null;
  cancelIncoming(callId: string | null): void;
  setShowOverLockScreen(show: boolean): void;
  canUseFullScreenIntent(): boolean;
  setActiveConversation(conversationId: string | null): void;
  dismissNotification(tag: string): void;
  clearAllNotifications(): void;
  shareApp(): Promise<'ok' | 'split' | 'error'>;
  setBadgeCount(count: number): void;
  setPresenceCredentials(url: string, token: string, intervalMinutes: number): void;
  clearPresenceCredentials(): void;
  pingPresence(): void;
  segmentSubject(uri: string): Promise<string | null>;
  openFullScreenIntentSettings(): void;
  addListener<K extends keyof Events>(event: K, listener: Events[K]): EventSubscription;
}

const native = requireOptionalNativeModule<ShopiCallsNative>('ShopiCalls');

export const nativeCallsAvailable = native != null;

export function getPushToken(): Promise<string | null> {
  return native ? native.getPushToken().catch(() => null) : Promise.resolve(null);
}

export function consumePendingAction(): CallAction | null {
  try { return native?.consumePendingAction() ?? null; } catch { return null; }
}

export function cancelIncomingNotification(callId?: string | null): void {
  try { native?.cancelIncoming(callId ?? null); } catch { /* sans conséquence */ }
}

export function setShowOverLockScreen(show: boolean): void {
  try { native?.setShowOverLockScreen(show); } catch { /* sans conséquence */ }
}

export function canUseFullScreenIntent(): boolean {
  try { return native?.canUseFullScreenIntent() ?? true; } catch { return true; }
}

export function openFullScreenIntentSettings(): void {
  try { native?.openFullScreenIntentSettings(); } catch { /* sans conséquence */ }
}

export function addCallsListener<K extends keyof Events>(event: K, listener: Events[K]): () => void {
  if (!native) return () => {};
  const sub = native.addListener(event, listener);
  return () => sub.remove();
}

/** Conversation à l'écran (null en la quittant) : ses messages ne font pas de notification, et la sienne se ferme. */
export function setActiveConversation(conversationId: string | null): void {
  try { native?.setActiveConversation(conversationId); } catch { /* sans conséquence */ }
}

export function dismissNotification(tag: string): void {
  try { native?.dismissNotification(tag); } catch { /* sans conséquence */ }
}

/** Déconnexion : plus aucune notification du compte précédent sur l'écran. */
export function clearAllNotifications(): void {
  try { native?.clearAllNotifications(); } catch { /* sans conséquence */ }
}

/**
 * « Partager Shoneya » : envoie l'application (un seul fichier complet) par
 * Bluetooth, Nearby Share, Xender, WhatsApp…
 * 'split' = cette installation est en plusieurs morceaux (ancienne version du
 * Play Store) : elle ne peut pas être copiée telle quelle.
 */
export function shareApp(): Promise<'ok' | 'split' | 'error' | 'unavailable'> {
  return native ? native.shareApp().catch(() => 'error' as const) : Promise.resolve('unavailable');
}

/** Chiffre sur l'icône Shoneya (messages + notifications non lus). */
export function setBadgeCount(count: number): void {
  try { native?.setBadgeCount(Math.max(0, Math.min(999, Math.round(count)))); } catch { /* lanceur sans chiffre */ }
}

/**
 * « Joignable » (application fermée, internet actif) : le téléphone signale
 * sa présence au serveur avec ce jeton — en quittant l'appli, toutes les
 * 15 min quand il a du réseau, à chaque push reçu.
 */
export function setPresenceCredentials(url: string, token: string, intervalMinutes = 15): void {
  try { native?.setPresenceCredentials(url, token, intervalMinutes); } catch { /* sans conséquence */ }
}

export function clearPresenceCredentials(): void {
  try { native?.clearPresenceCredentials(); } catch { /* sans conséquence */ }
}

export function pingPresence(): void {
  try { native?.pingPresence(); } catch { /* sans conséquence */ }
}

/**
 * « Retirer le fond » : masque du produit calculé par l'IA du téléphone
 * (Android, Google ML Kit). null si indisponible (iOS, services Google Play
 * absents, modèle pas encore installé) ou trop long : l'éditeur utilise
 * alors la méthode « couleur du fond ».
 */
export function segmentSubject(uri: string, timeoutMs = 12_000): Promise<string | null> {
  if (!native) return Promise.resolve(null);
  return Promise.race([
    native.segmentSubject(uri).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
