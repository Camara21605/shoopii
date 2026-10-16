import { create } from 'zustand';

import { fetchMe, logout, publicUserSchema, type PublicUser } from '@/features/auth/api';
import { unregisterPushToken } from '@/features/calls/api';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { tokenStore, type Tokens } from '@/lib/api/token-store';
import { queryClient } from '@/lib/query-client';
import { STORAGE_KEYS, secureStorage } from '@/lib/storage/secure-storage';

import { clearAllNotifications } from '../../../modules/shopi-calls';

/* Profil gardé sur le téléphone : au démarrage, l'application s'ouvre AUSSITÔT avec
 * lui, sans attendre le serveur (qui peut mettre plusieurs secondes à se réveiller
 * sur l'offre gratuite de Render). Un appel entrant décroché l'application fermée
 * n'attend donc plus le logo. Le serveur confirme le compte juste après, en fond. */
async function readCachedUser(): Promise<PublicUser | null> {
  try {
    const raw = await secureStorage.get(STORAGE_KEYS.cachedUser);
    if (!raw) return null;
    const parsed = publicUserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
function saveCachedUser(user: PublicUser | null) {
  const job = user
    ? secureStorage.set(STORAGE_KEYS.cachedUser, JSON.stringify(user))
    : secureStorage.remove(STORAGE_KEYS.cachedUser);
  void job.catch(() => undefined);
}

type SessionState = {
  /** loading = démarrage en cours (splash) ; les écrans ne s'affichent pas avant. */
  status: 'loading' | 'signedIn' | 'signedOut';
  user: PublicUser | null;
  bootstrap: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signIn: (tokens: Tokens, user: PublicUser) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,

  async bootstrap() {
    const [, cached] = await Promise.all([tokenStore.hydrate(), readCachedUser()]);
    if (!tokenStore.hasSession()) {
      set({ status: 'signedOut', user: null });
      return;
    }

    /* Démarrage instantané : profil du téléphone tout de suite, vérification en fond. */
    if (cached) {
      set({ status: 'signedIn', user: cached });
      void get().refreshUser();
      return;
    }
    // Première ouverture après la mise à jour (pas encore de profil gardé) : on attend une fois.
    await get().refreshUser();
  },

  /** Confirme le compte auprès du serveur (et rafraîchit le jeton s'il a expiré). */
  async refreshUser() {
    try {
      const user = await fetchMe();
      saveCachedUser(user);
      set({ status: 'signedIn', user });
    } catch (error) {
      if (error instanceof NetworkError || (error instanceof ApiError && error.isServerError)) {
        // Hors-ligne / serveur en panne : on ne déconnecte PAS l'utilisateur.
        if (get().status === 'loading') set({ status: 'signedIn', user: null });
      } else {
        await tokenStore.clear();
        saveCachedUser(null);
        set({ status: 'signedOut', user: null });
      }
    }
  },

  async signIn(tokens, user) {
    await tokenStore.set(tokens);
    saveCachedUser(user);
    set({ status: 'signedIn', user });
  },

  async signOut() {
    // Meilleur effort : la déconnexion locale ne doit jamais dépendre du réseau.
    if (get().status === 'signedIn') {
      // Ce téléphone ne doit plus sonner pour les appels de ce compte.
      await unregisterPushToken().catch(() => undefined);
      await logout().catch(() => undefined);
    }
    await tokenStore.clear();
    saveCachedUser(null);
    queryClient.clear();
    clearAllNotifications();   // plus rien du compte précédent sur l'écran
    set({ status: 'signedOut', user: null });
  },
}));

/** Session perdue côté client HTTP (refresh refusé) → retour immédiat au login. */
tokenStore.onAuthLost(() => {
  queryClient.clear();
  saveCachedUser(null);
  useSession.setState({ status: 'signedOut', user: null });
});
