/*
 * Hook partagé : démarre (ou reprend) une conversation avec un acteur.
 *
 * Usage :
 *   const { start, loading } = useStartConversation();
 *   await start('company', companyId, onError);
 *
 * - Vérifie que l'utilisateur est connecté (sinon → /login)
 * - Appelle POST /api/messagerie/conversations
 * - Navigue vers /messagerie en passant l'ID de la conversation
 *   via location.state pour que useMessagerie puisse la pré-sélectionner
 */
import { useState, useCallback } from 'react';
import { useNavigate }           from 'react-router-dom';
import { apiFetch, tokenStorage } from '../services/apiFetch';

type ActorType = 'company' | 'delivery' | 'correspondent' | 'partner' | 'client';

export function useStartConversation() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const start = useCallback(async (
    targetType: ActorType,
    targetId:   string,
    onError?:   (msg: string) => void,
  ) => {
    if (!tokenStorage.get()) {
      navigate('/login');
      return;
    }
    if (!targetId) return;

    setLoading(true);
    try {
      const conv = await apiFetch<{ id: string }>(
        '/messagerie/conversations',
        { method: 'POST', body: { targetType, targetId } },
      );
      if (conv?.id) {
        navigate('/messagerie', { state: { activeConvId: conv.id } });
      }
    } catch (err: any) {
      onError?.(err?.message ?? 'Impossible d\'ouvrir la conversation.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  return { start, loading };
}
