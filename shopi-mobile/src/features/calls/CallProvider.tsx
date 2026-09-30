/**
 * src/features/calls/CallProvider.tsx
 *
 * Point de montage unique (racine de l'app, voir app/_layout.tsx) : abonne
 * le socket déjà connecté aux événements call:* (attachCallListeners) et
 * affiche l'écran d'appel par-dessus TOUT le reste (Modal natif — pas de
 * bataille de z-index avec la navigation) dès qu'un appel est entrant/en
 * cours, quel que soit l'écran affiché derrière.
 *
 * Vérifie aussi, à l'ouverture et à chaque retour au premier plan, un appel
 * entrant manqué pendant que le socket n'était pas connecté (app fermée ou
 * en arrière-plan) — l'événement temps réel call:incoming n'est jamais
 * rejoué après coup (voir GET /calls/pending-incoming).
 */
import { useEffect } from 'react';
import { AppState, Modal } from 'react-native';

import { useSession } from '@/features/auth/session-store';

import { fetchPendingIncoming, prefetchIceServers } from './api';
import { attachCallListeners, useCallStore, type CallInfo } from './call-store';
import CallScreen from './CallScreen';

/** Fait passer le store directement en "ringing" à partir d'un appel manqué détecté côté REST. */
function surfacePendingIncoming() {
  fetchPendingIncoming()
    .then(call => {
      if (!call || !call.conversationId || useCallStore.getState().status !== 'idle') return;
      const info: CallInfo = {
        conversationId: call.conversationId,
        remoteUserId:   call.callerUserId,
        remoteName:     call.callerName ?? 'Appel entrant',
        remoteAvatar:   call.callerAvatar,
        direction:      'incoming',
        callType:       call.callType ?? 'audio',
      };
      useCallStore.setState({ status: 'ringing', callInfo: info, muted: false, durationSec: 0, errorMessage: null });
    })
    .catch(() => { /* pas d'appel en attente, ou réseau indisponible — sans conséquence */ });
}

export function CallProvider() {
  const status = useSession(s => s.status);
  const callStatus = useCallStore(s => s.status);

  useEffect(() => {
    if (status !== 'signedIn') return;
    prefetchIceServers();
    const detach = attachCallListeners();
    surfacePendingIncoming();

    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') surfacePendingIncoming();
    });

    return () => { detach(); sub.remove(); };
  }, [status]);

  if (status !== 'signedIn' || callStatus === 'idle') return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <CallScreen />
    </Modal>
  );
}
