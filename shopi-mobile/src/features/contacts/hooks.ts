/**
 * Hooks du répertoire Shoneya : liste « mes contacts sur Shoneya » et
 * synchronisation automatique à l'ouverture de la messagerie.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/features/auth/session-store';
import { qk } from '@/lib/query-keys';

import { fetchShoneyaContacts } from './api';
import { bindUser, syncContacts, useContactsSyncState } from './sync';

/** État de la synchro du compte connecté (accord, envoi en cours, erreur). */
export function useContactsSync() {
  const userId = useSession((st) => st.user?.id ?? null);
  bindUser(userId);
  const state = useContactsSyncState();
  return { userId, ...state };
}

/**
 * Synchro silencieuse quand la messagerie s'ouvre et quand l'application
 * revient au premier plan (au plus toutes les 30 min — voir sync.ts).
 */
export function useAutoContactsSync() {
  const { userId, enabled } = useContactsSync();
  useEffect(() => {
    if (!userId || !enabled) return;
    void syncContacts(userId);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncContacts(userId);
    });
    return () => sub.remove();
  }, [userId, enabled]);
}

/** Mes contacts qui sont sur Shoneya (présence rafraîchie toutes les 60 s). */
export function useShoneyaContacts(enabled: boolean) {
  return useQuery({
    queryKey: qk.contacts.list,
    queryFn: ({ signal }) => fetchShoneyaContacts(signal),
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}
