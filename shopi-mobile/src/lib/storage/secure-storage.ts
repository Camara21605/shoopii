/**
 * Stockage chiffré (Keychain iOS / Keystore Android) pour tout ce qui est
 * sensible : access token, refresh token, identifiant d'appareil.
 *
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY : lisible seulement téléphone déverrouillé,
 * et jamais migré vers une autre machine via une sauvegarde/restauration —
 * un refresh token volé dans un backup cloud serait inutilisable ailleurs.
 */
import * as SecureStore from 'expo-secure-store';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, OPTIONS),
  remove: (key: string) => SecureStore.deleteItemAsync(key, OPTIONS),
};

export const STORAGE_KEYS = {
  accessToken: 'shoneya.access_token',
  refreshToken: 'shoneya.refresh_token',
  deviceId: 'shoneya.device_id',
} as const;
