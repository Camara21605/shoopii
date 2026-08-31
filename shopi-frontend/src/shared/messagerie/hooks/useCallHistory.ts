/* ================================================================
 * FICHIER : src/shared/messagerie/hooks/useCallHistory.ts
 * Charge l'historique des appels — GET /calls/history.
 * ================================================================ */

import { useState, useCallback } from 'react';
import { apiFetch } from '../../services/apiFetch';

export interface CallHistoryItem {
  id:             string;
  conversationId: string | null;
  callType:       'audio' | 'video';
  status:         'completed' | 'missed' | 'rejected' | 'busy';
  direction:      'outgoing' | 'incoming';
  contactName:    string;
  contactAvatar:  string | null;
  startedAt:      string;
  answeredAt:     string | null;
  endedAt:        string;
  duration:       number;
  /** Bulle d'appel correspondante dans la conversation (corrélation best-effort
   *  côté backend, voir CallService.correlateHistoryToMessages) — null si
   *  introuvable. Permet "aller à l'appel" depuis cet onglet. */
  messageId:      string | null;
}

export function useCallHistory() {
  const [data,    setData]    = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const load = useCallback(() => {
    if (loaded) return;
    setLoading(true);
    apiFetch<{ data: CallHistoryItem[] }>('/calls/history', { params: { limit: 50 } })
      .then(res => setData(res?.data ?? []))
      .catch(() => setData([]))
      .finally(() => { setLoading(false); setLoaded(true); });
  }, [loaded]);

  /* Retrait optimiste — l'entrée disparaît immédiatement, restaurée si
   * l'appel réseau échoue (voir CallHistoryItemRow, mêmes principes que
   * FollowButton). Ne concerne que la liste de CET utilisateur (voir
   * hiddenByCaller/hiddenByCallee côté backend). */
  const deleteItem = useCallback(async (id: string) => {
    const prev = data;
    setData(list => list.filter(i => i.id !== id));
    try {
      await apiFetch(`/calls/history/${id}`, { method: 'DELETE' });
    } catch (e) {
      setData(prev);
      throw e;
    }
  }, [data]);

  return { data, loading, load, deleteItem };
}
