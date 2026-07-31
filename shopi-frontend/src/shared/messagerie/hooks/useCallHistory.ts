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

  return { data, loading, load };
}
