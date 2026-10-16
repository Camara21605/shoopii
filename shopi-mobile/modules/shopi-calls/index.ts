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
