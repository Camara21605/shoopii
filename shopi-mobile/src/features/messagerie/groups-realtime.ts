/**
 * Temps réel PROPRE À L'ÉCRAN d'un groupe ouvert. Les caches des groupes
 * (liste, fils de messages, modifié, supprimé, statut, reconnexion) sont
 * tenus à jour par le gestionnaire central de la session : sync.tsx.
 * Ici ne reste que : prévenir l'écran ouvert qu'un message d'un AUTRE membre
 * vient d'arriver (pour marquer le groupe lu).
 * connectRealtime() et non getSocket() : voir realtime.ts.
 */
import { useEffect, useRef } from 'react';

import { useSession } from '@/features/auth/session-store';
import { connectRealtime } from '@/lib/realtime/socket';

import type { GroupMessage } from './groups-api';

export { groupPreview } from './sync';

/** Un groupe ouvert : `onIncoming` à chaque message d'un autre membre. */
export function useGroupChatRealtime(groupId: string | undefined, onIncoming?: () => void) {
  const myId = useSession((s) => s.user?.id);
  const onIncomingRef = useRef(onIncoming);
  useEffect(() => { onIncomingRef.current = onIncoming; }, [onIncoming]);

  useEffect(() => {
    if (!groupId) return;
    const socket = connectRealtime();
    const onNew = (p: { groupId: string; message: GroupMessage }) => {
      if (p.groupId !== groupId || p.message.senderUserId === myId) return;
      onIncomingRef.current?.();
    };
    socket.on('group_new_message', onNew);
    return () => {
      socket.off('group_new_message', onNew);
    };
  }, [groupId, myId]);
}
