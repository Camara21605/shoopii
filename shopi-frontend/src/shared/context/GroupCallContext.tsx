/**
 * FICHIER : src/shared/context/GroupCallContext.tsx
 *
 * RÔLE : Contexte React global pour les appels audio/vidéo de groupe (mesh WebRTC).
 *
 * PATTERN identique à GlobalCallContext (P2P) :
 *   - Monté AU-DESSUS du router, survit aux changements de route
 *   - useGroupCall s'exécute une seule fois pour toute l'app
 *   - GroupCallIncoming + GroupCallOverlay rendus ici, z-index > tout
 *
 * USAGE depuis ChatHeader :
 *   const { initiateCall } = useGroupCallCtx();
 *   initiateCall(groupId, 'video');
 */

import React, {
  createContext, useContext,
} from 'react';
import { useGroupCall }        from '../messagerie/hooks/useGroupCall';
import type { UseGroupCallReturn } from '../messagerie/hooks/useGroupCall';
import GroupCallIncoming       from '../messagerie/components/GroupCallIncoming';
import GroupCallOverlay        from '../messagerie/components/GroupCallOverlay';

// ── Contexte ──────────────────────────────────────────────────

const GroupCallContext = createContext<UseGroupCallReturn | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function GroupCallProvider({ children }: { children: React.ReactNode }) {
  const groupCall = useGroupCall();

  return (
    <GroupCallContext.Provider value={groupCall}>
      {children}

      {/* Notification d'appel entrant — z-index 1400 */}
      {groupCall.incomingCall && !groupCall.callState && (
        <GroupCallIncoming
          invite={groupCall.incomingCall}
          onAccept={() => groupCall.joinCall(groupCall.incomingCall!)}
          onDecline={() => groupCall.declineCall(groupCall.incomingCall!)}
        />
      )}

      {/* Overlay appel actif — z-index 1500 */}
      {groupCall.callState && (
        <GroupCallOverlay
          callState={groupCall.callState}
          peers={groupCall.peers}
          localStream={groupCall.localStream}
          isMuted={groupCall.isMuted}
          isVideoOff={groupCall.isVideoOff}
          onLeave={groupCall.leaveCall}
          onToggleMute={groupCall.toggleMute}
          onToggleVideo={groupCall.toggleVideo}
        />
      )}
    </GroupCallContext.Provider>
  );
}

// ── Hook consommateur ─────────────────────────────────────────

export function useGroupCallCtx(): UseGroupCallReturn {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error('useGroupCallCtx() doit être utilisé dans <GroupCallProvider>');
  return ctx;
}
