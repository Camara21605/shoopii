/**
 * Client HTTP unique de l'app. Garanties :
 *  - Authorization: Bearer géré ici, jamais dans les écrans.
 *  - credentials: 'omit' : on n'utilise PAS le cookie jar natif — l'auth
 *    passe uniquement par le Bearer, donc le middleware CSRF (qui ne
 *    s'applique qu'aux requêtes portant un cookie d'auth) ne s'en mêle pas.
 *  - Délai maximum sur chaque requête (pas de spinner infini sur réseau 3G).
 *  - Refresh automatique sur 401, à usage unique et coalescé : le serveur
 *    fait de la rotation du refresh token (un token consommé rejoué révoque
 *    toute la session) — deux refresh simultanés seraient donc désastreux.
 *  - Réponses validées par zod quand un schéma est fourni : un backend qui
 *    dérive du contrat produit une erreur claire, pas un crash plus loin.
 *  - Envois de fichiers (multipart) par XMLHttpRequest sur téléphone, voir
 *    xhrRequest() : le fetch global d'Expo (SDK 57) ne sait pas envoyer les
 *    fichiers { uri, name, type } de React Native.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

import { env } from '@/config/env';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { tokenStore } from '@/lib/api/token-store';

const REQUEST_TIMEOUT_MS = 15_000;
/** Envoi de fichier (photo, vidéo jusqu'à 50 Mo) : 15 s ne suffisent pas en 3G. */
const UPLOAD_TIMEOUT_MS = 180_000;
/** Après un refresh refusé, on n'insiste pas pendant ce délai. */
const REFRESH_COOLDOWN_MS = 10_000;

type Query = Record<string, string | number | boolean | undefined | null>;

export type RequestOptions<T = unknown> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Envoi de fichier (multipart) — remplace `body` ; le Content-Type est posé par fetch. */
  formData?: FormData;
  query?: Query;
  /** false pour login/inscription : pas de Bearer, pas de refresh sur 401. */
  auth?: boolean;
  /**
   * false quand un 401 signifie « mot de passe saisi incorrect » (changement de mot de passe,
   * zone sensible, désactivation 2FA) et non une session expirée : pas de refresh + renvoi,
   * sinon chaque essai compterait DEUX fois dans la limite d'essais du serveur.
   */
  retryOn401?: boolean;
  signal?: AbortSignal;
  schema?: z.ZodType<T>;
  /** Délai maximal ; par défaut 15 s, 3 min pour un envoi de fichier (formData). */
  timeoutMs?: number;
};

const appVersion = Constants.expoConfig?.version ?? '0.0.0';

function buildUrl(path: string, query?: Query) {
  const url = `${env.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  }
  return fallback;
}

/** Ce que le reste du client lit d'une réponse (fetch Response ou XHR). */
type RawResponse = { status: number; ok: boolean; text: () => Promise<string> };

/**
 * POURQUOI — depuis Expo SDK 57, le `fetch` global est celui d'Expo
 * (expo/fetch), qui REFUSE les fichiers React Native { uri, name, type } dans
 * un FormData (« uri is not supported », convertFormData.ts) : l'erreur partait
 * avant tout envoi et s'affichait « Connexion impossible » — vocaux, photos,
 * vidéos et documents échouaient tous. XMLHttpRequest (React Native) lit ces
 * fichiers nativement depuis le téléphone : il sert à tous les envois multipart.
 */
function xhrRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: FormData,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      const text = xhr.responseText ?? '';
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, text: async () => text });
    };
    xhr.onerror = () => reject(new NetworkError());
    xhr.ontimeout = () => reject(new NetworkError('Le serveur met trop de temps à répondre. Réessayez.'));
    xhr.onabort = () => reject(Object.assign(new Error('Envoi annulé'), { name: 'AbortError' }));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

async function rawRequest(path: string, options: RequestOptions<unknown>, accessToken: string | null): Promise<RawResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? (options.formData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS));
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client-Platform': 'mobile',
    'X-Client-Version': appVersion,
  };
  if (options.body !== undefined && !options.formData) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  /* Fichiers sur téléphone : XMLHttpRequest (voir xhrRequest). Sur le web, les
   * fichiers sont de vrais Blob et le fetch du navigateur convient. */
  if (options.formData && Platform.OS !== 'web') {
    clearTimeout(timeout);
    return xhrRequest(
      buildUrl(path, options.query),
      options.method ?? 'POST',
      headers,
      options.formData,
      options.timeoutMs ?? UPLOAD_TIMEOUT_MS,
      options.signal,
    );
  }

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error; // annulation voulue (ex: react-query)
    throw new NetworkError(
      controller.signal.aborted ? 'Le serveur met trop de temps à répondre. Réessayez.' : undefined,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function parseBody(response: RawResponse): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/* ── Refresh (coalescé + cooldown) ─────────────────────────────── */

let refreshInFlight: Promise<boolean> | null = null;
let refreshBlockedUntil = 0;

const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

async function refreshSession(): Promise<boolean> {
  if (Date.now() < refreshBlockedUntil) return false;
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await rawRequest(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken }, auth: false },
        null,
      );
      if (!response.ok) {
        // Refus définitif (révoqué, expiré, rejoué) → session perdue.
        if (response.status >= 400 && response.status < 500) {
          refreshBlockedUntil = Date.now() + REFRESH_COOLDOWN_MS;
          await tokenStore.clear();
          tokenStore.emitAuthLost();
        }
        return false;
      }
      const tokens = refreshResponseSchema.parse(await parseBody(response));
      await tokenStore.set(tokens);
      return true;
    } catch {
      // Réseau coupé : on garde la session, on réessaiera plus tard.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Jeton d'accès expiré (ou illisible) d'après sa date « exp » — 10 s de marge. */
function accessTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const part = token.split('.')[1] ?? '';
    const json = JSON.parse(globalThis.atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))) as { exp?: number };
    return typeof json.exp !== 'number' || json.exp * 1000 < Date.now() + 10_000;
  } catch {
    return true;
  }
}

/* ── API publique ──────────────────────────────────────────────── */

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  let response = await rawRequest(path, options, tokenStore.getAccessToken());

  /* retryOn401 === false : on ne rafraîchit que si le jeton d'accès est vraiment expiré (sinon le
   * 401 veut dire « mot de passe incorrect » et la requête ne doit pas être rejouée). */
  const mayRetry = options.retryOn401 !== false || accessTokenExpired(tokenStore.getAccessToken());
  if (response.status === 401 && options.auth !== false && mayRetry && (await refreshSession())) {
    response = await rawRequest(path, options, tokenStore.getAccessToken());
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(data, 'La requête a échoué.'), data);
  }

  if (options.schema) {
    const result = options.schema.safeParse(data);
    if (!result.success) {
      if (__DEV__) console.warn(`[api] Réponse inattendue sur ${path}`, result.error.issues);
      throw new ApiError(502, 'Réponse inattendue du serveur.', data);
    }
    return result.data;
  }
  return data as T;
}
