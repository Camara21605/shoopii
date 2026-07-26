/* ============================================================
 * FICHIER      : src/modules/performance-engine/interceptors/performance.interceptor.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Intercepteur NestJS qui mesure la durée de chaque requête HTTP
 * et l'enregistre dans PerformanceProfilerService.
 *
 * FONCTIONNEMENT
 * ─────────────────────────────────────────────────────────────
 * 1. Avant le handler : note le timestamp de début
 * 2. Après le handler (tap) : calcule la durée, appelle profiler.record()
 *
 * ACTIVATION
 * ─────────────────────────────────────────────────────────────
 * Enregistré globalement dans PerformanceModule comme APP_INTERCEPTOR.
 * S'applique automatiquement à toutes les routes de l'application.
 *
 * NORMALISATION DES ROUTES
 * ─────────────────────────────────────────────────────────────
 * Les paramètres de route (:id, :uuid) sont normalisés pour éviter
 * une explosion du nombre de clés dans le profiler.
 * Exemple : /api/commandes/abc123 → /api/commandes/:id
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap }        from 'rxjs/operators';
import { Request, Response } from 'express';

import { PerformanceProfilerService } from '../services/performance-profiler.service';

/* ============================================================
 * REGEX DE NORMALISATION
 * Remplace les segments UUID, numériques et ids opaques par :id
 * ============================================================ */

const UUID_PATTERN  = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUM_PATTERN   = /\/\d+/g;
const HASH_PATTERN  = /\/[a-zA-Z0-9]{24,}/g;

/* ============================================================
 * INTERCEPTEUR
 * ============================================================ */

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {

  constructor(
    private readonly profiler: PerformanceProfilerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    /* Uniquement pour les requêtes HTTP (pas pour GraphQL, WS, etc.) */
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req   = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res        = context.switchToHttp().getResponse<Response>();
          const durationMs = Date.now() - start;
          const route      = normalizeRoute(req.path ?? req.url ?? '');
          this.profiler.record(route, req.method, res.statusCode, durationMs);
        },
        error: () => {
          /* Les erreurs NestJS passent par le filtre d'exception avant d'arriver
           * ici — statusCode est déjà fixé sur la response à ce stade. */
          const res        = context.switchToHttp().getResponse<Response>();
          const durationMs = Date.now() - start;
          const route      = normalizeRoute(req.path ?? req.url ?? '');
          const status     = res.statusCode ?? 500;
          this.profiler.record(route, req.method, status, durationMs);
        },
      }),
    );
  }
}

/* ============================================================
 * HELPER — NORMALISATION DES ROUTES
 * ============================================================ */

function normalizeRoute(path: string): string {
  return path
    .replace(UUID_PATTERN, ':id')   /* /api/cmd/550e8400-...  → /api/cmd/:id  */
    .replace(NUM_PATTERN,  '/:id')  /* /api/cmd/42            → /api/cmd/:id  */
    .replace(HASH_PATTERN, '/:id')  /* /api/cmd/xK8sPqL...    → /api/cmd/:id  */
    || '/';
}
