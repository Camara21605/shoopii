/* ============================================================
 * FICHIER  : src/common/middleware/correlation-id.middleware.ts
 * MODULE   : Common / Middleware
 * ROLE     : Attache un identifiant unique à chaque requête HTTP.
 *
 * RESPONSABILITES :
 *   - Lire l'en-tête X-Request-Id envoyé par le client (load balancer,
 *     API gateway, Postman) ou en générer un si absent.
 *   - Attacher l'id sur req['correlationId'] pour que les services
 *     et le Logger puissent l'inclure dans leurs traces.
 *   - Renvoyer X-Request-Id dans la réponse pour que le client puisse
 *     tracer sa requête côté frontend (console, Sentry, etc.).
 *
 * POURQUOI :
 *   Sans correlation ID, débugger des erreurs en production sur
 *   un serveur multi-instance est quasi impossible — on ne peut pas
 *   relier les logs d'une requête entre les différents services.
 *   Ce middleware est le socle de toute l'observabilité future
 *   (tracing distribué, Sentry, Datadog, OpenTelemetry).
 *
 * USAGE dans un service :
 *   constructor(@Inject(REQUEST) private readonly req: Request) {}
 *   // puis : this.req['correlationId']
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {

  use(req: Request, res: Response, next: NextFunction): void {
    /* Priorité : header entrant (API gateway, load balancer) → généré. */
    const id = (req.headers['x-request-id'] as string | undefined)?.trim()
      || randomUUID();

    /* Accessible dans les controllers/services via req['correlationId']. */
    (req as any).correlationId = id;

    /* Renvoyer dans la réponse : utile pour corréler les logs clients
     * (frontend console.error) avec les logs serveur. */
    res.setHeader('X-Request-Id', id);

    next();
  }
}
