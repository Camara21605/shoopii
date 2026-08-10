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
 * CSRF (double-submit cookie) — voir csrf.middleware.ts côté backend.
 *
 * En production, frontend (Vercel/shopi.gn) et backend (Render) sont sur
 * des domaines différents : document.cookie ne peut PAS lire un cookie
 * posé par une réponse d'un autre domaine, donc jamais `csrf_token`
 * (c'est une règle stricte du navigateur, pas un blocage occasionnel —
 * ça ne "marchait" en local que parce que localhost:5173/3001 partagent
 * le même host). Le serveur renvoie donc aussi le token dans l'en-tête
 * de réponse `X-CSRF-Token` (lisible cross-origin, voir exposedHeaders
 * dans main.ts) — on le met en cache ici dès qu'on le voit passer, sur
 * n'importe quelle réponse (généralement capturé dès le premier GET,
 * ex: /auth/me au démarrage), et on le réutilise pour chaque requête
 * mutante suivante. document.cookie reste tenté en repli — inoffensif
 * et toujours correct en dev local.
 * ───────────────────────────────────────────── */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_HEADER = 'X-CSRF-Token';

let cachedCsrfToken: string | null = null;

function getCsrfToken(): string | null {
  if (cachedCsrfToken) return cachedCsrfToken;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function captureCsrfToken(response: Response): void {
  const fromHeader = response.headers.get(CSRF_HEADER);
  if (fromHeader) cachedCsrfToken = fromHeader;
}

/* ─────────────────────────────────────────────
 * Gestion localStorage — conservé pour UI compat
 * L'authentification API passe par httpOnly cookies.
 * ───────────────────────────────────────────── */
export const tokenStorage = {
  get:    () => localStorage.getItem(TOKEN_KEY),
  set:    (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    // Un token frais et valide vient d'être écrit (login ou refresh réussi)
    // → lève le cooldown anti-martèlement de silentRefresh() ci-dessous.
    _refreshDeadUntil = 0;
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

/**
 * Tant que Date.now() < ce seuil, on n'appelle même pas /auth/refresh.
 *
 * POURQUOI : /auth/refresh fait de la rotation à usage unique (voir
 * auth.controller.ts) — un refresh token déjà consommé qui est réutilisé
 * déclenche une révocation GLOBALE de la session côté serveur. Une fois
 * qu'un refresh a échoué, il échouera à nouveau à chaque tentative tant
 * qu'il n'y a pas de nouvelle connexion — sans ce frein, chaque socket
 * (messagerie, notifications) qui se déconnecte relance son propre essai
 * indéfiniment, jusqu'à marteler /auth/refresh assez fort pour se faire
 * bloquer par son propre rate-limit (429), en boucle, pour rien.
 */
let _refreshDeadUntil = 0;
const REFRESH_COOLDOWN_MS = 30_000;

/**
 * Exporté pour useSocket.ts : le socket Socket.IO n'appelle jamais aucune
 * route REST, donc il ne bénéficie jamais du silent refresh automatique
 * déclenché par un 401 ci-dessous. Quand le serveur rejette la connexion
 * socket pour token invalide/expiré, useSocket appelle ceci directement
 * pour obtenir un token frais avant de reconnecter manuellement.
 */
export function silentRefresh(): Promise<boolean> {
  if (Date.now() < _refreshDeadUntil) return Promise.resolve(false);

  if (!_refreshPromise) {
    const csrfToken = getCsrfToken();
    _refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
      headers:     csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    })
      .then(async r => {
        captureCsrfToken(r);
        if (!r.ok) { _refreshDeadUntil = Date.now() + REFRESH_COOLDOWN_MS; return false; }
        /* Le cookie httpOnly est déjà renouvelé par le serveur, mais
         * localStorage (shopi_access_token) ne l'était jamais — resté
         * figé sur le tout premier token de connexion. Tout ce qui en
         * dépend (Socket.IO, dont l'auth n'utilise PAS le cookie) restait
         * donc bloqué avec un token expiré une fois le premier expiré,
         * même après un refresh REST réussi. */
        try {
          const data = await r.json() as { accessToken?: string };
          if (data.accessToken) tokenStorage.set(data.accessToken);
        } catch { /* réponse sans corps JSON exploitable — cookie déjà à jour, on continue */ }
        return true;
      })
      .catch(() => { _refreshDeadUntil = Date.now() + REFRESH_COOLDOWN_MS; return false; })
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
    /** Annule la requête (ex. filtre changé avant la fin du fetch précédent) */
    signal?:  AbortSignal;
    /** Interne — empêche une 2e tentative de silent refresh en boucle */
    _retry?:  boolean;
  } = {},
): Promise<T> {

  const {
    method   = 'GET',
    body,
    params,
    public: isPublic = false,
    signal,
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

  /* Cookie httpOnly access_token en priorité (XSS-proof, voir JwtStrategy).
   * EN PLUS : Authorization: Bearer <token> depuis localStorage, en filet de
   * secours — indispensable en prod où frontend (Vercel) et backend (Render)
   * sont sur des domaines différents. Un nombre croissant de navigateurs
   * (Safari ITP, Firefox ETP, migration 3rd-party cookies de Chrome)
   * bloquent/partitionnent les cookies cross-site même avec
   * credentials:'include' correctement posé — le cookie n'arrive alors
   * simplement jamais côté serveur, qui répond 401 sur TOUT, y compris
   * GET /calls/ice-servers (fetchIceServers() retombe alors silencieusement
   * sur STUN seul → échec des appels derrière un NAT strict, en apparence
   * aléatoire selon le navigateur). JwtStrategy accepte déjà ce fallback
   * nativement (ExtractJwt.fromAuthHeaderAsBearerToken()) — il suffisait de
   * l'envoyer. Le token localStorage n'expose rien de plus qu'avant : il y
   * était déjà stocké, seule sa transmission en en-tête est nouvelle ici. */
  void isPublic; // gardé pour compatibilité API mais sans effet sur les headers
  const bearerToken = tokenStorage.get();
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;

  /* CSRF — uniquement sur les méthodes mutantes, le backend ignore
   * l'en-tête pour les GET/HEAD/OPTIONS de toute façon. */
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  /* ── Requête HTTP ── */
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include', // cookie httpOnly envoyé automatiquement
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60_000)]) : AbortSignal.timeout(60_000),
      body:
        body instanceof FormData
          ? body
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
    });
  } catch (networkError) {
    /* Requête annulée volontairement par l'appelant (ex. filtre changé) —
     * on laisse remonter tel quel pour que l'appelant l'ignore silencieusement,
     * plutôt que de l'afficher comme une erreur réseau. */
    if (networkError instanceof DOMException && networkError.name === 'AbortError') {
      throw networkError;
    }
    console.error(`[apiFetch] Réseau inaccessible → ${method} ${url}`, networkError);
    throw new ApiError(0, 'Impossible de contacter le serveur. Vérifiez que le backend est démarré.', networkError);
  }

  /* Capturé sur TOUTE réponse (succès comme erreur, y compris un 403 CSRF
     lui-même — le serveur renvoie toujours un token valide en en-tête) :
     voir le commentaire au-dessus de getCsrfToken(). */
  captureCsrfToken(response);

  /* ── 401 → Silent refresh → retry ── */
  if (response.status === 401 && !_retry && endpoint !== '/auth/refresh') {
    const currentPath = window.location.pathname;
    const isAuthPage  = ['/login', '/register'].some(p => currentPath.startsWith(p));

    if (!isAuthPage) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        return apiFetch<T>(endpoint, { ...options, _retry: true });
      }

      /* '/auth/me' est la sonde de session initiale (appelée par AppProvider
       * sur CHAQUE page, y compris les pages publiques /home, /produit,
       * /boutique... pour un visiteur anonyme). Un 401 ici, après échec du
       * refresh, signifie simplement "pas connecté" — un état normal pour
       * un visiteur anonyme, pas une session expirée à forcer vers /login.
       * Sans cette exception, tout visiteur non connecté était redirigé
       * hors de la page publique avant même son affichage. */
      if (endpoint === '/auth/me') {
        throw new ApiError(401, 'Non connecté.');
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
