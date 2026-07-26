/* ============================================================
 * FICHIER      : src/common/guards/auth.guard.ts
 * MODULE       : Common / Guards
 * ROLE         : Guard JWT global — protège toutes les routes de l'application.
 *
 * RESPONSABILITES :
 *   - Vérifier la présence et la validité du token JWT sur chaque requête.
 *   - Laisser passer les routes marquées @Public() sans vérification.
 *   - Déléguer la validation du token à JwtStrategy (Passport).
 *
 * DEPENDANCES  :
 *   - @nestjs/passport (AuthGuard)
 *   - @nestjs/core (Reflector)
 *   - ../decorators/public.decorator (IS_PUBLIC_KEY)
 *
 * CONSOMME PAR :
 *   - AppModule (enregistré comme APP_GUARD global)
 *   - Aucun module ne devrait l'importer directement — il est global.
 *
 * CYCLE DE VIE :
 *   S'exécute sur CHAQUE requête avant le controller.
 *   Ordre : CorrelationIdMiddleware → JwtAuthGuard → RolesGuard → Controller.
 *
 * PRECAUTION :
 *   Ce guard est enregistré en tant que provider global (APP_GUARD).
 *   Toute modification impacte l'ensemble des endpoints de l'API.
 *   Toujours tester les routes @Public() ET les routes protégées après modification.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard }    from '@nestjs/passport';
import { Reflector }    from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    /* Les routes @Public() sont exemptées de vérification JWT.
     * getAllAndOverride lit la métadonnée sur la méthode EN PRIORITÉ,
     * puis sur la classe si absent — permet @Public() sur le controller entier. */
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    /* Délègue à Passport/JwtStrategy qui valide la signature et l'expiration.
     * En cas d'échec, Passport lève une UnauthorizedException automatiquement. */
    return super.canActivate(context);
  }
}