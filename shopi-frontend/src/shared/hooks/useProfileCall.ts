/* ================================================================
 * FICHIER : src/shared/hooks/useProfileCall.ts
 *
 * Bouton "Appeler" réutilisable sur les pages de profil (livreur,
 * correspondant, boutique). Réutilise EXACTEMENT le même endpoint
 * que "Contacter" (POST /messagerie/conversations) — donc les mêmes
 * vérifications de permission (contact/follow/commande partagée) —
 * pour résoudre le vrai userId du destinataire, puis démarre un
 * appel réel via useGlobalCall().startCall().
 * ================================================================ */

import { useCallback, useState } from 'react';
import { useStartConversation } from './useStartConversation';
import { useGlobalCall } from '../context/GlobalCallContext';

type ActorType = 'company' | 'delivery' | 'correspondent' | 'partner' | 'client';

export function useProfileCall() {
  const { resolveContact } = useStartConversation();
  const { startCall } = useGlobalCall();
  const [loading, setLoading] = useState(false);

  const call = useCallback(async (
    targetType:   ActorType,
    targetId:     string,
    remoteName:   string,
    remoteAvatar: string | null | undefined,
    onError?:     (msg: string) => void,
  ) => {
    setLoading(true);
    try {
      const contact = await resolveContact(targetType, targetId, onError);
      if (!contact?.contactUserId) {
        onError?.('Impossible de récupérer les informations de cette personne.');
        return;
      }
      await startCall({
        conversationId: contact.id,
        remoteUserId:   contact.contactUserId,
        remoteName,
        remoteAvatar:   remoteAvatar ?? undefined,
        callType:       'audio',
      });
    } finally {
      setLoading(false);
    }
  }, [resolveContact, startCall]);

  return { call, loading };
}
