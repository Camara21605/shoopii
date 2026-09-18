/**
 * Configuration d'environnement, validée au démarrage.
 *
 * Expo remplace `process.env.EXPO_PUBLIC_*` à la compilation (référence
 * littérale obligatoire, pas d'accès dynamique) — voir .env.example.
 * Toute valeur ici est PUBLIQUE (visible dans le bundle) : jamais de secret.
 */
import { Platform } from 'react-native';
import { z } from 'zod';

const PROD_API_URL = 'https://shoneya-2ig5.onrender.com/api';

/** 10.0.2.2 = alias de la machine hôte dans l'émulateur Android. */
const DEV_API_URL = Platform.select({
  android: 'http://10.0.2.2:3001/api',
  default: 'http://localhost:3001/api',
});

const schema = z.object({
  apiUrl: z.string().url(),
});

const parsed = schema.parse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? DEV_API_URL : PROD_API_URL),
});

/* Sécurité : en build de production, le trafic non chiffré est interdit —
 * une URL http:// ferait transiter mot de passe et tokens en clair. */
if (!__DEV__ && !parsed.apiUrl.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_URL doit être en https:// dans un build de production.');
}

export const env = {
  apiUrl: parsed.apiUrl.replace(/\/+$/, ''),
  /** Origine Socket.IO = API sans le préfixe /api. */
  socketUrl: parsed.apiUrl.replace(/\/api\/?$/, ''),
} as const;
