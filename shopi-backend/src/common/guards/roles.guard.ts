// src/common/guards/roles.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard
 * Vérifie que l'utilisateur connecté possède le rôle requis.
 * Doit être utilisé APRÈS JwtAuthGuard (qui peuple req.user).
 *
 * USAGE :
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.SUPER_ADMIN)
 *   @Post('bulk')
 *   generateBulk(...) { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupère les rôles requis définis par @Roles(...)
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si pas de @Roles() défini → accès libre (route non protégée par rôle)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié.');
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé. Rôle requis : ${requiredRoles.join(', ')}. ` +
        `Votre rôle : ${user.role}.`,
      );
    }

    return true;
  }
}