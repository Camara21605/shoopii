/**
 * src/features/calls/CallProvider.tsx
 *
 * Point de montage unique (racine de l'app, voir app/_layout.tsx) : abonne
 * le socket déjà connecté aux événements call:* (attachCallListeners) et
 * affiche l'écran d'appel par-dessus TOUT le reste (Modal natif — pas de
 * bataille de z-index avec la navigation) dès qu'un appel est entrant/en
 * cours, quel que soit l'écran affiché derrière.
 *
 * APPLICATION FERMÉE (Android) — modules/shopi-calls :
 *   - le serveur envoie un push FCM ; le téléphone affiche l'appel en plein
 *     écran avec SA sonnerie, même verrouillé ;
 *   - « Répondre » ouvre l'application qui décroche aussitôt (autoAccept),
 *     « Refuser » refuse sans ouvrir l'application ;
 *   - ce composant enregistre le jeton push du téléphone pour le compte actif
 *     et reprend l'action touchée sur la notification.
 *
 * Appels de GROUPE (group-call-store.ts) : écouteurs group_call:* et leur
 * propre écran (GroupCallScreen) — un seul appel à la fois, 1:1 ou groupe.
 *
 * Vérifie aussi, à l'ouverture et à chaque retour au premier plan, un appel
 * entrant manqué pendant que le socket n'était pas connecté — l'événement
 * temps réel call:incoming n'est jamais rejoué après coup
 * (voir GET /calls/pending-incoming).
 */
import { useEffect } from 'react';
import { Alert, AppState, Modal, PermissionsAndroid, Platform } from 'react-native';

import { useSession } from '@/features/auth/session-store';
import { queryClient } from '@/lib/query-client';
import { qk } from '@/lib/query-keys';
import { STORAGE_KEYS, secureStorage } from '@/lib/storage/secure-storage';

import {
  addCallsListener, canUseFullScreenIntent, consumePendingAction, getPushToken,
  nativeCallsAvailable, openFullScreenIntentSettings, setShowOverLockScreen,
  type CallAction, type CallPushData,
} from '../../../modules/shopi-calls';
import { fetchPendingIncoming, prefetchIceServers, registerPushToken } from './api';
import { dismissIncomingLocally, surfaceIncoming, useCallStore, attachCallListeners } from './call-store';
import { attachRoomListeners } from './room-store';
import { attachGroupCallListeners, useGroupCallStore } from './group-call-store';
import GroupCallScreen from './GroupCallScreen';
import CallScreen from './CallScreen';

/** Appel en attente relu côté REST (appli rouverte sans passer par la notification). */
function surfacePendingIncoming() {
  fetchPendingIncoming()
    .then(call => {
      if (!call || !call.conversationId || useCallStore.getState().status !== 'idle') return;
      surfaceIncoming({
        conversationId: call.conversationId,
        remoteUserId:   call.callerUserId,
        remoteName:     call.callerName ?? 'Appel entrant',
        remoteAvatar:   call.callerAvatar,
        callType:       call.callType ?? 'audio',
      }, false);
    })
    .catch(() => { /* pas d'appel en attente, ou réseau indisponible — sans conséquence */ });
}

/** Push / notification → écran d'appel de l'application. */
function surfaceFromPush(data: CallPushData, autoAccept: boolean) {
  if (!data.conversationId || !data.callerUserId) return;
  const expiresAt = Number(data.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt) return;
  surfaceIncoming({
    conversationId: data.conversationId,
    remoteUserId:   data.callerUserId,
    remoteName:     data.callerName || 'Appel entrant',
    remoteAvatar:   data.callerAvatar || null,
    callType:       data.callType === 'video' ? 'video' : 'audio',
  }, autoAccept);
}

function handleAction(action: CallAction | null) {
  if (!action) return;
  switch (action.action) {
    case 'accept':   surfaceFromPush(action, true); break;
    case 'show':     surfaceFromPush(action, false); break;
    case 'declined':
    case 'ended':    dismissIncomingLocally(); break;
  }
}

/**
 * Autorisations nécessaires pour que le téléphone sonne application fermée :
 * notifications (Android 13+) et, Android 14+, l'affichage plein écran — que le
 * Play Store retire par défaut aux applications qui ne sont pas « téléphone ».
 * Demandées une seule fois, avec une explication.
 */
async function ensureCallAlertsAllowed() {
  if (Platform.OS !== 'android' || !nativeCallsAvailable) return;

  if (Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => undefined);
  }

  if (canUseFullScreenIntent()) return;
  if (await secureStorage.get(STORAGE_KEYS.callAlertsPrompted).catch(() => null)) return;
  await secureStorage.set(STORAGE_KEYS.callAlertsPrompted, '1').catch(() => undefined);

  Alert.alert(
    'Recevoir les appels en plein écran',
    'Pour que vos appels Shoneya s’affichent et sonnent comme un appel normal, même téléphone verrouillé, autorisez les notifications en plein écran.',
    [
      { text: 'Plus tard', style: 'cancel' },
      { text: 'Autoriser', onPress: openFullScreenIntentSettings },
    ],
  );
}

export function CallProvider() {
  const status = useSession(s => s.status);
  const user = useSession(s => s.user);
  const callStatus = useCallStore(s => s.status);
  const groupStatus = useGroupCallStore(s => s.status);
  const accountKey = user ? `${user.id}:${user.role}` : null;

  useEffect(() => {
    if (status !== 'signedIn') return;
    prefetchIceServers();
    const detach = attachCallListeners();
    const detachRoom = attachRoomListeners();   // appels à plusieurs (ajout de participants)
    const detachGroup = attachGroupCallListeners();   // appels de groupe (discussions de groupe)

    /* « Répondre » / plein écran touché pendant que l'application était fermée :
     * l'action attend ici — sinon on regarde s'il reste un appel qui sonne. */
    const pending = consumePendingAction();
    if (pending) handleAction(pending);
    else surfacePendingIncoming();

    /* accept/show sont aussi gardés côté natif pour un démarrage à froid : on les vide
     * en les traitant, pour qu'ils ne soient pas rejoués à la prochaine ouverture. */
    const offAction = addCallsListener('onCallAction', a => {
      handleAction(a.action === 'accept' || a.action === 'show' ? (consumePendingAction() ?? a) : a);
    });
    /* Notification reçue (déjà affichée par le téléphone) : listes et compteurs à jour tout de suite. */
    const offNotif = addCallsListener('onNotification', n => {
      if (n.category === 'messages') {
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        void queryClient.invalidateQueries({ queryKey: qk.messages.unread });
      } else {
        void queryClient.invalidateQueries({ queryKey: qk.notifications.all });
        void queryClient.invalidateQueries({ queryKey: qk.notifications.unread });
      }
    });
    const offPush = addCallsListener('onIncomingPush', data => {
      if (AppState.currentState === 'active') surfaceFromPush(data, false);
    });

    const sub = AppState.addEventListener('change', next => {
      if (next === 'active' && useCallStore.getState().status === 'idle') surfacePendingIncoming();
    });

    return () => { detach(); detachRoom(); detachGroup(); offAction(); offPush(); offNotif(); sub.remove(); };
  }, [status]);

  /* Jeton push du téléphone → compte actif (renvoyé après une bascule de compte). */
  useEffect(() => {
    if (status !== 'signedIn' || !accountKey || !nativeCallsAvailable) return;
    void getPushToken().then(token => { if (token) void registerPushToken(token, accountKey).catch(() => undefined); });
    void ensureCallAlertsAllowed();
    return addCallsListener('onPushToken', ({ token }) => {
      void registerPushToken(token, accountKey).catch(() => undefined);
    });
  }, [status, accountKey]);

  /* L'écran d'appel ne reste au-dessus de l'écran verrouillé que pendant l'appel. */
  useEffect(() => {
    if (callStatus === 'idle') setShowOverLockScreen(false);
  }, [callStatus]);

  if (status !== 'signedIn') return null;
  if (callStatus === 'idle' && groupStatus !== 'idle') {
    return (
      <Modal visible animationType="fade" statusBarTranslucent presentationStyle="fullScreen" onRequestClose={() => undefined}>
        <GroupCallScreen />
      </Modal>
    );
  }
  if (callStatus === 'idle') return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <CallScreen />
    </Modal>
  );
}
