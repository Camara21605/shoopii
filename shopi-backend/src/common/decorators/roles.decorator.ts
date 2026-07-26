/* ============================================================
 * FICHIER      : src/common/decorators/roles.decorator.ts
 * MODULE       : Common / Decorators
 * ROLE         : Décorateurs @Roles() et @CurrentUser().
 *
 * RESPONSABILITES :
 *   - @Roles(...roles)    : définit les rôles autorisés sur une route.
 *   - @CurrentUser()      : injecte req.user dans un paramètre de méthode.
 *
 * DEPENDANCES  : @nestjs/common, ../enums/user-role.enum
 * CONSOMME PAR :
 *   - RolesGuard (lit ROLES_KEY via Reflector)
 *   - Tous les controllers qui ont besoin de l'utilisateur connecté
 *
 * PRECAUTION :
 *   Ne jamais renommer ROLES_KEY sans mettre à jour RolesGuard en même temps.
 *   @CurrentUser() ne fonctionne que si JwtAuthGuard a déjà peuplé req.user.
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
/**
 * Clé utilisée par RolesGuard pour lire les métadonnées
 */
export const ROLES_KEY = 'roles';


/**
 * @Roles(...roles)
 * Décore un controller ou une méthode pour restreindre l'accès à certains rôles.
 *
 * USAGE :
 *   @Roles(UserRole.SUPER_ADMIN)
 *   @Roles('super_admin', 'admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * @CurrentUser()
 * Injecte l'utilisateur connecté depuis req.user (peuplé par JwtStrategy).
 *
 * USAGE :
 *   @Get('me')
 *   getMe(@CurrentUser() user: User) {
 *     return user;
 *   }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);