/**
 * Source unique de vérité des tokens : copie mémoire (lecture instantanée
 * à chaque requête) + persistance chiffrée (survit au redémarrage).
 * Aucun autre module ne doit toucher directement au SecureStore pour les tokens.
 */
import { STORAGE_KEYS, secureStorage } from '@/lib/storage/secure-storage';

export type Tokens = { accessToken: string; refreshToken: string };

let accessToken: string | null = null;
let refreshToken: string | null = null;

type Listener = () => void;
const authLostListeners = new Set<Listener>();

export const tokenStore = {
  /** À appeler une fois au démarrage, avant le premier rendu authentifié. */
  async hydrate() {
    [accessToken, refreshToken] = await Promise.all([
      secureStorage.get(STORAGE_KEYS.accessToken),
      secureStorage.get(STORAGE_KEYS.refreshToken),
    ]);
  },

  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  hasSession: () => refreshToken !== null,

  async set(tokens: Tokens) {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    await Promise.all([
      secureStorage.set(STORAGE_KEYS.accessToken, tokens.accessToken),
      secureStorage.set(STORAGE_KEYS.refreshToken, tokens.refreshToken),
    ]);
  },

  async clear() {
    accessToken = null;
    refreshToken = null;
    await Promise.all([
      secureStorage.remove(STORAGE_KEYS.accessToken),
      secureStorage.remove(STORAGE_KEYS.refreshToken),
    ]);
  },

  /** Notifie l'UI que la session est irrécupérable (refresh refusé) → retour au login. */
  onAuthLost(listener: Listener) {
    authLostListeners.add(listener);
    return () => authLostListeners.delete(listener);
  },
  emitAuthLost() {
    authLostListeners.forEach((l) => l());
  },
};
