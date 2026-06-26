/* ============================================================
 * FICHIER : src/modules/auth/guards/guards.ts
 * RÔLE    : Guards JWT et Rôles centralisés.
 *           Importés par auth.controller.ts et codes.controller.ts.
 * ============================================================ */
 
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import type { UserRole } from 'src/common/enums/user-role.enum';
 
// ── JwtAuthGuard ──────────────────────────────────────────────────────────────
// Valide le Bearer token via la stratégie Passport 'jwt' (JwtStrategy).
// Lance UnauthorizedException si le token est absent ou invalide.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
 
  // ✅ Après (signature correcte)
  override handleRequest<TUser = any>(err: any, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Token d\'authentification manquant ou invalide. Veuillez vous reconnecter.',);
    }
    return user;
  }

}
 
// ── RolesGuard ────────────────────────────────────────────────────────────────
// Vérifie que l'utilisateur connecté possède l'un des rôles requis.
// Doit être utilisé APRÈS JwtAuthGuard (qui attache l'utilisateur à req).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
 
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
 
    // Si aucun rôle n'est requis, on laisse passer
    if (!requiredRoles || requiredRoles.length === 0) return true;
 
    const { user } = context.switchToHttp().getRequest();
 
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifié.');
    }
 
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Accès refusé. Rôle requis : ${requiredRoles.join(' ou ')}. ` +
        `Votre rôle actuel : ${user.role}.`,
      );
    }
 
    return true;
  }
}