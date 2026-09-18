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
 */
import Constants from 'expo-constants';
import { z } from 'zod';

import { env } from '@/config/env';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { tokenStore } from '@/lib/api/token-store';

const REQUEST_TIMEOUT_MS = 15_000;
/** Après un refresh refusé, on n'insiste pas pendant ce délai. */
const REFRESH_COOLDOWN_MS = 10_000;

type Query = Record<string, string | number | boolean | undefined | null>;

export type RequestOptions<T = unknown> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** false pour login/inscription : pas de Bearer, pas de refresh sur 401. */
  auth?: boolean;
  signal?: AbortSignal;
  schema?: z.ZodType<T>;
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

async function rawRequest(path: string, options: RequestOptions<unknown>, accessToken: string | null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Client-Platform': 'mobile',
    'X-Client-Version': appVersion,
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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

async function parseBody(response: Response): Promise<unknown> {
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

/* ── API publique ──────────────────────────────────────────────── */

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  let response = await rawRequest(path, options, tokenStore.getAccessToken());

  if (response.status === 401 && options.auth !== false && (await refreshSession())) {
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
