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
