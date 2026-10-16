/**
 * Variante WEB de secure-storage (choisie automatiquement par Metro pour
 * `expo start --web`) — sert UNIQUEMENT à prévisualiser / tester les écrans
 * dans un navigateur : expo-secure-store n'existe pas sur le web.
 * Stockage en mémoire, volontairement non persistant (aucun token écrit
 * dans localStorage). L'application Android utilise secure-storage.ts.
 */
const memory = new Map<string, string>();

export const secureStorage = {
  get: async (key: string) => memory.get(key) ?? null,
  set: async (key: string, value: string) => {
    memory.set(key, value);
  },
  remove: async (key: string) => {
    memory.delete(key);
  },
};

export const STORAGE_KEYS = {
  accessToken: 'shoneya.access_token',
  refreshToken: 'shoneya.refresh_token',
  deviceId: 'shoneya.device_id',
  callAlertsPrompted: 'shoneya.call_alerts_prompted',
  /** Profil du compte connecté (nom, rôle…) : démarrage instantané sans attendre le serveur. */
  cachedUser: 'shoneya.cached_user',
} as const;
