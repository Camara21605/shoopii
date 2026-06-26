// src/common/decorators/roles.decorator.ts

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