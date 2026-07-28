/* =========================================================
 * FICHIER : src/shared/services/apiFetch.ts
 *
 * Sécurité — Phase 6 (auth hardening) :
 *   - credentials: 'include' → les cookies httpOnly sont envoyés
 *     automatiquement (access_token, refresh_token).
 *   - Plus d'Authorization: Bearer header dans apiFetch → auth
 *     via cookie uniquement pour toutes les routes HTTP.
 *   - Silent refresh : 401 → POST /auth/refresh → retry automatique.
 *     Si le refresh échoue, redirect /login.
 *
 * Note : tokenStorage (localStorage) est conservé pour compatibilité
 *   avec les composants UI qui lisent le rôle/état de connexion
 *   (CardProduit, Header, CartContext, etc.). Ces composants ne l'utilisent
 *   pas pour l'authentification — uniquement pour du rendu conditionnel.
 *   Migration progressive vers useAppContext() à faire sur chaque composant.
 * ========================================================= */

const BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001/api';

const TOKEN_KEY = 'shopi_access_token';

/* ─────────────────────────────────────────────
 * Gestion localStorage — conservé pour UI compat
 * L'authentification API passe par httpOnly cookies.
 * ───────────────────────────────────────────── */
export const tokenStorage = {
  get:    () => localStorage.getItem(TOKEN_KEY),
  set:    (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    window.dispatchEvent(new CustomEvent('auth:login'));
  },
  remove: () => localStorage.removeItem(TOKEN_KEY),
};

/* ─────────────────────────────────────────────
 * Erreur API typée
 * ───────────────────────────────────────────── */
export class ApiError extends Error {
  constructor(
    public readonly status:  number,
    public readonly message: string,
    public readonly data?:   unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ─────────────────────────────────────────────
 * Extraire un message lisible depuis la réponse
 * ───────────────────────────────────────────── */
function extractMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  const msg = data.message;
  if (!msg) return data.error ?? fallback;
  if (Array.isArray(msg)) return msg.join(' • ');
  if (typeof msg === 'string') return msg;
  return fallback;
}

/* ─────────────────────────────────────────────
 * Silent refresh — Rotation du refresh token
 * Un seul appel en cours même si plusieurs 401 arrivent en parallèle.
 * ───────────────────────────────────────────── */
let _refreshPromise: Promise<boolean> | null = null;

function silentRefresh(): Promise<boolean> {
  if (!_refreshPromise) {
    _refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
    })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

/* ─────────────────────────────────────────────
 * Client HTTP principal
 * ───────────────────────────────────────────── */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: {
    method?:  'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?:    unknown;
    params?:  Record<string, string | number | boolean | null | undefined>;
    public?:  boolean;
    /** Interne — empêche une 2e tentative de silent refresh en boucle */
    _retry?:  boolean;
  } = {},
): Promise<T> {

  const {
    method   = 'GET',
    body,
    params,
    public: isPublic = false,
    _retry = false,
  } = options;

  /* ── Construction URL ── */
  let url = `${BASE_URL}${endpoint}`;

  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }

  /* ── Headers ── */
  const headers: Record<string, string> = {};

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  /* Pas d'Authorization: Bearer — auth via cookie httpOnly uniquement.
   * Le cookie access_token est envoyé automatiquement grâce à credentials:'include'. */
  void isPublic; // gardé pour compatibilité API mais sans effet sur les headers

  /* ── Requête HTTP ── */
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include', // cookie httpOnly envoyé automatiquement
      signal: AbortSignal.timeout(60_000),
      body:
        body instanceof FormData
          ? body
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
    });
  } catch (networkError) {
    console.error(`[apiFetch] Réseau inaccessible → ${method} ${url}`, networkError);
    throw new ApiError(0, 'Impossible de contacter le serveur. Vérifiez que le backend est démarré.', networkError);
  }

  /* ── 401 → Silent refresh → retry ── */
  if (response.status === 401 && !_retry && endpoint !== '/auth/refresh') {
    const currentPath = window.location.pathname;
    const isAuthPage  = ['/login', '/register'].some(p => currentPath.startsWith(p));

    if (!isAuthPage) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        return apiFetch<T>(endpoint, { ...options, _retry: true });
      }
      /* Refresh échoué → session expirée → redirect login */
      tokenStorage.remove();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expirée. Veuillez vous reconnecter.');
    }
  }

  /* ── Gestion erreurs HTTP ── */
  if (!response.ok) {

    let errorData: any = {};
    try { errorData = await response.json(); } catch { /* réponse non-JSON */ }

    const message = extractMessage(errorData, `Erreur ${response.status}`);

    console.error(
      `[apiFetch] ${response.status} ${method} ${endpoint}`,
      '\nMessage :', message,
      '\nDétails  :', errorData,
    );

    throw new ApiError(response.status, message, errorData);
  }

  /* ── 204 No Content ── */
  if (response.status === 204) return undefined as T;

  /* ── Réponse JSON / texte ── */
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  return response.text() as unknown as T;
}
