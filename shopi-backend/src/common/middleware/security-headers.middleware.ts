/* ============================================================
 * FICHIER  : src/common/middleware/security-headers.middleware.ts
 * MODULE   : Common / Middleware
 * ROLE     : Applique les en-têtes HTTP de sécurité sur chaque réponse.
 *
 * FIX C3 — Remplacement de Helmet (non installé) par un middleware
 * natif NestJS/Express qui positionne manuellement les mêmes headers.
 *
 * EN-TÊTES APPLIQUÉS :
 *   Content-Security-Policy     → restreint les sources de scripts/styles/images
 *   X-Frame-Options             → interdit l'embarquement dans une iframe (clickjacking)
 *   X-Content-Type-Options      → interdit le MIME sniffing
 *   Strict-Transport-Security   → force HTTPS pour 1 an (HSTS)
 *   Referrer-Policy             → limite la fuite d'URL dans le header Referer
 *   X-XSS-Protection            → active la protection navigateur legacy
 *   Permissions-Policy          → désactive les API navigateur non nécessaires
 *   Cache-Control               → évite le cache des réponses API sensibles
 *   X-Powered-By               → supprimé (ne pas révéler la stack technique)
 *
 * AUTEUR           : Shopi03
 * DERNIERE REVISION : 2026-07-27 (FIX C3 audit sécurité)
 * ============================================================ */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {

  use(_req: Request, res: Response, next: NextFunction): void {

    /* ── 1. Masquer la signature du framework ─────────────────── */
    res.removeHeader('X-Powered-By');

    /* ── 2. Interdire l'embarquement dans une iframe ─────────── */
    res.setHeader('X-Frame-Options', 'DENY');

    /* ── 3. Interdire le MIME sniffing ───────────────────────── */
    res.setHeader('X-Content-Type-Options', 'nosniff');

    /* ── 4. Protection XSS (navigateurs legacy) ──────────────── */
    res.setHeader('X-XSS-Protection', '1; mode=block');

    /* ── 5. Politique referrer stricte ───────────────────────── */
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    /* ── 6. HSTS — forcer HTTPS pour 1 an ───────────────────── */
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );

    /* ── 7. Désactiver les API navigateur inutiles ───────────── */
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );

    /* ── 8. CSP — politique de sécurité du contenu ───────────── */
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        // Cloudinary pour les images uploadées
        "img-src 'self' data: https://res.cloudinary.com",
        // Pas de script externe autorisé
        "script-src 'self'",
        // Styles inline autorisés pour le SSR / react
        "style-src 'self' 'unsafe-inline'",
        // Fonts auto-hébergées uniquement
        "font-src 'self'",
        // API calls uniquement vers soi-même
        "connect-src 'self'",
        // Aucun objet embarqué (Flash, PDF via plugin…)
        "object-src 'none'",
        // Aucun frame externe
        "frame-ancestors 'none'",
        // Upgrade automatique HTTP → HTTPS
        'upgrade-insecure-requests',
      ].join('; '),
    );

    /* ── 9. Pas de cache pour les réponses API sensibles ─────── */
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    next();
  }
}
