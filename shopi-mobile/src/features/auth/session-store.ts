import { create } from 'zustand';

import { fetchMe, logout, type PublicUser } from '@/features/auth/api';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { tokenStore, type Tokens } from '@/lib/api/token-store';
import { queryClient } from '@/lib/query-client';

type SessionState = {
  /** loading = démarrage en cours (splash) ; les écrans ne s'affichent pas avant. */
  status: 'loading' | 'signedIn' | 'signedOut';
  user: PublicUser | null;
  bootstrap: () => Promise<void>;
  signIn: (tokens: Tokens, user: PublicUser) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,

  async bootstrap() {
    await tokenStore.hydrate();
    if (!tokenStore.hasSession()) {
      set({ status: 'signedOut', user: null });
      return;
    }
    try {
      // Si l'access token a expiré, apiFetch rafraîchit tout seul avant de répondre.
      const user = await fetchMe();
      set({ status: 'signedIn', user });
    } catch (error) {
      if (error instanceof NetworkError || (error instanceof ApiError && error.isServerError)) {
        // Hors-ligne / serveur en panne : on ne déconnecte PAS l'utilisateur.
        set({ status: 'signedIn', user: null });
      } else {
        await tokenStore.clear();
        set({ status: 'signedOut', user: null });
      }
    }
  },

  async signIn(tokens, user) {
    await tokenStore.set(tokens);
    set({ status: 'signedIn', user });
  },

  async signOut() {
    // Meilleur effort : la déconnexion locale ne doit jamais dépendre du réseau.
    if (get().status === 'signedIn') await logout().catch(() => undefined);
    await tokenStore.clear();
    queryClient.clear();
    set({ status: 'signedOut', user: null });
  },
}));

/** Session perdue côté client HTTP (refresh refusé) → retour immédiat au login. */
tokenStore.onAuthLost(() => {
  queryClient.clear();
  useSession.setState({ status: 'signedOut', user: null });
});
