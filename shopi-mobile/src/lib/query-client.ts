import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/lib/api/errors';

/**
 * Cache serveur unique. Réglages pensés pour des réseaux mobiles instables :
 *  - pas de retry sur les erreurs 4xx (inutile, et ça martèle le serveur) ;
 *  - retry limité avec backoff sur réseau/5xx ;
 *  - données gardées 5 min avant d'être considérées périmées.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnReconnect: true,
    },
    mutations: { retry: false },
  },
});

/** Relie react-query à l'état réseau et à l'état foreground/background natifs. */
export function setupQueryClientListeners() {
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => subscription.remove();
  });

  const appStateSubscription = AppState.addEventListener('change', (status) => {
    if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
  });
  return () => appStateSubscription.remove();
}
