/* =========================================================
 * FICHIER : src/shared/services/apiFetch.ts
 *
 * CORRECTIONS :
 *   1. Log console.error pour chaque erreur API → debug facile
 *   2. NestJS retourne message[] pour les erreurs de validation
 *      → jointure en string lisible (au lieu de "[object Object]")
 *   3. 401 : ne redirige pas si on est déjà sur /login ou /register
 *      (évite la boucle de redirection pendant l'inscription)
 *   4. Erreur réseau : message plus clair
 * ========================================================= */

const BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001/api';

const TOKEN_KEY = 'shopi_access_token';

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
 * Gestion JWT
 * ───────────────────────────────────────────── */
export const tokenStorage = {
  get:    () => localStorage.getItem(TOKEN_KEY),
  set:    (token: string) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY),
};

/* ─────────────────────────────────────────────
 * Extraire un message lisible depuis la réponse
 * NestJS peut retourner :
 *   { message: "string" }
 *   { message: ["champ ne doit pas être vide", "email invalide"] }
 *   { message: "string", error: "Bad Request" }
 * ───────────────────────────────────────────── */
function extractMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  const msg = data.message;
  if (!msg) return data.error ?? fallback;
  // NestJS validation → tableau de messages
  if (Array.isArray(msg)) return msg.join(' • ');
  if (typeof msg === 'string') return msg;
  return fallback;
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
  } = {},
): Promise<T> {

  const {
    method   = 'GET',
    body,
    params,
    public: isPublic = false,
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

  if (!isPublic) {
    const token = tokenStorage.get();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  /* ── Requête HTTP ── */
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body:
        body instanceof FormData
          ? body
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
    });
  } catch (networkError) {
    // ✅ Log réseau pour debug
    console.error(`[apiFetch] Réseau inaccessible → ${method} ${url}`, networkError);
    throw new ApiError(0, 'Impossible de contacter le serveur. Vérifiez que le backend est démarré.', networkError);
  }

  /* ── Gestion erreurs HTTP ── */
  if (!response.ok) {

    let errorData: any = {};
    try { errorData = await response.json(); } catch { /* réponse non-JSON */ }

    const message = extractMessage(errorData, `Erreur ${response.status}`);

    // ✅ Log console pour debug — affiche l'erreur exacte du backend
    console.error(
      `[apiFetch] ${response.status} ${method} ${endpoint}`,
      '\nMessage :', message,
      '\nDétails  :', errorData,
    );

    /*
     * ✅ FIX 401 — ne pas rediriger si on est déjà sur une page auth.
     * AVANT : redirigait même pendant /register → boucle infinie
     * APRÈS : seulement si hors des pages publiques auth
     */
    if (response.status === 401) {
      tokenStorage.remove();
      const currentPath = window.location.pathname;
      const isAuthPage  = ['/login', '/register'].includes(currentPath);
      if (!isAuthPage) {
        window.location.href = '/login';
      }
    }

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