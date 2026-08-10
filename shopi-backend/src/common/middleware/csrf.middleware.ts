/* ============================================================
 * FICHIER : src/common/middleware/csrf.middleware.ts
 *
 * RÔLE : Protection CSRF par double-submit cookie, en défense
 *        en profondeur en complément de SameSite + CORS strict.
 *
 * POURQUOI NÉCESSAIRE MALGRÉ SameSite :
 *   En production, le frontend (Vercel) et le backend (Render) sont
 *   sur des domaines différents → les cookies de session utilisent
 *   sameSite:'none' (obligatoire pour un usage cross-site), ce qui
 *   désactive la protection CSRF native de SameSite=Lax/Strict.
 *   La whitelist CORS bloque les appels fetch/XHR cross-origin, mais
 *   ne protège pas contre un simple <form> HTML soumis depuis un
 *   site tiers (les soumissions de formulaire ne sont pas soumises
 *   au preflight CORS).
 *
 * PRINCIPE (double-submit cookie) :
 *   1. Le serveur pose un cookie `csrf_token` lisible en JS (PAS
 *      httpOnly) contenant une valeur aléatoire.
 *   2. Le frontend lit ce cookie et le renvoie dans l'en-tête
 *      `X-CSRF-Token` sur chaque requête mutante.
 *   3. Le serveur compare cookie et en-tête — un attaquant cross-site
 *      peut faire partir le cookie de session (auto-attaché par le
 *      navigateur) mais ne peut PAS lire le cookie csrf_token d'un
 *      autre domaine (Same-Origin Policy) pour le rejouer en en-tête.
 *
 * CORRECTIF (bug prod, pas juste "certains navigateurs") : l'étape 2
 *   ci-dessus est en réalité IMPOSSIBLE en cross-site. `document.cookie`,
 *   côté JS, n'expose QUE les cookies dont le Domain correspond à
 *   l'origine de la page qui lit — jamais un cookie posé par la réponse
 *   d'un AUTRE domaine (ici le backend Render, différent du frontend
 *   Vercel/shopi.gn). Ce n'était pas cassé en local uniquement parce que
 *   localhost:5173 et localhost:3001 partagent le même host (le port est
 *   ignoré pour le scope d'un cookie) — en prod, sur deux vrais domaines,
 *   `document.cookie` ne verra JAMAIS `csrf_token`, pour personne, sur
 *   aucun navigateur : chaque PATCH/POST/PUT/DELETE authentifié échouait
 *   à 100% avec "Jeton CSRF manquant". Solution : en PLUS du cookie, le
 *   serveur renvoie le même token dans l'en-tête de réponse `X-CSRF-Token`
 *   (lisible cross-origin par fetch() grâce à `exposedHeaders` en CORS —
 *   voir main.ts) ; le frontend le lit là au lieu de `document.cookie`.
 *
 * PORTÉE :
 *   Ne bloque que les méthodes mutantes (POST/PUT/PATCH/DELETE) d'une
 *   requête qui présente déjà un cookie de session (access_token ou
 *   refresh_token). Les clients Bearer-only (mobile/API externes) ne
 *   sont pas concernés : sans cookie envoyé automatiquement par un
 *   navigateur, ils ne sont pas vulnérables au CSRF.
 * ============================================================ */

import type { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(isProd: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // ── 1. Émission — assure qu'un token CSRF existe côté client ──
    let token = req.cookies?.[CSRF_COOKIE] as string | undefined;
    if (!token) {
      token = randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // doit être lisible en JS pour être renvoyé en en-tête
        secure:   isProd,
        sameSite: isProd ? 'none' : 'lax',
        path:     '/',
      });
    }
    /* Canal de secours cross-site — voir le commentaire d'en-tête du
       fichier : document.cookie ne peut pas lire ce cookie en prod
       (domaines différents). Renvoyé sur TOUTE requête, y compris les
       GET, pour que le frontend récupère un token valide dès le premier
       appel (ex: /auth/me au démarrage de l'app), avant même la
       première requête mutante. */
    res.setHeader(CSRF_HEADER, token);

    // ── 2. Vérification — uniquement requêtes mutantes + session cookie ──
    const hasAuthCookie = !!(req.cookies?.access_token || req.cookies?.refresh_token);
    if (SAFE_METHODS.has(req.method) || !hasAuthCookie) {
      return next();
    }

    const headerToken = req.headers[CSRF_HEADER] as string | undefined;
    if (!headerToken || headerToken !== token) {
      res.status(403).json({
        statusCode: 403,
        message:    'Jeton CSRF manquant ou invalide.',
      });
      return;
    }

    next();
  };
}
